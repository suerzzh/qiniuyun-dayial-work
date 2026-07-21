package com.example.unispeaking.service;

import com.example.unispeaking.model.SessionState;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ScoringStreamHandler extends BinaryWebSocketHandler {
    private static final int BYTES_PER_MS = 32; // 16kHz * 16-bit mono
    private static final int PRE_ROLL_MS = 500;
    private static final int POST_ROLL_MS = 700;
    private static final int PRE_ROLL_BYTES = PRE_ROLL_MS * BYTES_PER_MS;
    private static final int POST_ROLL_BYTES = POST_ROLL_MS * BYTES_PER_MS;
    private static final int RING_CAPACITY_BYTES = 5_000 * BYTES_PER_MS;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SessionRegistry sessionRegistry;
    private final XfyunIseService xfyunIseService;
    private final QwenScoringService qwenScoringService;
    private final Map<String, StreamContext> streams = new ConcurrentHashMap<>();

    public ScoringStreamHandler(
            SessionRegistry sessionRegistry,
            XfyunIseService xfyunIseService,
            QwenScoringService qwenScoringService
    ) {
        this.sessionRegistry = sessionRegistry;
        this.xfyunIseService = xfyunIseService;
        this.qwenScoringService = qwenScoringService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession socket) throws Exception {
        String sessionId = queryParam(socket.getUri(), "session_id");
        SessionState state = sessionRegistry.get(sessionId);
        if (state == null || !state.isScoringEnabled() || state.isEnded()) {
            socket.close(CloseStatus.POLICY_VIOLATION.withReason("Scoring session unavailable"));
            return;
        }
        socket.getAttributes().put("session_id", sessionId);
        streams.put(socket.getId(), new StreamContext(state, socket));
        send(socket, Map.of("type", "stream.ready", "session_id", sessionId));
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession socket, BinaryMessage message) {
        StreamContext context = streams.get(socket.getId());
        if (context == null) return;
        ByteBuffer payload = message.getPayload();
        byte[] pcm = new byte[payload.remaining()];
        payload.get(pcm);
        context.appendPcm(pcm);
    }

    @Override
    protected void handleTextMessage(WebSocketSession socket, TextMessage message) {
        StreamContext context = streams.get(socket.getId());
        if (context == null) return;
        try {
            JsonNode event = objectMapper.readTree(message.getPayload());
            String type = event.path("type").asText();
            switch (type) {
                case "stream.start" -> sendQuietly(socket, Map.of("type", "stream.started"));
                case "turn.speech_started" -> context.startTurn(
                        event.path("turn_id").asText(), event.path("realtime_item_id").asText(""));
                case "turn.speech_stopped" -> context.stopTurn(event.path("turn_id").asText());
                case "turn.transcript_completed" -> context.completeTranscript(
                        event.path("turn_id").asText(), event.path("text").asText(""));
                case "context.message" -> context.state.addConversationMessage(
                        event.path("role").asText("assistant"), event.path("text").asText(""));
                case "stream.end" -> context.finishStream();
                default -> sendQuietly(socket, Map.of("type", "stream.warning", "message", "Unknown event: " + type));
            }
        } catch (Exception error) {
            sendQuietly(socket, Map.of("type", "stream.error", "message", "Invalid control event"));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession socket, CloseStatus status) {
        StreamContext context = streams.remove(socket.getId());
        if (context != null) context.finishStream();
    }

    private void scoreTurn(StreamContext context, TurnBuffer turn) {
        String raw = turn.transcript.trim();
        int wordCount = countEnglishWords(raw);
        if (!containsEnglish(raw)) {
            Map<String, Object> skipped = baseResult(turn, raw, wordCount);
            skipped.put("status", "skipped_non_english");
            skipped.put("scorable", false);
            skipped.put("eligible_for_aggregation", false);
            skipped.put("error_reason", "未识别到有效英文，本轮不参与聚合。");
            completeTurn(context, turn, skipped);
            return;
        }

        sendQuietly(context.socket, Map.of(
                "type", "turn.score_status", "turn_id", turn.turnId, "status", "correcting_reference"));
        List<Map<String, String>> conversation = new ArrayList<>(context.state.getConversationMessages());
        var referenceFuture = qwenScoringService.buildPronunciationReference(raw, conversation)
                .orTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .exceptionally(error -> Map.of(
                        "pronunciation_reference", raw,
                        "changes", List.of(),
                        "confidence", 0.7,
                        "status", "correction_timeout_fallback"
                ));
        var pronunciationFuture = referenceFuture.thenCompose(reference ->
                xfyunIseService.evaluatePronunciation(
                        turn.audio.toByteArray(), String.valueOf(reference.get("pronunciation_reference")))
                        .thenApply(pronunciation -> Map.of(
                                "reference", reference,
                                "pronunciation", pronunciation
                        ))
        ).orTimeout(60, java.util.concurrent.TimeUnit.SECONDS).handle(this::providerOutcome);

        var languageFuture = wordCount <= 2
                ? java.util.concurrent.CompletableFuture.completedFuture(
                        Map.<String, Object>of("skipped", true, "reason", "valid_short_answer"))
                : qwenScoringService.evaluateLanguage(raw, conversation)
                    .orTimeout(40, java.util.concurrent.TimeUnit.SECONDS)
                    .handle(this::providerOutcome);

        sendQuietly(context.socket, Map.of(
                "type", "turn.score_status", "turn_id", turn.turnId, "status", "scoring"));
        pronunciationFuture.thenCombine(languageFuture, (pronOutcome, langOutcome) -> {
            Map<String, Object> result = baseResult(turn, raw, wordCount);
            boolean pronOk = !pronOutcome.containsKey("error");
            boolean shortAnswer = wordCount <= 2;
            boolean languageOk = shortAnswer || !langOutcome.containsKey("error");

            if (pronOk) {
                Map<String, Object> wrapped = castMap(pronOutcome.get("result"));
                Map<String, Object> reference = castMap(wrapped.get("reference"));
                result.put("pronunciation_reference", reference);
                Map<String, Object> pronunciation = castMap(wrapped.get("pronunciation"));
                String referenceText = String.valueOf(
                        reference.getOrDefault("pronunciation_reference", raw));
                pronunciation.put("aligned_words",
                        alignWords(raw, referenceText, pronunciation.get("words")));
                pronunciation.put("diagnostics", Map.of(
                        "audio_duration_ms", turn.audio.size() / BYTES_PER_MS,
                        "pre_roll_ms", PRE_ROLL_MS,
                        "post_roll_ms", POST_ROLL_MS,
                        "raw_word_count", tokenize(raw).size(),
                        "reference_word_count", tokenize(referenceText).size(),
                        "provider_word_count", providerWords(pronunciation.get("words")).size()
                ));
                result.put("pronunciation", pronunciation);
                result.put("pronunciation_performance", round1(
                        0.6 * number(pronunciation.get("accuracy_score"))
                                + 0.4 * number(pronunciation.get("fluency_score"))));
            } else {
                result.put("pronunciation", Map.of());
                result.put("pronunciation_error", pronOutcome.get("error"));
            }

            if (shortAnswer) {
                result.put("grammar", Map.of());
                result.put("language_quality", null);
                result.put("short_response", true);
            } else if (languageOk) {
                Map<String, Object> language = castMap(langOutcome.get("result"));
                result.put("grammar", language);
                result.put("language_quality", round1(
                        0.55 * number(language.get("grammar_score"))
                                + 0.25 * number(language.get("vocab_score"))
                                + 0.20 * number(language.get("naturalness_score"))));
            } else {
                result.put("grammar", Map.of());
                result.put("language_error", langOutcome.get("error"));
            }

            if (pronOk && languageOk && !shortAnswer) {
                result.put("turn_score", Math.round(
                        0.55 * number(result.get("pronunciation_performance"))
                                + 0.45 * number(result.get("language_quality"))));
                result.put("status", "scored");
            } else if (pronOk && shortAnswer) {
                result.put("turn_score", null);
                result.put("status", "skipped_short_answer");
            } else if (pronOk || (!shortAnswer && languageOk)) {
                result.put("turn_score", null);
                result.put("status", "partially_scored");
            } else {
                result.put("turn_score", null);
                result.put("status", "provider_failed");
            }
            result.put("scorable", pronOk || (!shortAnswer && languageOk));
            result.put("eligible_for_aggregation", pronOk || (!shortAnswer && languageOk));
            result.put("aggregation_weight", Math.max(3, Math.min(30, wordCount)));
            return result;
        }).thenAccept(result -> completeTurn(context, turn, result));
    }

    private void completeTurn(StreamContext context, TurnBuffer turn, Map<String, Object> result) {
        context.state.getTurnEvaluations().put(turn.turnId, result);
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "turn.score_completed");
        event.put("turn_id", turn.turnId);
        event.put("result", result);
        sendQuietly(context.socket, event);
    }

    private Map<String, Object> baseResult(TurnBuffer turn, String raw, int wordCount) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("turn_id", turn.turnId);
        result.put("realtime_item_id", turn.realtimeItemId);
        result.put("text", raw);
        result.put("raw_transcript", raw);
        result.put("turn_index", turn.turnIndex);
        result.put("word_count", wordCount);
        result.put("short_response", wordCount <= 2);
        return result;
    }

    private Map<String, Object> providerOutcome(Object value, Throwable error) {
        if (error != null) return Map.of("error", rootCause(error));
        return Map.of("result", value == null ? Map.of() : value);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castMap(Object value) {
        return value instanceof Map ? (Map<String, Object>) value : Map.of();
    }
    private double number(Object value) { return value instanceof Number ? ((Number) value).doubleValue() : 0.0; }
    private double round1(double value) { return Math.round(value * 10.0) / 10.0; }
    private boolean containsEnglish(String text) { return text != null && text.matches(".*[A-Za-z].*"); }
    private int countEnglishWords(String text) {
        if (text == null) return 0;
        String normalized = text.replaceAll("[^A-Za-z']+", " ").trim();
        return normalized.isEmpty() ? 0 : normalized.split("\\s+").length;
    }
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> alignWords(
            String transcript, String referenceText, Object providerWordValue) {
        List<String> rawWords = tokenize(transcript);
        List<String> referenceWords = tokenize(referenceText);
        List<Map<String, Object>> scored = providerWords(providerWordValue);
        List<Map<String, Object>> referenceResults = alignReferenceToProvider(referenceWords, scored);
        return mapReferenceResultsToRaw(rawWords, referenceWords, referenceResults);
    }

    private List<Map<String, Object>> alignReferenceToProvider(
            List<String> referenceWords, List<Map<String, Object>> scored) {
        int n = referenceWords.size(), m = scored.size();
        int[][] dp = new int[n + 1][m + 1];
        for (int i = 0; i <= n; i++) dp[i][0] = i;
        for (int j = 0; j <= m; j++) dp[0][j] = j;
        for (int i = 1; i <= n; i++) {
            for (int j = 1; j <= m; j++) {
                String evaluated = String.valueOf(scored.get(j - 1).getOrDefault("word", ""));
                int substitution = sameWord(referenceWords.get(i - 1), evaluated) ? 0 : 1;
                dp[i][j] = Math.min(dp[i - 1][j] + 1,
                        Math.min(dp[i][j - 1] + 1, dp[i - 1][j - 1] + substitution));
            }
        }
        List<Map<String, Object>> aligned = new ArrayList<>();
        int i = n, j = m;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0) {
                String evaluated = String.valueOf(scored.get(j - 1).getOrDefault("word", ""));
                int substitution = sameWord(referenceWords.get(i - 1), evaluated) ? 0 : 1;
                if (dp[i][j] == dp[i - 1][j - 1] + substitution) {
                    Map<String, Object> word = new LinkedHashMap<>(scored.get(j - 1));
                    word.put("evaluated_word", evaluated);
                    word.put("word", referenceWords.get(i - 1));
                    word.put("reference_word", referenceWords.get(i - 1));
                    word.put("alignment", substitution == 0 ? "match" : "substitution");
                    if ("Omission".equals(word.get("error_type"))) {
                        word.put("omission_source", "xfyun");
                    }
                    aligned.add(word);
                    i--; j--;
                    continue;
                }
            }
            if (i > 0 && dp[i][j] == dp[i - 1][j] + 1) {
                aligned.add(unalignedWord(referenceWords.get(i - 1), "provider_unmatched"));
                i--;
            } else if (j > 0) {
                // A provider-only node is retained in the raw provider result for diagnostics,
                // but is not injected into the learner's displayed transcript.
                j--;
            }
        }
        Collections.reverse(aligned);
        return aligned;
    }

    private List<Map<String, Object>> mapReferenceResultsToRaw(
            List<String> rawWords,
            List<String> referenceWords,
            List<Map<String, Object>> referenceResults) {
        int n = rawWords.size(), m = referenceWords.size();
        int[][] dp = new int[n + 1][m + 1];
        for (int i = 0; i <= n; i++) dp[i][0] = i;
        for (int j = 0; j <= m; j++) dp[0][j] = j;
        for (int i = 1; i <= n; i++) {
            for (int j = 1; j <= m; j++) {
                int substitution = sameWord(rawWords.get(i - 1), referenceWords.get(j - 1)) ? 0 : 1;
                dp[i][j] = Math.min(dp[i - 1][j] + 1,
                        Math.min(dp[i][j - 1] + 1, dp[i - 1][j - 1] + substitution));
            }
        }

        List<Map<String, Object>> mapped = new ArrayList<>();
        int i = n, j = m;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0) {
                int substitution = sameWord(rawWords.get(i - 1), referenceWords.get(j - 1)) ? 0 : 1;
                if (dp[i][j] == dp[i - 1][j - 1] + substitution) {
                    Map<String, Object> word = new LinkedHashMap<>(referenceResults.get(j - 1));
                    word.put("word", rawWords.get(i - 1));
                    word.put("reference_word", referenceWords.get(j - 1));
                    word.put("reference_alignment", substitution == 0 ? "match" : "corrected_substitution");
                    mapped.add(word);
                    i--; j--;
                    continue;
                }
            }
            if (i > 0 && dp[i][j] == dp[i - 1][j] + 1) {
                mapped.add(unalignedWord(rawWords.get(i - 1), "reference_unmatched"));
                i--;
            } else if (j > 0) {
                j--;
            }
        }
        Collections.reverse(mapped);
        return mapped;
    }

    private Map<String, Object> unalignedWord(String word, String reason) {
        Map<String, Object> unmatched = new LinkedHashMap<>();
        unmatched.put("word", word);
        unmatched.put("score", null);
        unmatched.put("error_type", "Unaligned");
        unmatched.put("alignment", reason);
        unmatched.put("unmatched_source", "sequence_alignment");
        return unmatched;
    }

    private List<String> tokenize(String text) {
        List<String> words = new ArrayList<>();
        if (text == null) return words;
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("[A-Za-z]+(?:['’\\-][A-Za-z]+)*")
                .matcher(text);
        while (matcher.find()) words.add(matcher.group());
        return words;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> providerWords(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        List<Map<String, Object>> words = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> rawMap)) continue;
            Map<String, Object> word = new LinkedHashMap<>((Map<String, Object>) rawMap);
            if (!String.valueOf(word.getOrDefault("word", "")).isBlank()) words.add(word);
        }
        return words;
    }

    private boolean sameWord(String left, String right) {
        return normalizeWord(left).equals(normalizeWord(right));
    }

    private String normalizeWord(String word) {
        return word == null ? "" : word.toLowerCase(Locale.ROOT)
                .replace('’', '\'')
                .replaceAll("[^a-z0-9]", "");
    }
    private String rootCause(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null) current = current.getCause();
        return current.getMessage() == null ? current.getClass().getSimpleName() : current.getMessage();
    }
    private String queryParam(URI uri, String name) {
        if (uri == null || uri.getRawQuery() == null) return "";
        for (String pair : uri.getRawQuery().split("&")) {
            String[] parts = pair.split("=", 2);
            if (parts.length == 2 && parts[0].equals(name)) {
                return URLDecoder.decode(parts[1], StandardCharsets.UTF_8);
            }
        }
        return "";
    }
    private void sendQuietly(WebSocketSession socket, Object payload) {
        try { send(socket, payload); } catch (Exception ignored) {}
    }
    private void send(WebSocketSession socket, Object payload) throws Exception {
        if (!socket.isOpen()) return;
        synchronized (socket) {
            socket.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
        }
    }

    private final class StreamContext {
        private final SessionState state;
        private final WebSocketSession socket;
        private final Map<String, TurnBuffer> turns = new ConcurrentHashMap<>();
        private byte[] ring = new byte[0];
        private TurnBuffer active;
        private int sequence;

        private StreamContext(SessionState state, WebSocketSession socket) {
            this.state = state;
            this.socket = socket;
        }

        private synchronized void appendPcm(byte[] pcm) {
            byte[] combined = new byte[Math.min(RING_CAPACITY_BYTES, ring.length + pcm.length)];
            int oldToKeep = Math.min(ring.length, combined.length - Math.min(pcm.length, combined.length));
            int pcmToKeep = combined.length - oldToKeep;
            System.arraycopy(ring, ring.length - oldToKeep, combined, 0, oldToKeep);
            System.arraycopy(pcm, pcm.length - pcmToKeep, combined, oldToKeep, pcmToKeep);
            ring = combined;
            if (active != null) {
                active.audio.writeBytes(pcm);
                if (active.stopped) {
                    active.tailRemaining -= pcm.length;
                    if (active.tailRemaining <= 0) {
                        active.audioReady = true;
                        active = null;
                    }
                }
            }
            tryStartReadyTurns();
        }

        private synchronized void startTurn(String turnId, String realtimeItemId) {
            if (turnId == null || turnId.isBlank()) return;
            TurnBuffer turn = new TurnBuffer(turnId, realtimeItemId, ++sequence);
            int preBytes = Math.min(PRE_ROLL_BYTES, ring.length);
            turn.audio.write(ring, ring.length - preBytes, preBytes);
            turns.put(turnId, turn);
            active = turn;
            sendQuietly(socket, Map.of("type", "turn.accepted", "turn_id", turnId));
        }

        private synchronized void stopTurn(String turnId) {
            TurnBuffer turn = turns.get(turnId);
            if (turn == null) return;
            turn.stopped = true;
            turn.tailRemaining = POST_ROLL_BYTES;
        }

        private synchronized void completeTranscript(String turnId, String text) {
            TurnBuffer turn = turns.get(turnId);
            if (turn == null) return;
            turn.transcript = text == null ? "" : text.trim();
            state.addConversationMessage("user", turn.transcript);
            tryStartReadyTurns();
        }

        private synchronized void finishStream() {
            if (active != null) {
                active.audioReady = true;
                active = null;
            }
            turns.values().forEach(turn -> {
                if (turn.stopped) turn.audioReady = true;
            });
            tryStartReadyTurns();
        }

        private void tryStartReadyTurns() {
            turns.values().stream()
                    .filter(turn -> turn.audioReady && !turn.transcript.isBlank() && !turn.scoringStarted)
                    .forEach(turn -> {
                        turn.scoringStarted = true;
                        scoreTurn(this, turn);
                    });
        }
    }

    private static final class TurnBuffer {
        private final String turnId;
        private final String realtimeItemId;
        private final int turnIndex;
        private final ByteArrayOutputStream audio = new ByteArrayOutputStream();
        private String transcript = "";
        private boolean stopped;
        private boolean audioReady;
        private boolean scoringStarted;
        private int tailRemaining;

        private TurnBuffer(String turnId, String realtimeItemId, int turnIndex) {
            this.turnId = turnId;
            this.realtimeItemId = realtimeItemId;
            this.turnIndex = turnIndex;
        }
    }
}
