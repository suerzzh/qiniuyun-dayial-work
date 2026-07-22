package com.example.unispeaking.controller;

import com.example.unispeaking.model.SessionState;
import com.example.unispeaking.service.QwenScoringService;
import com.example.unispeaking.service.SessionRegistry;
import com.example.unispeaking.service.XfyunIseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.*;

@RestController
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class ScoringController {

    private static final String ENGLISH_COACH_SYSTEM_PROMPT = """
You are an AI English speaking coach for adult Chinese learners.

Teaching behavior:
1. Speak mainly in natural, conversational English.
2. Keep every reply concise: normally one or two short sentences and no more
   than about 30 English words. Ask only one question at a time.
3. Adapt difficulty continuously. If the learner hesitates, uses very simple
   English, or makes repeated mistakes, use shorter sentences and easier words.
   As the learner becomes more fluent and accurate, gradually introduce richer
   vocabulary and slightly more complex sentence patterns.
4. When the learner mixes Chinese and English or cannot express an idea in
   English, first provide one natural English sentence that expresses the same
   meaning. You may invite the learner to repeat it once, but repetition is
   always optional. If the learner does not repeat it, responds differently,
   changes the topic, or stays silent, accept that immediately and continue the
   conversation naturally. Never keep asking the learner to repeat a sentence
   and never block the conversation on a drill. Use a very short Chinese
   explanation only when it is genuinely helpful.
5. Correct gently. Prioritize only the most useful one correction at a time.
   Show a natural corrected version instead of giving a long grammar lecture.
6. Keep the conversation moving with warm, specific follow-up questions.
7. Stay anchored to the current topic. Once you or the learner introduces a
   topic, keep your next replies and questions clearly connected to that topic
   unless the learner explicitly changes topics, asks for a different topic,
   or says they do not know what to say. Do not suddenly switch from one topic
   to another just to keep the conversation moving.
8. Remember earlier details and reuse them naturally in later turns.
9. Use clear, easy-to-pronounce spoken language. Avoid long lists, long
   paragraphs, and long compound sentences.
10. Never interrupt while the learner is hesitating or searching for words.
    Sounds and phrases such as "um", "uh", "hmm", "er", "嗯", "啊", "呃",
    and "让我想想" mean the learner still holds the speaking turn. Wait
    patiently and do not complete the learner's sentence, correct them, or begin
    a reply during these hesitation signals.
11. A brief pause is not permission to take over. If the learner becomes truly
    silent long enough for the system to invite a response, use one gentle,
    short prompt such as "Take your time" or "What would you like to say?".
    Never criticize the silence or mention the learner's filler sounds.
12. At the beginning of a new call, speak first. Give one short, warm greeting,
    briefly introduce yourself as the learner's English speaking coach, then
    choose one simple, concrete conversation topic yourself and ask one easy
    question about it. Vary the opening every call: do not reuse the same
    greeting, wording, or default question such as "How are you feeling today?"
    in nearby calls. Start with a real topic, such as today's plan, breakfast,
    the commute, weather, weekend plans, hobbies, work, study, or a small daily
    choice. Match the saved learner level and do not give instructions or a
    long introduction.
13. Obey the highest-priority Target-language response policy below whenever
    the learner asks for another language.

Conversation recovery strategies:
Use the following as flexible behavior guidelines, not fixed scripts. Vary the
wording naturally, fit the current topic, and avoid repeating the same recovery
phrase in nearby turns.
1. If the learner is silent, reduce pressure and offer one easy opening. A
   possible style is: "No worries. You can say one simple thing about this."
   If there is already a topic, keep the prompt on that topic.
2. If the learner answers in Chinese, first show that you understood. Then give
   one concise, natural English way to express the same meaning and continue
   the conversation. A possible transition is: "I understand. You can try to
   say it in English like this..."
3. If the learner says they do not know or cannot think of a topic, first offer
   two or three easy choices within the current topic. Only offer a new topic
   if the learner asks to change topics or the current topic is clearly stuck.
4. If the learner is very hesitant or fragmented, lower the task difficulty
   immediately. Ask for only one short idea, without forcing repetition. A
   possible style is: "Take your time. Just say one simple sentence."
5. If the audio is unclear or speech recognition fails, use one light,
   non-judgmental retry prompt. For example: "Sorry, I didn't catch that. Could
   you say it again?"
6. After any recovery prompt, accept the learner's next response even if it
   does not follow the suggestion exactly. The conversation must remain open
   and easy to continue.

Speech-only output contract:
1. Your response is played aloud immediately. Output only words that should be
   spoken naturally in a real conversation.
2. Never use Markdown or any visual formatting.
3. Never output asterisks, hash signs, bullet points, numbered lists, table
   syntax, code blocks, headings, underscores used for emphasis, or decorative
   separators.
4. In particular, never output formatting patterns such as double asterisks,
   single asterisks, triple hash signs, leading hyphens, or list prefixes such
   as "1.".
5. Never say formatting-related words such as "asterisk", "star symbol", etc.
""";

    @Value("${dashscope.api.key}")
    private String apiKey;

    @Value("${bailian.workspace.id}")
    private String bailianWorkspaceId;

    @Value("${bailian.model}")
    private String bailianModel;

    @Value("${qwen.scoring.model}")
    private String qwenScoringModel;

    @Value("${qwen.ielts.judge.model}")
    private String qwenIeltsJudgeModel;

    @Value("${xfyun.appid}")
    private String xfyunAppId;

    @Value("${xfyun.apikey}")
    private String xfyunApiKey;

    @Value("${xfyun.apisecret}")
    private String xfyunApiSecret;

    @Autowired
    private XfyunIseService xfyunIseService;

    @Autowired
    private QwenScoringService qwenScoringService;

    @Autowired
    private SessionRegistry sessionRegistry;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @GetMapping("/health")
    public Map<String, Boolean> health() {
        return Map.of(
                "java", true,
                "qwenRealtimeConfigured", allConfigured(apiKey, bailianWorkspaceId, bailianModel),
                "qwenScoringConfigured", allConfigured(apiKey, qwenScoringModel, qwenIeltsJudgeModel),
                "xfyunConfigured", allConfigured(xfyunAppId, xfyunApiKey, xfyunApiSecret)
        );
    }

    private boolean allConfigured(String... values) {
        return Arrays.stream(values).allMatch(value -> value != null
                && !value.isBlank()
                && !"your_api_key_here".equals(value.trim()));
    }

    @PostMapping("/api/sessions")
    public Map<String, Object> createSession(@RequestBody Map<String, Object> requestBody) {
        String sessionId = UUID.randomUUID().toString().replace("-", "");
        
        String reqConvId = (String) requestBody.get("conversation_id");
        String conversationId = (reqConvId != null && !reqConvId.trim().isEmpty()) 
                ? reqConvId.trim() 
                : UUID.randomUUID().toString().replace("-", "");

        SessionState state = new SessionState(sessionId);
        state.setConversationId(conversationId);
        state.setScoringEnabled(Boolean.TRUE.equals(requestBody.get("scoring_enabled")));
        String lessonFocus = requestBody.get("prompt") instanceof String
                ? ((String) requestBody.get("prompt")).trim() : "";
        state.setLessonFocus(lessonFocus);
        sessionRegistry.put(state);

        Map<String, Object> response = new HashMap<>();
        response.put("session_id", sessionId);
        response.put("conversation_id", conversationId);
        response.put("created_at", new Date().toString());
        response.put("history", Collections.emptyList());
        response.put("scoring_enabled", state.isScoringEnabled());

        // Learner Profile
        Map<String, Object> learnerProfile = new HashMap<>();
        learnerProfile.put("level", 3);
        learnerProfile.put("label", "CET-4 (B1-B2)");
        response.put("learner_profile", learnerProfile);

        // Session Config (matching Python RealtimeBusinessLogic build_session_config)
        Map<String, Object> sessionConfig = new HashMap<>();
        sessionConfig.put("voice", "Tina");
        sessionConfig.put("input_audio_format", "pcm");
        
        Map<String, String> inputAudioTrans = new HashMap<>();
        inputAudioTrans.put("model", "qwen3-asr-flash-realtime");
        sessionConfig.put("input_audio_transcription", inputAudioTrans);

        // Instructions
        String baseInstructions = ENGLISH_COACH_SYSTEM_PROMPT;
        
        String userPrompt = (String) requestBody.get("prompt");
        String scenarioRequirements = requestBody.get("scenario_requirements") instanceof String
                ? ((String) requestBody.get("scenario_requirements")).trim() : "";
        String instructions = baseInstructions + "\n\nAdaptive language level:\n" +
                "The learner's current level is 3: CET-4 (B1-B2). Use vocabulary and sentence structures appropriate for this level. Level 4 means ordinary CET-4 vocabulary and is the default. Do not change difficulty because of one unusual answer. Evaluate a pattern across at least three learner turns. Consistent confused, fragmented, heavily Chinese-mixed, or highly hesitant answers support lowering one level. Consistent fluent, accurate, detailed answers support raising one level. When there is enough multi-turn evidence, call update_learner_level. Never request a jump of more than one level. Do not announce the internal numeric level unless the learner asks.";
        if (!scenarioRequirements.isEmpty()) {
            instructions += "\n\nScenario-specific learner and teaching requirements:\n" +
                    "The following user-provided requirements override the general assumptions above about " +
                    "learner age, difficulty, permitted Chinese support, role, topic, and teaching style. " +
                    "Keep the conversation anchored to them unless they conflict with safety requirements.\n" +
                    scenarioRequirements;
        }
        if (userPrompt != null && !userPrompt.trim().isEmpty()) {
            instructions += "\n\nLesson focus:\n" + userPrompt.trim();
        }
        sessionConfig.put("instructions", instructions);

        sessionConfig.put("modalities", Arrays.asList("text", "audio"));
        sessionConfig.put("output_audio_format", "pcm");
        sessionConfig.put("max_tokens", 128);
        sessionConfig.put("temperature", 0.7);

        // VAD
        Map<String, Object> turnDetection = new HashMap<>();
        turnDetection.put("prefix_padding_ms", 500);
        turnDetection.put("silence_duration_ms", 800);
        turnDetection.put("threshold", 0.5);
        turnDetection.put("type", "semantic_vad");
        sessionConfig.put("turn_detection", turnDetection);

        // Tools
        List<Map<String, Object>> tools = new ArrayList<>();
        Map<String, Object> updateLevelTool = new HashMap<>();
        updateLevelTool.put("type", "function");
        
        Map<String, Object> functionDef = new HashMap<>();
        functionDef.put("name", "update_learner_level");
        functionDef.put("description", "Update the learner's persistent English level only after at least three turns.");
        
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");
        
        Map<String, Object> properties = new HashMap<>();
        Map<String, Object> reqLevel = new HashMap<>();
        reqLevel.put("type", "integer");
        reqLevel.put("minimum", 1);
        reqLevel.put("maximum", 6);
        reqLevel.put("description", "1: CET-3, 2: CET-4-Simple, 3: CET-4, 4: CET-6, 5: TOEFL-Simple, 6: TOEFL");
        properties.put("requested_level", reqLevel);
        
        parameters.put("properties", properties);
        parameters.put("required", Collections.singletonList("requested_level"));
        
        functionDef.put("parameters", parameters);
        updateLevelTool.put("function", functionDef);
        tools.add(updateLevelTool);
        
        sessionConfig.put("tools", tools);

        response.put("session_config", sessionConfig);

        return response;
    }

    @PostMapping(value = "/api/realtime")
    public ResponseEntity<String> realtimeProxy(@RequestBody String sdpOffer) {
        if (apiKey == null || apiKey.trim().isEmpty() || "your_api_key_here".equals(apiKey)) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("DASHSCOPE_API_KEY is not configured in .env");
        }

        try {
            String url = String.format("https://%s.cn-beijing.maas.aliyuncs.com/api/v1/webrtc/realtime?model=%s",
                    bailianWorkspaceId, bailianModel);

            // Normalize SDP offer to strict CRLF (\r\n) format
            String formattedSdp = sdpOffer.replace("\r\n", "\n").replace("\n", "\r\n");

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/sdp")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(formattedSdp))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            // Normalize SDP answer to strict CRLF format as well
            String formattedAnswer = response.body().replace("\r\n", "\n").replace("\n", "\r\n");
            
            return ResponseEntity.status(response.statusCode())
                    .header("Content-Type", "application/sdp")
                    .body(formattedAnswer);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to proxy WebRTC SDP offer: " + e.getMessage());
        }
    }

    @PostMapping(value = "/api/sessions/{sessionId}/turns/{turnId}/score", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> scoreTurn(
            @PathVariable String sessionId,
            @PathVariable String turnId,
            @RequestParam("audio") MultipartFile audioFile,
            @RequestParam("text") String text,
            @RequestParam(value = "turn_index", defaultValue = "0") int turnIndex
    ) {
        SessionState session = sessionRegistry.get(sessionId);
        if (session == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Session not found in memory");
        }

        try {
            byte[] audioBytes = audioFile.getBytes();

            if (!containsEnglishLetter(text)) {
                Map<String, Object> result = buildUnscorableTurn(
                        text,
                        turnIndex,
                        "语音转写未识别为有效英文，本句未计入总分。"
                );
                session.getTurnEvaluations().put(turnId, result);
                return ResponseEntity.ok(result);
            }

            boolean shortResponse = countEnglishWords(text) <= 2;

            // Run evaluations in parallel
            var iseFuture = xfyunIseService.evaluatePronunciation(audioBytes, text)
                    .handle((value, error) -> providerOutcome(value, error));
            var qwenFuture = qwenScoringService.evaluateGrammar(text)
                    .handle((value, error) -> providerOutcome(value, error));

            // A provider failure is represented as an unscorable turn instead
            // of failing the whole report with HTTP 500.
            var combinedFuture = iseFuture.thenCombine(qwenFuture, (iseOutcome, qwenOutcome) -> {
                Map<String, Object> turnResult = new HashMap<>();
                turnResult.put("pronunciation", iseOutcome.getOrDefault("result", Collections.emptyMap()));
                turnResult.put("grammar", qwenOutcome.getOrDefault("result", Collections.emptyMap()));
                turnResult.put("text", text);
                turnResult.put("turn_index", turnIndex);
                turnResult.put("short_response", shortResponse);

                List<String> errors = new ArrayList<>();
                if (iseOutcome.containsKey("error")) {
                    errors.add("发音评测失败");
                }
                if (qwenOutcome.containsKey("error")) {
                    errors.add("语法与词汇评测失败");
                }

                boolean scorable = errors.isEmpty();
                turnResult.put("scorable", scorable);
                turnResult.put("status", scorable ? "scored" : "unscorable");
                if (!scorable) {
                    turnResult.put(
                            "error_reason",
                            String.join("、", errors) + "，本句未计入总分。"
                    );
                }
                return turnResult;
            });

            Map<String, Object> result = combinedFuture.join();
            session.getTurnEvaluations().put(turnId, result);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, String> errMap = new HashMap<>();
            errMap.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errMap);
        }
    }

    @GetMapping("/api/sessions/{sessionId}/report")
    public ResponseEntity<?> getSessionReport(@PathVariable String sessionId) {
        SessionState session = sessionRegistry.get(sessionId);
        if (session == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Session not found");
        }

        List<Map<String, Object>> turns = new ArrayList<>(session.getTurnEvaluations().values());
        turns.sort(Comparator.comparingInt(turn -> {
            Object value = turn.get("turn_index");
            return value instanceof Number ? ((Number) value).intValue() : Integer.MAX_VALUE;
        }));
        
        double pronWeighted = 0, pronWeight = 0, languageWeighted = 0, languageWeight = 0;
        double accuracyWeighted = 0, fluencyWeighted = 0, integrityWeighted = 0;
        double grammarWeighted = 0, vocabWeighted = 0, naturalnessWeighted = 0;
        int eligibleCount = 0;

        for (Map<String, Object> turn : turns) {
            double weight = turn.get("aggregation_weight") instanceof Number
                    ? ((Number) turn.get("aggregation_weight")).doubleValue()
                    : Math.max(3, Math.min(30, countEnglishWords(String.valueOf(turn.getOrDefault("text", "")))));
            Map<String, Object> pron = turn.get("pronunciation") instanceof Map
                    ? (Map<String, Object>) turn.get("pronunciation") : Collections.emptyMap();
            if (!pron.isEmpty()) {
                double performance = turn.get("pronunciation_performance") instanceof Number
                        ? ((Number) turn.get("pronunciation_performance")).doubleValue()
                        : 0.6 * getDoubleFromMap(pron, "accuracy_score") + 0.4 * getDoubleFromMap(pron, "fluency_score");
                pronWeighted += performance * weight;
                accuracyWeighted += getDoubleFromMap(pron, "accuracy_score") * weight;
                fluencyWeighted += getDoubleFromMap(pron, "fluency_score") * weight;
                integrityWeighted += getDoubleFromMap(pron, "integrity_score") * weight;
                pronWeight += weight;
            }
            Map<String, Object> language = turn.get("grammar") instanceof Map
                    ? (Map<String, Object>) turn.get("grammar") : Collections.emptyMap();
            if (!Boolean.TRUE.equals(turn.get("short_response")) && !language.isEmpty()) {
                double quality = turn.get("language_quality") instanceof Number
                        ? ((Number) turn.get("language_quality")).doubleValue()
                        : 0.55 * getDoubleFromMap(language, "grammar_score")
                            + 0.25 * getDoubleFromMap(language, "vocab_score")
                            + 0.20 * getDoubleFromMap(language, "naturalness_score");
                languageWeighted += quality * weight;
                grammarWeighted += getDoubleFromMap(language, "grammar_score") * weight;
                vocabWeighted += getDoubleFromMap(language, "vocab_score") * weight;
                naturalnessWeighted += getDoubleFromMap(language, "naturalness_score") * weight;
                languageWeight += weight;
            }
            if (Boolean.TRUE.equals(turn.get("eligible_for_aggregation")) || !pron.isEmpty() || !language.isEmpty()) {
                eligibleCount++;
            }
        }

        Double pronunciationPerformance = pronWeight > 0 ? round1(pronWeighted / pronWeight) : null;
        Double languageQuality = languageWeight > 0 ? round1(languageWeighted / languageWeight) : null;
        Map<String, Object> taskPerformance = Collections.emptyMap();
        if (session.isScoringEnabled() && !session.getConversationMessages().isEmpty()) {
            try {
                taskPerformance = qwenScoringService.evaluateTaskPerformance(
                        session.getLessonFocus(), session.getConversationMessages()).join();
            } catch (Exception ignored) {
                taskPerformance = Map.of("status", "provider_failed");
            }
        }
        Double taskScore = taskPerformance.get("task_performance_score") instanceof Number
                ? ((Number) taskPerformance.get("task_performance_score")).doubleValue() : null;
        Integer overall = pronunciationPerformance != null && languageQuality != null && taskScore != null
                ? (int) Math.round(0.40 * pronunciationPerformance + 0.35 * languageQuality + 0.25 * taskScore)
                : null;

        Map<String, Object> report = new HashMap<>();
        report.put("overall_score", overall);
        report.put("pronunciation_performance", pronunciationPerformance);
        report.put("language_quality", languageQuality);
        report.put("task_performance", taskScore);
        report.put("task_details", taskPerformance);
        report.put("avg_pron_accuracy", pronWeight > 0 ? round1(accuracyWeighted / pronWeight) : null);
        report.put("avg_pron_fluency", pronWeight > 0 ? round1(fluencyWeighted / pronWeight) : null);
        report.put("avg_pron_integrity", pronWeight > 0 ? round1(integrityWeighted / pronWeight) : null);
        report.put("avg_pron_score", pronunciationPerformance);
        report.put("avg_grammar_score", languageWeight > 0 ? round1(grammarWeighted / languageWeight) : null);
        report.put("avg_vocab_score", languageWeight > 0 ? round1(vocabWeighted / languageWeight) : null);
        report.put("avg_naturalness_score", languageWeight > 0 ? round1(naturalnessWeighted / languageWeight) : null);
        report.put("turns", turns);
        report.put("scored_turn_count", eligibleCount);
        report.put("unscored_turn_count", turns.size() - eligibleCount);
        report.put("effective_turn_count", eligibleCount);
        report.put("total_turn_count", turns.size());

        return ResponseEntity.ok(report);
    }

    @DeleteMapping("/api/sessions/{sessionId}")
    public ResponseEntity<?> deleteSession(@PathVariable String sessionId) {
        SessionState state = sessionRegistry.remove(sessionId);
        if (state != null) state.setEnded(true);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/sessions/{sessionId}/events")
    public ResponseEntity<?> rememberEvent(
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> eventBody
    ) {
        SessionState session = sessionRegistry.get(sessionId);
        if (session == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Session not found"));
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("stored", true);
        response.put("session_message_count", 0);
        response.put("learner_turns_since_review", 0);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/api/sessions/{sessionId}/latency")
    public ResponseEntity<?> recordLatency(
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> latencyMetric
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("recorded", true));
    }

    @PostMapping("/api/sessions/{sessionId}/quality")
    public ResponseEntity<?> recordQuality(
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> qualityMetric
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("recorded", true));
    }

    @PostMapping("/api/sessions/{sessionId}/tools/learner-level")
    public ResponseEntity<?> updateLearnerLevel(
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> requestBody
    ) {
        Map<String, Object> response = new HashMap<>();
        response.put("applied", false);
        response.put("reason", "Level update not implemented in Java yet");
        return ResponseEntity.ok(response);
    }

    private double getDoubleFromMap(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val instanceof Number) {
            return ((Number) val).doubleValue();
        }
        return 0.0;
    }

    private double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private boolean containsEnglishLetter(String text) {
        return text != null && text.matches(".*[A-Za-z].*");
    }

    private int countEnglishWords(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        String normalized = text.trim().replaceAll("[^A-Za-z']+", " ");
        if (normalized.isBlank()) {
            return 0;
        }
        return normalized.split("\\s+").length;
    }

    private Map<String, Object> providerOutcome(Map<String, Object> result, Throwable error) {
        Map<String, Object> outcome = new HashMap<>();
        if (error == null) {
            outcome.put("result", result == null ? Collections.emptyMap() : result);
        } else {
            outcome.put("error", rootCauseMessage(error));
        }
        return outcome;
    }

    private String rootCauseMessage(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current.getMessage() == null
                ? current.getClass().getSimpleName()
                : current.getMessage();
    }

    private Map<String, Object> buildUnscorableTurn(
            String text,
            int turnIndex,
            String reason
    ) {
        Map<String, Object> result = new HashMap<>();
        result.put("pronunciation", Collections.emptyMap());
        result.put("grammar", Collections.emptyMap());
        result.put("text", text);
        result.put("turn_index", turnIndex);
        result.put("short_response", countEnglishWords(text) <= 2);
        result.put("scorable", false);
        result.put("status", "unscorable");
        result.put("error_reason", reason);
        return result;
    }
}
