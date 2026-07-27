package com.unispeaking.scenariodemo.service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class RealtimeBackendProxy {
    private static final Pattern WORKSPACE_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{3,128}$");
    private static final Set<String> REGIONS = Set.of("cn-beijing", "ap-southeast-1");

    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final String endpoint;
    private final String apiKey;

    public RealtimeBackendProxy(
            @Value("${demo.realtime.endpoint:}") String configuredEndpoint,
            @Value("${demo.realtime.workspace-id:}") String workspaceId,
            @Value("${demo.realtime.region:cn-beijing}") String region,
            @Value("${demo.realtime.model:qwen3.5-omni-plus-realtime}") String model,
            @Value("${demo.qwen.api-key:}") String apiKey) {
        this.endpoint = resolveEndpoint(configuredEndpoint, workspaceId, region, model);
        this.apiKey = apiKey;
    }

    public ProxyResponse connect(String offerSdp) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("DASHSCOPE_API_KEY is not configured");
        }
        if (offerSdp == null || offerSdp.isBlank()) {
            throw new IllegalArgumentException("offerSdp is required");
        }
        try {
            String normalizedSdp = normalizeSdp(offerSdp);
            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(Duration.ofSeconds(30))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/sdp")
                    .POST(HttpRequest.BodyPublishers.ofString(normalizedSdp))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return new ProxyResponse(response.statusCode(), normalizeSdp(response.body()));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Qwen Realtime request interrupted", exception);
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot reach Qwen Realtime at " + endpoint, exception);
        }
    }

    static String resolveEndpoint(
            String configuredEndpoint,
            String workspaceId,
            String region,
            String model) {
        if (configuredEndpoint != null && !configuredEndpoint.isBlank()) {
            URI endpoint = URI.create(configuredEndpoint.trim());
            if (!"https".equalsIgnoreCase(endpoint.getScheme())) {
                throw new IllegalStateException("QWEN_REALTIME_ENDPOINT must use HTTPS");
            }
            return endpoint.toString();
        }
        if (workspaceId == null || !WORKSPACE_PATTERN.matcher(workspaceId.trim()).matches()) {
            throw new IllegalStateException(
                    "BAILIAN_WORKSPACE_ID is not configured or contains invalid characters");
        }
        String normalizedRegion = region == null ? "" : region.trim();
        if (!REGIONS.contains(normalizedRegion)) {
            throw new IllegalStateException("Unsupported QWEN_REALTIME_REGION: " + region);
        }
        String encodedModel = URLEncoder.encode(model, StandardCharsets.UTF_8);
        return "https://" + workspaceId.trim() + "." + normalizedRegion
                + ".maas.aliyuncs.com/api/v1/webrtc/realtime?model=" + encodedModel;
    }

    private static String normalizeSdp(String sdp) {
        return sdp.replace("\r\n", "\n").replace("\n", "\r\n");
    }

    public record ProxyResponse(int status, String body) {
    }

}
