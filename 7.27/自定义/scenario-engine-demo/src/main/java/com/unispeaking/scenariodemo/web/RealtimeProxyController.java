package com.unispeaking.scenariodemo.web;

import com.unispeaking.scenariodemo.service.RealtimeBackendProxy;
import com.unispeaking.scenariodemo.service.LiveScenarioService;
import com.unispeaking.scenariodemo.service.RealtimeSessionConfigFactory;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/realtime")
public class RealtimeProxyController {
    private final RealtimeBackendProxy proxy;
    private final RealtimeSessionConfigFactory configFactory;
    private final LiveScenarioService scenarioService;

    public RealtimeProxyController(
            RealtimeBackendProxy proxy,
            RealtimeSessionConfigFactory configFactory,
            LiveScenarioService scenarioService) {
        this.proxy = proxy;
        this.configFactory = configFactory;
        this.scenarioService = scenarioService;
    }

    @GetMapping("/config/{sessionId}")
    public RealtimeSessionConfigFactory.RealtimeSessionConfiguration config(
            @PathVariable String sessionId) {
        return configFactory.create(scenarioService.get(sessionId));
    }

    @PostMapping("/connect")
    public ResponseEntity<?> connect(@RequestBody ConnectRequest request) {
        try {
            RealtimeBackendProxy.ProxyResponse response = proxy.connect(request.offerSdp());
            if (response.status() < 200 || response.status() >= 300) {
                return ResponseEntity.status(response.status())
                        .body(Map.of("message", "Qwen Realtime connection failed: " + response.body()));
            }
            return ResponseEntity.ok(new ConnectResponse(response.body()));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
        } catch (IllegalStateException exception) {
            return ResponseEntity.status(503).body(Map.of("message", exception.getMessage()));
        }
    }

    public record ConnectRequest(String offerSdp) {
    }

    public record ConnectResponse(String answerSdp) {
    }
}
