package com.unispeaking.scenariodemo.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class RealtimeBackendProxyTest {
    @Test
    void buildsTheOfficialBeijingWebRtcEndpoint() {
        assertEquals(
                "https://ws_abc.cn-beijing.maas.aliyuncs.com/api/v1/webrtc/realtime"
                        + "?model=qwen3.5-omni-plus-realtime",
                RealtimeBackendProxy.resolveEndpoint(
                        "", "ws_abc", "cn-beijing", "qwen3.5-omni-plus-realtime"));
    }

    @Test
    void acceptsAnExplicitEndpointOverride() {
        assertEquals(
                "https://gateway.example/realtime?model=custom",
                RealtimeBackendProxy.resolveEndpoint(
                        "https://gateway.example/realtime?model=custom",
                        "", "cn-beijing", "ignored"));
    }

    @Test
    void rejectsMissingWorkspaceWhenNoOverrideExists() {
        assertThrows(IllegalStateException.class,
                () -> RealtimeBackendProxy.resolveEndpoint(
                        "", "", "cn-beijing", "qwen3.5-omni-plus-realtime"));
    }
}
