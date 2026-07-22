package com.example.unispeaking.service.ielts;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class IeltsBandCalculatorTest {
    private final IeltsBandCalculator calculator = new IeltsBandCalculator();

    @Test
    void roundsOverallToNearestHalfBand() {
        assertEquals(6.5, calculator.calculate(6.0, 6.5, 6.5, 6.0).overallBand());
        assertEquals(7.0, calculator.calculate(6.5, 7.0, 7.0, 6.5).overallBand());
    }

    @Test
    void weightsAllFourDimensionsEqually() {
        var result = calculator.calculate(5.0, 6.0, 7.0, 8.0);
        assertEquals(6.5, result.rawAverage());
        assertEquals(6.5, result.overallBand());
    }

    @Test
    void missingDimensionDoesNotBecomeZeroAndSuppressesOverall() {
        var result = calculator.calculate(6.5, 6.0, 6.5, null);
        assertNull(result.rawAverage());
        assertNull(result.overallBand());
        assertEquals("PARTIAL", result.status());
        assertEquals("pronunciation", result.missingDimensions().getFirst());
    }

    @Test
    void rejectsInvalidBandInsteadOfCoercingIt() {
        assertThrows(IllegalArgumentException.class,
                () -> calculator.calculate(6.3, 6.0, 6.0, 6.0));
        assertThrows(IllegalArgumentException.class,
                () -> calculator.calculate(9.5, 6.0, 6.0, 6.0));
    }
}
