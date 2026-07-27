package com.unispeaking.scenariodemo.service;

public class SessionNotFoundException extends RuntimeException {
    public SessionNotFoundException(String id) {
        super("Scenario session not found: " + id);
    }
}
