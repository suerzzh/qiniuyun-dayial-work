package com.example.unispeaking.config;

import com.example.unispeaking.service.ScoringStreamHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class ScoringWebSocketConfig implements WebSocketConfigurer {
    private final ScoringStreamHandler handler;

    public ScoringWebSocketConfig(ScoringStreamHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/api/scoring-stream").setAllowedOriginPatterns("*");
    }
}
