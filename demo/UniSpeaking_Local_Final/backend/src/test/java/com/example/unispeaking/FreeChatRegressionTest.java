package com.example.unispeaking;

import com.example.unispeaking.controller.ScoringController;
import com.example.unispeaking.model.SessionState;
import com.example.unispeaking.service.SessionRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static org.hamcrest.Matchers.aMapWithSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "dashscope.api.key=", "bailian.workspace.id=", "bailian.model=qwen-realtime",
        "qwen.scoring.model=qwen-plus", "qwen.ielts.judge.model=qwen-plus",
        "xfyun.appid=", "xfyun.apikey=", "xfyun.apisecret="
})
@AutoConfigureMockMvc
class FreeChatRegressionTest {
    @Autowired MockMvc mvc;
    @Autowired SessionRegistry sessionRegistry;

    @Test
    void healthReportsOnlySafeCapabilityFlags() throws Exception {
        mvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", aMapWithSize(4)))
                .andExpect(jsonPath("$.java").value(true))
                .andExpect(jsonPath("$.qwenRealtimeConfigured").value(false))
                .andExpect(jsonPath("$.qwenScoringConfigured").value(false))
                .andExpect(jsonPath("$.xfyunConfigured").value(false));
    }

    @Test
    void modelProxyAcceptsOnlyTheDocumentedLocalFrontendOrigins() throws Exception {
        mvc.perform(get("/health").header(HttpHeaders.ORIGIN, "http://127.0.0.1:8080"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://127.0.0.1:8080"));

        mvc.perform(get("/health").header(HttpHeaders.ORIGIN, "https://attacker.example"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    @Test
    void healthCapabilityFlagsRequireEachProviderConfiguration() {
        ScoringController controller = new ScoringController();
        setHealthConfiguration(controller, "dash-key", "workspace", "realtime", "score", "judge",
                "xf-app", "xf-key", "xf-secret");
        assertEquals(Map.of(
                "java", true,
                "qwenRealtimeConfigured", true,
                "qwenScoringConfigured", true,
                "xfyunConfigured", true
        ), controller.health());

        setHealthConfiguration(controller, "dash-key", "", "realtime", "score", "",
                "xf-app", "xf-key", "");
        assertEquals(Map.of(
                "java", true,
                "qwenRealtimeConfigured", false,
                "qwenScoringConfigured", false,
                "xfyunConfigured", false
        ), controller.health());
    }

    private void setHealthConfiguration(ScoringController controller, String apiKey, String workspace,
                                        String realtimeModel, String scoringModel, String judgeModel,
                                        String xfyunAppId, String xfyunApiKey, String xfyunApiSecret) {
        ReflectionTestUtils.setField(controller, "apiKey", apiKey);
        ReflectionTestUtils.setField(controller, "bailianWorkspaceId", workspace);
        ReflectionTestUtils.setField(controller, "bailianModel", realtimeModel);
        ReflectionTestUtils.setField(controller, "qwenScoringModel", scoringModel);
        ReflectionTestUtils.setField(controller, "qwenIeltsJudgeModel", judgeModel);
        ReflectionTestUtils.setField(controller, "xfyunAppId", xfyunAppId);
        ReflectionTestUtils.setField(controller, "xfyunApiKey", xfyunApiKey);
        ReflectionTestUtils.setField(controller, "xfyunApiSecret", xfyunApiSecret);
    }

    @Test
    void existingFreeChatSessionContractRemainsAvailable() throws Exception {
        mvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scoring_enabled\":true,\"prompt\":\"travel\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.session_id").isString())
                .andExpect(jsonPath("$.conversation_id").isString())
                .andExpect(jsonPath("$.scoring_enabled").value(true))
                .andExpect(jsonPath("$.session_config.turn_detection.silence_duration_ms").value(800))
                .andExpect(jsonPath("$.session_config.input_audio_transcription.model").value("qwen3-asr-flash-realtime"));
    }

    @Test
    void freeChatCanBindTheProviderSessionToItsLocalJavaSession() throws Exception {
        String sessionId = "provider-binding-test";
        sessionRegistry.put(new SessionState(sessionId));

        mvc.perform(post("/api/sessions/{sessionId}/provider-session", sessionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"provider_session_id\":\"sess_provider_123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bound").value(true))
                .andExpect(jsonPath("$.session_id").value(sessionId));

        assertEquals("sess_provider_123", sessionRegistry.get(sessionId).getProviderSessionId());
    }
}
