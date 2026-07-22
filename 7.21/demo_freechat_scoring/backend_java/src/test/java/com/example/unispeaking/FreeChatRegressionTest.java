package com.example.unispeaking;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class FreeChatRegressionTest {
    @Autowired MockMvc mvc;

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
}
