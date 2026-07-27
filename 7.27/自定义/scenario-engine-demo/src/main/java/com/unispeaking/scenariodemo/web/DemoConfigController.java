package com.unispeaking.scenariodemo.web;

import com.unispeaking.scenariodemo.domain.PromptProfile;
import com.unispeaking.scenariodemo.prompt.PromptProfileDefaults;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/demo/config")
public class DemoConfigController {
    private final PromptProfileDefaults promptDefaults;

    public DemoConfigController(PromptProfileDefaults promptDefaults) {
        this.promptDefaults = promptDefaults;
    }

    @GetMapping
    public PromptProfile get() {
        return promptDefaults.get();
    }
}
