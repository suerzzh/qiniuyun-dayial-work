package com.example.unispeaking;

import com.example.unispeaking.model.ielts.IeltsAttempt;
import com.example.unispeaking.model.ielts.IeltsDimensionResult;
import com.example.unispeaking.model.ielts.IeltsReport;
import com.example.unispeaking.model.ielts.IeltsScoringStatus;
import com.example.unispeaking.model.ielts.TaskAchievementResult;
import com.example.unispeaking.service.ielts.IeltsAttemptRegistry;
import com.example.unispeaking.service.ielts.IeltsRadarMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class IeltsAttemptControllerTest {
    @Autowired MockMvc mvc;
    @Autowired IeltsAttemptRegistry registry;
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

    @Test
    void completedReportExposesOfficialTaskAchievementAndRadarJsonContracts() throws Exception {
        String attemptId = "att-json-report";
        IeltsAttempt attempt = new IeltsAttempt(attemptId, "full_mock", Map.of());
        IeltsDimensionResult fc = dimension("FC", 6.5);
        IeltsDimensionResult lr = dimension("LR", 6.0);
        IeltsDimensionResult gra = dimension("GRA", 6.5);
        IeltsDimensionResult pronunciation = dimension("P", 6.0);
        Map<String, IeltsDimensionResult> officialDimensions = new LinkedHashMap<>();
        officialDimensions.put("fluencyCoherence", fc);
        officialDimensions.put("lexicalResource", lr);
        officialDimensions.put("grammaticalRangeAccuracy", gra);
        officialDimensions.put("pronunciation", pronunciation);
        TaskAchievementResult taskAchievement = new TaskAchievementResult(
                82, 0.78, List.of("回答覆盖题目要求"), List.of("部分观点缺少例子"), null);
        IeltsReport report = new IeltsReport(
                attemptId, IeltsScoringStatus.COMPLETE, 6.5, List.of(6.0, 6.5), 0.72,
                fc, lr, gra, pronunciation, Map.copyOf(officialDimensions), taskAchievement,
                new IeltsRadarMapper().map(fc, lr, gra, pronunciation, taskAchievement),
                List.of(), List.of(), Map.of(), List.of(), List.of(), "test disclaimer");
        attempt.setReport(report);
        registry.put(attempt);

        mvc.perform(get("/api/ielts/attempts/{id}/report", attemptId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.officialDimensions.fluencyCoherence.band").value(6.5))
                .andExpect(jsonPath("$.taskAchievement.score").value(82))
                .andExpect(jsonPath("$.radarDimensions[4].code").value("TA"))
                .andExpect(jsonPath("$.radarDimensions[4].score").value(82));
    }

    private static IeltsDimensionResult dimension(String code, double band) {
        return new IeltsDimensionResult(code, band, 0.75, List.of(), List.of(), null);
    }
}
