package com.example.unispeaking.service.ielts;

import com.example.unispeaking.model.ielts.IeltsAttempt;
import com.example.unispeaking.model.ielts.IeltsReport;
import com.example.unispeaking.model.ielts.IeltsScoringStatus;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class IeltsScoringOrchestratorTest {
    private static IeltsAttempt attempt() {
        var attempt = new IeltsAttempt("att-1", "full_mock", Map.of("paperId", "paper-1"));
        var turn = new IeltsTurn("t1", 1, "q1", "Where do you live?", false, 0);
        turn.setRawTranscript("I live in Shanghai and I have lived there for ten years.");
        turn.speechStarted(100);
        turn.speechStopped(5_100);
        turn.complete(5_500, "USER_DONE");
        turn.setAudio(new byte[16_000]);
        attempt.addTurn(turn);
        return attempt;
    }

    @Test
    void iflytekFailureStillReturnsTextDimensionsAsPartialScoring() {
        IeltsTextScorer text = input -> CompletableFuture.completedFuture(validJudge());
        PronunciationEvidenceProvider ise = turn -> CompletableFuture.failedFuture(new RuntimeException("ISE down"));
        IeltsReport report = new IeltsScoringOrchestrator(text, ise).score(attempt()).join();

        assertEquals(IeltsScoringStatus.PARTIAL, report.scoringStatus());
        assertEquals(6.5, report.fc().band());
        assertNull(report.pronunciation().band());
        assertEquals("科大讯飞发音证据不可用", report.pronunciation().unavailableReason());
        assertNull(report.overallBand());
        assertTrue(report.dataQualityWarnings().stream().anyMatch(s -> s.contains("科大讯飞")));
    }

    @Test
    void textModelFailureKeepsPronunciationEvidenceButNeverConvertsItToBand() {
        IeltsTextScorer text = input -> CompletableFuture.failedFuture(new RuntimeException("invalid JSON"));
        PronunciationEvidenceProvider ise = turn -> CompletableFuture.completedFuture(
                new PronunciationEvidence("XFYUN_ISE", "read_sentence", "LOW", Map.of("accuracy_score", 82), "<xml/>", null));
        IeltsReport report = new IeltsScoringOrchestrator(text, ise).score(attempt()).join();

        assertEquals(IeltsScoringStatus.PARTIAL, report.scoringStatus());
        assertFalse(report.pronunciationEvidence().isEmpty());
        assertNull(report.pronunciation().band());
        assertNull(report.overallBand());
    }

    @Test
    void completeEvidenceProducesJavaCalculatedOverall() {
        IeltsTextScorer text = input -> CompletableFuture.completedFuture(validJudge());
        PronunciationEvidenceProvider ise = turn -> CompletableFuture.completedFuture(
                new PronunciationEvidence("XFYUN_ISE", "read_sentence", "LOW", Map.of("accuracy_score", 80), "raw", null));
        IeltsReport report = new IeltsScoringOrchestrator(text, ise).score(attempt()).join();
        assertEquals(IeltsScoringStatus.COMPLETE, report.scoringStatus());
        assertEquals(6.5, report.overallBand());
    }

    @Test
    void noAnswerIsUnscorableAndDoesNotCallProviders() {
        IeltsAttempt empty = new IeltsAttempt("att-empty", "full_mock", Map.of());
        IeltsTextScorer text = input -> { throw new AssertionError("must not call Qwen"); };
        PronunciationEvidenceProvider ise = turn -> { throw new AssertionError("must not call ISE"); };
        IeltsReport report = new IeltsScoringOrchestrator(text, ise).score(empty).join();
        assertEquals(IeltsScoringStatus.UNSCORABLE, report.scoringStatus());
        assertNull(report.overallBand());
    }

    @Test
    void completedTurnsWithNoRawTranscriptAreUnscorableAndSkipProviders() {
        IeltsAttempt empty = new IeltsAttempt("att-empty-turns", "full_mock", Map.of());
        for (int index = 1; index <= 3; index++) {
            IeltsTurn turn = new IeltsTurn("t" + index, index, "q" + index,
                    "Question " + index, index == 2, 0);
            turn.complete(2_000, "USER_DONE");
            empty.addTurn(turn);
        }
        AtomicInteger qwenCalls = new AtomicInteger();
        AtomicInteger iseCalls = new AtomicInteger();
        IeltsTextScorer text = input -> {
            qwenCalls.incrementAndGet();
            return CompletableFuture.completedFuture(validJudge());
        };
        PronunciationEvidenceProvider ise = turn -> {
            iseCalls.incrementAndGet();
            return CompletableFuture.completedFuture(PronunciationEvidence.failure("missing"));
        };

        IeltsReport report = new IeltsScoringOrchestrator(text, ise).score(empty).join();

        assertEquals(IeltsScoringStatus.UNSCORABLE, report.scoringStatus());
        assertEquals(0, qwenCalls.get());
        assertEquals(0, iseCalls.get());
        assertEquals(List.of("没有有效 raw transcript，无法评分"), report.dataQualityWarnings());
    }

    @Test
    void nestedPartSummaryUsesItsChineseSummaryTextInsteadOfJavaMapFormatting() {
        Map<String, Object> judge = new java.util.LinkedHashMap<>(validJudge());
        judge.put("part_summaries", Map.of(
                "part1", Map.of("summary", "回答切题，但样本较短", "question_count", 4),
                "part2", "未观察到有效回答",
                "part3", "未观察到有效回答"));
        IeltsTextScorer text = input -> CompletableFuture.completedFuture(judge);
        PronunciationEvidenceProvider ise = turn -> CompletableFuture.completedFuture(
                new PronunciationEvidence("XFYUN_ISE", "read_sentence", "LOW", Map.of(), "raw", null));

        IeltsReport report = new IeltsScoringOrchestrator(text, ise).score(attempt()).join();

        assertEquals("回答切题，但样本较短", report.partSummaries().get("part1"));
    }

    @Test
    void missingPronunciationBandUsesAChineseUnavailableReason() {
        Map<String, Object> judge = new java.util.LinkedHashMap<>(validJudge());
        judge.put("pronunciation", Map.of(
                "confidence", 0.3,
                "positive_evidence", List.of(),
                "limiting_evidence", List.of("证据不足")));
        IeltsTextScorer text = input -> CompletableFuture.completedFuture(judge);
        PronunciationEvidenceProvider ise = turn -> CompletableFuture.completedFuture(
                new PronunciationEvidence("XFYUN_ISE", "read_sentence", "LOW", Map.of(), "raw", null));
        IeltsReport report = new IeltsScoringOrchestrator(text, ise).score(attempt()).join();
        assertEquals("千问未返回有效的 Band 建议", report.pronunciation().unavailableReason());
    }

    @Test
    void introductionIsStoredButExcludedFromQwenAndIflytekScoringInputs() {
        IeltsAttempt attempt = attempt();
        IeltsTurn intro = new IeltsTurn("intro", 0, "introduction", "Please introduce yourself.",
                false, false, 0);
        intro.setRawTranscript("My name is Lin and I am from Shanghai.");
        intro.complete(4_000, "USER_DONE");
        intro.setAudio(new byte[8_000]);
        attempt.addTurn(intro);

        AtomicReference<Map<String, Object>> qwenInput = new AtomicReference<>();
        IeltsTextScorer text = input -> {
            qwenInput.set(input);
            return CompletableFuture.completedFuture(validJudge());
        };
        AtomicInteger iseCalls = new AtomicInteger();
        PronunciationEvidenceProvider ise = turn -> {
            iseCalls.incrementAndGet();
            assertTrue(turn.scoringEligible());
            assertTrue(turn.part() >= 1 && turn.part() <= 3);
            return CompletableFuture.completedFuture(new PronunciationEvidence(
                    "XFYUN_ISE", "read_sentence", "LOW", Map.of(), "raw", null));
        };

        new IeltsScoringOrchestrator(text, ise).score(attempt).join();
        assertEquals(1, iseCalls.get());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> turns = (List<Map<String, Object>>) qwenInput.get().get("complete_exam_turns");
        assertEquals(1, turns.size());
        assertEquals(1, turns.getFirst().get("part"));
        assertFalse(turns.stream().anyMatch(turn -> "introduction".equals(turn.get("question_id"))));
    }

    private static Map<String, Object> validJudge() {
        return Map.of(
                "fluency_coherence", dimension(6.5),
                "lexical_resource", dimension(6.0),
                "grammatical_range_accuracy", dimension(6.5),
                "pronunciation", dimension(6.0),
                "part_summaries", Map.of("part1", "Clear answers", "part2", "Not observed", "part3", "Not observed"),
                "band_range", List.of(6.0, 6.5), "confidence", 0.72
        );
    }

    private static Map<String, Object> dimension(double band) {
        return Map.of("band_suggestion", band, "confidence", 0.75,
                "positive_evidence", List.of("Relevant evidence"),
                "limiting_evidence", List.of("Limited sample"));
    }
}
