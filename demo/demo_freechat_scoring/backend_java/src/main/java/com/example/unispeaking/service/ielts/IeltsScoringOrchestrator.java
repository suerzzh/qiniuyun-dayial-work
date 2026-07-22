package com.example.unispeaking.service.ielts;

import com.example.unispeaking.model.ielts.*;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Service
public class IeltsScoringOrchestrator {
    public static final String DISCLAIMER =
            "本报告由 AI 根据本次训练音频和转写生成，仅用于学习参考，不代表 IELTS 官方成绩、认证考官评分或考试结果。";

    private final IeltsTextScorer textScorer;
    private final PronunciationEvidenceProvider pronunciationProvider;
    private final IeltsAcousticFeatureService acoustic = new IeltsAcousticFeatureService();
    private final IeltsBandCalculator calculator = new IeltsBandCalculator();

    public IeltsScoringOrchestrator(IeltsTextScorer textScorer,
                                    PronunciationEvidenceProvider pronunciationProvider) {
        this.textScorer = textScorer;
        this.pronunciationProvider = pronunciationProvider;
    }

    public CompletableFuture<IeltsReport> score(IeltsAttempt attempt) {
        attempt.setScoringStatus(IeltsScoringStatus.SCORING);
        List<IeltsTurn> scoringTurns = scoringTurns(attempt);
        if (scoringTurns.isEmpty()) {
            IeltsReport report = unavailable(attempt, IeltsScoringStatus.UNSCORABLE,
                    List.of("没有可评分回答"), List.of());
            attempt.setReport(report);
            attempt.setScoringStatus(report.scoringStatus());
            return CompletableFuture.completedFuture(report);
        }
        if (scoringTurns.stream().noneMatch(turn -> !turn.rawTranscript().isBlank())) {
            IeltsReport report = unavailable(attempt, IeltsScoringStatus.UNSCORABLE,
                    List.of("没有有效 raw transcript，无法评分"), List.of());
            attempt.setReport(report);
            attempt.setScoringStatus(report.scoringStatus());
            return CompletableFuture.completedFuture(report);
        }

        List<CompletableFuture<PronunciationEvidence>> providerFutures = scoringTurns.stream()
                .map(turn -> pronunciationProvider.evaluate(turn)
                        .orTimeout(60, TimeUnit.SECONDS)
                        .exceptionally(error -> PronunciationEvidence.failure(rootCause(error))))
                .toList();
        CompletableFuture<Void> allPron = CompletableFuture.allOf(providerFutures.toArray(CompletableFuture[]::new));
        IeltsTwoStageTextScorer twoStage = textScorer instanceof IeltsTwoStageTextScorer value ? value : null;
        CompletableFuture<Map<String, Object>> languageFuture = twoStage == null ? null
                : twoStage.languageEvidence(structuredInput(attempt, List.of(), dataWarnings(attempt, List.of())));
        return allPron.thenCompose(ignored -> {
            List<PronunciationEvidence> pronunciation = providerFutures.stream().map(CompletableFuture::join).toList();
            List<String> warnings = dataWarnings(attempt, pronunciation);
            Map<String, Object> input = structuredInput(attempt, pronunciation, warnings);
            CompletableFuture<Map<String, Object>> judgeFuture;
            if (twoStage == null) {
                judgeFuture = textScorer.score(input);
            } else {
                judgeFuture = languageFuture.thenCompose(language -> {
                    Map<String, Object> combined = new LinkedHashMap<>(input);
                    combined.put("language_evidence", language);
                    return twoStage.holisticJudge(combined);
                });
            }
            return judgeFuture.handle((judge, error) -> {
                if (error != null) {
                    IeltsScoringStatus status = pronunciation.stream().anyMatch(e -> e.error() == null)
                            ? IeltsScoringStatus.PARTIAL : IeltsScoringStatus.UNSCORABLE;
                    List<String> combined = new ArrayList<>(warnings);
                    combined.add("Qwen IELTS Judge 失败: " + rootCause(error));
                    return unavailable(attempt, status, combined, pronunciation);
                }
                return buildReport(attempt, judge, pronunciation, warnings);
            });
        }).thenApply(report -> {
            attempt.setReport(report);
            attempt.setScoringStatus(report.scoringStatus());
            return report;
        });
    }

    private IeltsReport buildReport(IeltsAttempt attempt, Map<String, Object> judge,
                                    List<PronunciationEvidence> pronunciationEvidence,
                                    List<String> initialWarnings) {
        List<String> warnings = new ArrayList<>(initialWarnings);
        IeltsDimensionResult fc = dimension("FC", judge.get("fluency_coherence"), warnings);
        IeltsDimensionResult lr = dimension("LR", judge.get("lexical_resource"), warnings);
        IeltsDimensionResult gra = dimension("GRA", judge.get("grammatical_range_accuracy"), warnings);
        boolean hasUsableIse = pronunciationEvidence.stream().anyMatch(e -> e.error() == null);
        IeltsDimensionResult p = hasUsableIse
                ? dimension("P", judge.get("pronunciation"), warnings)
                : IeltsDimensionResult.unavailable("P", "科大讯飞发音证据不可用");
        IeltsBandCalculator.Result calculated = calculator.calculate(fc.band(), lr.band(), gra.band(), p.band());
        IeltsScoringStatus status = calculated.overallBand() == null
                ? IeltsScoringStatus.PARTIAL : IeltsScoringStatus.COMPLETE;
        List<String> positives = concat(fc.positiveEvidence(), lr.positiveEvidence(), gra.positiveEvidence(), p.positiveEvidence());
        List<String> limits = concat(fc.limitingEvidence(), lr.limitingEvidence(), gra.limitingEvidence(), p.limitingEvidence());
        return new IeltsReport(attempt.getAttemptId(), status, calculated.overallBand(),
                doubles(judge.get("band_range")), nullableNumber(judge.get("confidence")),
                fc, lr, gra, p, positives, limits, partSummaries(judge.get("part_summaries")),
                pronunciationEvidence, List.copyOf(warnings), DISCLAIMER);
    }

