package com.example.unispeaking;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class IeltsAttemptControllerTest {
    @Autowired MockMvc mvc;
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void createsAndReadsAnInMemoryIeltsAttemptContext() throws Exception {
        String body = mvc.perform(post("/api/ielts/attempts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"full_mock\",\"paper_snapshot\":{\"paperId\":\"p1\",\"promptVersion\":\"ielts-examiner-test\",\"timingProfile\":\"accelerated_demo\"}}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.scoring_status").value("COLLECTING"))
                .andExpect(jsonPath("$.scoring_ws_url").isString())
                .andExpect(jsonPath("$.realtime_session_config.turn_detection.type").value("server_vad"))
                .andExpect(jsonPath("$.realtime_session_config.turn_detection.silence_duration_ms").value(800))
                .andExpect(jsonPath("$.realtime_session_config.turn_detection.create_response").value(false))
                .andExpect(jsonPath("$.realtime_session_config.instructions").value(org.hamcrest.Matchers.containsString("Speak only English")))
                .andExpect(jsonPath("$.prompt_version").value("ielts-examiner-test"))
                .andExpect(jsonPath("$.timing_profile").value("accelerated_demo"))
                .andReturn().getResponse().getContentAsString();
        String attemptId = json.readTree(body).path("attempt_id").asText();
        mvc.perform(get("/api/ielts/attempts/{id}", attemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attempt_id").value(attemptId))
                .andExpect(jsonPath("$.mode").value("full_mock"))
                .andExpect(jsonPath("$.prompt_version").value("ielts-examiner-test"))
                .andExpect(jsonPath("$.timing_profile").value("accelerated_demo"))
                .andExpect(jsonPath("$.turns").isArray());
    }

    @Test
    void fullMockPaperSnapshotMayContainJsonNullValues() throws Exception {
        mvc.perform(post("/api/ielts/attempts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"mode":"full_mock","paper_snapshot":{
                                  "paperId":"p-null","selectedPart":null,
                                  "parts":{"part1":{"topic":null}}
                                }}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attempt_id").isString());
    }
}
