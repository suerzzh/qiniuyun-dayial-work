package com.unispeaking.scenariodemo.web;

import com.unispeaking.scenariodemo.domain.PromptProfile;
import com.unispeaking.scenariodemo.domain.ScenarioSession;
import com.unispeaking.scenariodemo.domain.Speaker;
import com.unispeaking.scenariodemo.service.LiveScenarioService;
import com.unispeaking.scenariodemo.service.SessionNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/demo/sessions")
public class ScenarioDemoController {
    private final LiveScenarioService service;

    public ScenarioDemoController(LiveScenarioService service) {
        this.service = service;
    }

    @PostMapping
    public ScenarioSession create(@org.springframework.web.bind.annotation.RequestBody(required = false) CreateRequest request) {
        return service.create(
                request == null ? null : request.topic(),
                request == null ? null : request.profile());
    }

    @GetMapping("/{id}")
    public ScenarioSession get(@PathVariable String id) { return service.get(id); }

    @PostMapping("/{id}/transcripts")
    public ScenarioSession transcript(@PathVariable String id, @org.springframework.web.bind.annotation.RequestBody TranscriptRequest request) {
        return service.acceptTranscript(id, request.speaker(), request.transcript());
    }

    @PostMapping("/{id}/reset")
    public ScenarioSession reset(@PathVariable String id) { return service.reset(id); }

    @PostMapping("/{id}/close")
    public ScenarioSession close(@PathVariable String id) { return service.close(id); }

    @ExceptionHandler(SessionNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse notFound(RuntimeException exception) {
        return new ErrorResponse(exception.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse badRequest(RuntimeException exception) {
        return new ErrorResponse(exception.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ErrorResponse unavailable(RuntimeException exception) {
        return new ErrorResponse(exception.getMessage());
    }

    public record ErrorResponse(String message) {
    }

    public record TranscriptRequest(Speaker speaker, String transcript) {
    }

    public record CreateRequest(String topic, PromptProfile profile) {
    }
}
