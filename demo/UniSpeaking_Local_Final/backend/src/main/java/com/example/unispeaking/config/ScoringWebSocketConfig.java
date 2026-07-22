package com.example.unispeaking.config;

import com.example.unispeaking.service.ScoringStreamHandler;
import com.example.unispeaking.service.ielts.IeltsScoringStreamHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class ScoringWebSocketConfig implements WebSocketConfigurer {
    private final ScoringStreamHandler handler;
    private final IeltsScoringStreamHandler ieltsHandler;

    public ScoringWebSocketConfig(ScoringStreamHandler handler, IeltsScoringStreamHandler ieltsHandler) {
        this.handler = handler;
        this.ieltsHandler = ieltsHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/api/scoring-stream")
                .setAllowedOrigins("http://127.0.0.1:8080", "http://localhost:8080");
        registry.addHandler(ieltsHandler, "/api/ielts/scoring-stream")
                .setAllowedOrigins("http://127.0.0.1:8080", "http://localhost:8080");
    }
}
