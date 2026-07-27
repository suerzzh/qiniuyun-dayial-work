package com.unispeaking.scenariodemo.prompt;

import com.unispeaking.scenariodemo.domain.PromptProfile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PromptProfileDefaults {
    private final PromptProfile defaults;

    public PromptProfileDefaults(
            @Value("${demo.prompts.defaults.coach:clara}") String coach,
            @Value("${demo.prompts.defaults.difficulty:basic}") String difficulty,
            @Value("${demo.prompts.defaults.speed:1.0}") String speed,
            @Value("${demo.prompts.defaults.correction:moderate}") String correction) {
        defaults = new PromptProfile(coach, difficulty, speed, correction, "");
    }

    public PromptProfile resolve(PromptProfile requested) {
        return requested == null ? defaults : requested;
    }

    public PromptProfile get() {
        return defaults;
    }
}