    private IeltsDimensionResult dimension(String code, Object raw, List<String> warnings) {
        Map<String, Object> map = asMap(raw);
        Double band = nullableNumber(map.get("band_suggestion"));
        if (band != null) {
            try { IeltsBandCalculator.validate(band); }
            catch (IllegalArgumentException error) {
                warnings.add(code + " band suggestion 非法，已标记 unavailable");
                band = null;
            }
        }
        return new IeltsDimensionResult(code, band, nullableNumber(map.get("confidence")),
                strings(map.get("positive_evidence")), strings(map.get("limiting_evidence")),
                band == null ? "千问未返回有效的 Band 建议" : null);
    }

    private Map<String, Object> structuredInput(IeltsAttempt attempt,
                                                List<PronunciationEvidence> pronunciation,
                                                List<String> warnings) {
        List<Map<String, Object>> turns = scoringTurns(attempt).stream().map(turn -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("turn_id", turn.turnId());
            item.put("part", turn.part());
            item.put("question_id", turn.questionId());
            item.put("question_text", turn.questionTextSnapshot());
            item.put("raw_transcript", turn.rawTranscript());
            item.put("audio_byte_length", turn.audioByteLength());
            item.put("metrics", acoustic.calculate(turn));
            item.put("scoring_eligible", true);
            return item;
        }).toList();
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("attempt_id", attempt.getAttemptId());
        input.put("mode", attempt.getMode());
        input.put("paper_snapshot", attempt.getPaperSnapshot());
        input.put("complete_exam_turns", turns);
        input.put("pronunciation_evidence", pronunciation);
        input.put("data_quality_warnings", warnings);
        input.put("scoring_contract", "Use raw_transcript only; never use a corrected expression.");
        return input;
    }

    private List<String> dataWarnings(IeltsAttempt attempt, List<PronunciationEvidence> evidence) {
        Set<String> warnings = new LinkedHashSet<>();
        evidence.stream().filter(e -> e.error() != null)
                .forEach(e -> warnings.add("科大讯飞发音证据不可用: " + e.error()));
        List<IeltsTurn> scoringTurns = scoringTurns(attempt);
        if (scoringTurns.stream().anyMatch(t -> t.rawTranscript().isBlank()))
            warnings.add("部分回答缺少 raw transcript");
        if (scoringTurns.stream().anyMatch(t -> t.audioByteLength() == 0))
            warnings.add("部分回答缺少完整 PCM 音频");
        return List.copyOf(warnings);
    }

    private static List<IeltsTurn> scoringTurns(IeltsAttempt attempt) {
        return attempt.getTurns().stream()
                .filter(IeltsTurn::scoringEligible)
                .filter(turn -> turn.part() >= 1 && turn.part() <= 3)
                .toList();
    }

    private IeltsReport unavailable(IeltsAttempt attempt, IeltsScoringStatus status,
                                    List<String> warnings, List<PronunciationEvidence> evidence) {
        return new IeltsReport(attempt.getAttemptId(), status, null, List.of(), null,
                IeltsDimensionResult.unavailable("FC", "千问文本评分不可用"),
                IeltsDimensionResult.unavailable("LR", "千问文本评分不可用"),
                IeltsDimensionResult.unavailable("GRA", "千问文本评分不可用"),
                IeltsDimensionResult.unavailable("P", "发音综合判断不可用"),
                List.of(), List.of(), Map.of("part1", "不可评分", "part2", "不可评分", "part3", "不可评分"),
                evidence, warnings, DISCLAIMER);
    }

    @SafeVarargs private static List<String> concat(List<String>... lists) {
        return Arrays.stream(lists).filter(Objects::nonNull).flatMap(Collection::stream).toList();
    }
    @SuppressWarnings("unchecked") private static Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }
    private static List<String> strings(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream().filter(Objects::nonNull).map(String::valueOf).toList();
    }
    private static List<Double> doubles(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream().map(IeltsScoringOrchestrator::nullableNumber).filter(Objects::nonNull).toList();
    }
    private static Double nullableNumber(Object value) { return value instanceof Number n ? n.doubleValue() : null; }
    private static Map<String, String> partSummaries(Object value) {
        Map<String, Object> raw = asMap(value);
        Map<String, String> result = new LinkedHashMap<>();
        for (String part : List.of("part1", "part2", "part3")) {
            Object partValue = raw.getOrDefault(part, "未观察到有效回答");
            if (partValue instanceof Map<?, ?> map && map.get("summary") != null) {
                partValue = map.get("summary");
            }
            result.put(part, String.valueOf(partValue));
        }
        return result;
    }
    private static String rootCause(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null) current = current.getCause();
        return current.getMessage() == null ? current.getClass().getSimpleName() : current.getMessage();
    }
}
