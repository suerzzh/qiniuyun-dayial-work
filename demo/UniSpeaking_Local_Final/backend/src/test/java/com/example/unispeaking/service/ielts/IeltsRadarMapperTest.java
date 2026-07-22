package com.example.unispeaking.service.ielts;

import com.example.unispeaking.model.ielts.IeltsDimensionResult;
import com.example.unispeaking.model.ielts.RadarDimension;
import com.example.unispeaking.model.ielts.TaskAchievementResult;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class IeltsRadarMapperTest {
    private final IeltsRadarMapper mapper = new IeltsRadarMapper();

    @Test
    void normalizesOfficialBandsAndKeepsTaskScore() {
        var radar = mapper.map(dimension(6.5), dimension(6.0), dimension(6.5), dimension(7.0),
                new TaskAchievementResult(82, 0.78, List.of("切题"), List.of(), null));
        assertEquals(List.of(72, 67, 72, 78, 82), radar.stream().map(RadarDimension::score).toList());
        assertEquals(List.of("FC", "LR", "GRA", "P", "TA"), radar.stream().map(RadarDimension::code).toList());
    }

    @Test
    void missingDimensionRemainsNullInsteadOfZero() {
        var radar = mapper.map(dimension(6.5), dimension(6.0), dimension(6.5),
                IeltsDimensionResult.unavailable("P", "missing"), TaskAchievementResult.unavailable("missing"));
        assertNull(radar.get(3).score());
        assertNull(radar.get(4).score());
    }

    @Test
    void rejectsNonIntegerOrOutOfRangeTaskScores() {
        assertThrows(IllegalArgumentException.class, () -> TaskAchievementResult.validate(-1));
        assertThrows(IllegalArgumentException.class, () -> TaskAchievementResult.validate(101));
    }

    private static IeltsDimensionResult dimension(double band) {
        return new IeltsDimensionResult("X", band, 0.8, List.of(), List.of(), null);
    }
}
