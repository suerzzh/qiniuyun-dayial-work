package com.unispeaking.scenariodemo.domain;

import java.time.Instant;

public record ConversationTurn(int number, Speaker speaker, String text, Instant occurredAt) {
}
