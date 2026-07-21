package com.example.unispeaking.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

@Service
public class XfyunIseService {

    @Value("${xfyun.appid}")
    private String appId;

    @Value("${xfyun.apikey}")
    private String apiKey;

    @Value("${xfyun.apisecret}")
    private String apiSecret;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public CompletableFuture<Map<String, Object>> evaluatePronunciation(byte[] audioData, String text) {
        CompletableFuture<Map<String, Object>> future = new CompletableFuture<>();

        if (appId == null || appId.trim().isEmpty() || "your_appid_here".equals(appId)) {
            future.completeExceptionally(new IllegalStateException("iFlytek appid is not configured in .env"));
            return future;
        }

        try {
            byte[] pcmAudioData = stripWavHeader(audioData);
            String authUrl = createAuthUrl("ise-api.xfyun.cn", "/v2/open-ise", apiKey, apiSecret);
            
            httpClient.newWebSocketBuilder()
                .buildAsync(URI.create(authUrl), new WebSocket.Listener() {
                    private final StringBuilder responseBuilder = new StringBuilder();

                    @Override
                    public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
                        responseBuilder.append(data);
                        if (last) {
                            String message = responseBuilder.toString();
                            responseBuilder.setLength(0);
                            try {
                                JsonNode responseJson = objectMapper.readTree(message);
                                int code = responseJson.get("code").asInt();
                                if (code != 0) {
                                    String desc = responseJson.get("message").asText();
                                    future.completeExceptionally(new RuntimeException("iFlytek ISE Error: " + desc + " (code: " + code + ")"));
                                    webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "Error from server");
                                    return null;
                                }

                                JsonNode dataNode = responseJson.get("data");
                                if (dataNode != null) {
                                    int status = dataNode.get("status").asInt();
                                    if (status == 2) {
                                        // Final frame result
                                        JsonNode resultNode = dataNode.get("data");
                                        if (resultNode == null) {
                                            resultNode = dataNode.get("result");
                                        }
                                        if (resultNode == null || resultNode.asText().isEmpty()) {
                                            throw new IllegalStateException("iFlytek ISE returned an empty final result");
                                        }
                                        String xmlBase64 = resultNode.asText();
                                        byte[] decodedXml = Base64.getDecoder().decode(xmlBase64);
                                        String xmlStr = new String(decodedXml, StandardCharsets.UTF_8);
                                        Map<String, Object> scoreResult = parseIseXml(xmlStr);
                                        future.complete(scoreResult);
                                        webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "Finished");
                                    }
                                }
                            } catch (Exception e) {
                                future.completeExceptionally(e);
                                webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "Parse error");
                            }
                        }
                        return WebSocket.Listener.super.onText(webSocket, data, last);
                    }

                    @Override
                    public void onError(WebSocket webSocket, Throwable error) {
                        future.completeExceptionally(error);
                    }

                    @Override
                    public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
                        if (!future.isDone()) {
                            future.complete(Collections.emptyMap());
                        }
                        return null;
                    }
                })
                .thenAccept(webSocket -> {
                    // Start streaming audio on background thread
                    CompletableFuture.runAsync(() -> {
                        try {
                            // Frame 1: send configuration
                            Map<String, Object> firstFrame = new HashMap<>();
                            
                            Map<String, Object> common = new HashMap<>();
                            common.put("app_id", appId);
                            firstFrame.put("common", common);
                            
                            Map<String, Object> business = new HashMap<>();
                            business.put("category", "read_sentence");
                            business.put("sub", "ise");
                            business.put("ent", "en_vip");
                            business.put("tte", "utf-8");
                            business.put("auf", "audio/L16;rate=16000");
                            business.put("aue", "raw");
                            business.put("extra_ability", "multi_dimension");
                            business.put("ise_unite", "1");
                            business.put("rst", "entirety");
                            business.put("cmd", "ssb");
                            business.put("ttp_skip", true);
                            business.put("text", "\ufeff[content]\n" + text);
                            firstFrame.put("business", business);
                            
                            Map<String, Object> data = new HashMap<>();
                            data.put("status", 0);
                            data.put("data", "");
                            firstFrame.put("data", data);

                            webSocket.sendText(objectMapper.writeValueAsString(firstFrame), true);

                            // Send audio in chunks
                            int chunkSize = 1280;
                            int offset = 0;
                            boolean firstAudioFrame = true;
                            while (offset < pcmAudioData.length && !future.isDone()) {
                                int size = Math.min(chunkSize, pcmAudioData.length - offset);
                                byte[] chunk = new byte[size];
                                System.arraycopy(pcmAudioData, offset, chunk, 0, size);
                                offset += size;
                                
                                Map<String, Object> audioFrame = new HashMap<>();
                                
                                Map<String, Object> audioBusiness = new HashMap<>();
                                audioBusiness.put("cmd", "auw");
                                audioBusiness.put("aus", firstAudioFrame ? 1 : 2);
                                audioBusiness.put("aue", "raw");
                                audioFrame.put("business", audioBusiness);
                                
                                Map<String, Object> audioDataNode = new HashMap<>();
                                audioDataNode.put("status", 1);
                                audioDataNode.put("data", Base64.getEncoder().encodeToString(chunk));
                                audioDataNode.put("data_type", 1);
                                audioDataNode.put("encoding", "raw");
                                audioFrame.put("data", audioDataNode);

                                webSocket.sendText(objectMapper.writeValueAsString(audioFrame), true);
                                firstAudioFrame = false;

                                // Sleep 40ms to simulate real-time streaming as required by iFlytek
                                Thread.sleep(40);
                            }

                            if (!future.isDone()) {
                                Map<String, Object> finalFrame = new HashMap<>();
                                Map<String, Object> finalBusiness = new HashMap<>();
                                finalBusiness.put("cmd", "auw");
                                finalBusiness.put("aus", 4);
                                finalBusiness.put("aue", "raw");
                                finalFrame.put("business", finalBusiness);

                                Map<String, Object> finalData = new HashMap<>();
                                finalData.put("status", 2);
                                finalData.put("data", "");
                                finalData.put("data_type", 1);
                                finalData.put("encoding", "raw");
                                finalFrame.put("data", finalData);
                                webSocket.sendText(objectMapper.writeValueAsString(finalFrame), true);
                            }
                        } catch (Exception e) {
                            future.completeExceptionally(e);
                            webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "Stream exception");
                        }
                    });
                })
                .exceptionally(ex -> {
                    future.completeExceptionally(ex);
                    return null;
                });
        } catch (Exception e) {
            future.completeExceptionally(e);
        }

        return future;
    }

    private byte[] stripWavHeader(byte[] audioData) {
        if (audioData.length < 44 || !hasAscii(audioData, 0, "RIFF") || !hasAscii(audioData, 8, "WAVE")) {
            return audioData;
        }

        int offset = 12;
        while (offset + 8 <= audioData.length) {
            int chunkSize = littleEndianInt(audioData, offset + 4);
            int dataOffset = offset + 8;
            if (chunkSize < 0 || dataOffset + chunkSize > audioData.length) {
                return audioData;
            }
            if (hasAscii(audioData, offset, "data")) {
                return Arrays.copyOfRange(audioData, dataOffset, dataOffset + chunkSize);
            }
            offset = dataOffset + chunkSize + (chunkSize & 1);
        }
        return audioData;
    }

    private boolean hasAscii(byte[] data, int offset, String value) {
        if (offset < 0 || offset + value.length() > data.length) return false;
        for (int i = 0; i < value.length(); i++) {
            if (data[offset + i] != (byte) value.charAt(i)) return false;
        }
        return true;
    }

    private int littleEndianInt(byte[] data, int offset) {
        return (data[offset] & 0xff)
                | ((data[offset + 1] & 0xff) << 8)
                | ((data[offset + 2] & 0xff) << 16)
                | ((data[offset + 3] & 0xff) << 24);
    }

    private String createAuthUrl(String host, String path, String apiKey, String apiSecret) throws Exception {
        SimpleDateFormat format = new SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("GMT"));
        String date = format.format(Calendar.getInstance().getTime());

        String signatureOrigin = "host: " + host + "\n" + "date: " + date + "\n" + "GET " + path + " HTTP/1.1";
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec spec = new SecretKeySpec(apiSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(spec);
        byte[] hexBytes = mac.doFinal(signatureOrigin.getBytes(StandardCharsets.UTF_8));
        String signature = Base64.getEncoder().encodeToString(hexBytes);

        String authorizationOrigin = String.format("api_key=\"%s\",algorithm=\"hmac-sha256\",headers=\"host date request-line\",signature=\"%s\"", apiKey, signature);
        String authorization = Base64.getEncoder().encodeToString(authorizationOrigin.getBytes(StandardCharsets.UTF_8));

        return String.format("wss://%s%s?authorization=%s&date=%s&host=%s",
                host, path,
                URLEncoder.encode(authorization, StandardCharsets.UTF_8.name()),
                URLEncoder.encode(date, StandardCharsets.UTF_8.name()),
                URLEncoder.encode(host, StandardCharsets.UTF_8.name())
        );
    }

    private Map<String, Object> parseIseXml(String xmlStr) {
        Map<String, Object> result = new HashMap<>();
        List<Map<String, Object>> wordsList = new ArrayList<>();
        result.put("accuracy_score", 0.0);
        result.put("fluency_score", 0.0);
        result.put("integrity_score", 0.0);
        result.put("total_score", 0.0);
        result.put("words", wordsList);

        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new ByteArrayInputStream(xmlStr.getBytes(StandardCharsets.UTF_8)));
            
            Element scoredElement = null;
            NodeList readSentenceList = doc.getElementsByTagName("read_sentence");
            for (int i = 0; i < readSentenceList.getLength(); i++) {
                Element candidate = (Element) readSentenceList.item(i);
                if (!candidate.getAttribute("total_score").isEmpty()) {
                    scoredElement = candidate;
                    if (!candidate.getAttribute("integrity_score").isEmpty()) break;
                }
            }
            if (scoredElement == null) {
                NodeList sentenceList = doc.getElementsByTagName("sentence");
                for (int i = 0; i < sentenceList.getLength(); i++) {
                    Element candidate = (Element) sentenceList.item(i);
                    if (!candidate.getAttribute("total_score").isEmpty()) {
                        scoredElement = candidate;
                        break;
                    }
                }
            }
            if (scoredElement != null) {
                result.put("accuracy_score", getDoubleAttr(scoredElement, "accuracy_score"));
                result.put("fluency_score", getDoubleAttr(scoredElement, "fluency_score"));
                result.put("total_score", getDoubleAttr(scoredElement, "total_score"));
            }

            Double integrityScore = scoredElement == null
                    ? null
                    : getOptionalDoubleAttr(scoredElement, "integrity_score");
            if (integrityScore == null) {
                NodeList allElements = doc.getElementsByTagName("*");
                for (int i = 0; i < allElements.getLength(); i++) {
                    Element candidate = (Element) allElements.item(i);
                    integrityScore = getOptionalDoubleAttr(candidate, "integrity_score");
                    if (integrityScore != null) break;
                }
            }
            if (integrityScore != null) {
                result.put("integrity_score", integrityScore);
            }

            NodeList wordList = doc.getElementsByTagName("word");
            for (int i = 0; i < wordList.getLength(); i++) {
                Element wordEl = (Element) wordList.item(i);
                String content = wordEl.getAttribute("content").trim();
                if (isNonSpeechNode(content, wordEl.getAttribute("rec_node_type"))) {
                    continue;
                }
                double score = getDoubleAttr(wordEl, "total_score");
                String dpMessage = wordEl.getAttribute("dp_message");
                
                String errorType = "None";
                if ("16".equals(dpMessage)) {
                    errorType = "Omission";
                } else if ("32".equals(dpMessage)) {
                    errorType = "Insertion";
                } else if ("64".equals(dpMessage)) {
                    errorType = "Repetition";
                } else if ("128".equals(dpMessage)) {
                    errorType = "Substitution";
                }
                
                Map<String, Object> wordMap = new HashMap<>();
                wordMap.put("word", content);
                wordMap.put("score", score);
                wordMap.put("error_type", errorType);
                wordsList.add(wordMap);
            }

            double integrity = ((Number) result.get("integrity_score")).doubleValue();
            double accuracy = ((Number) result.get("accuracy_score")).doubleValue();
            if (integrity <= 0.0 && accuracy >= 40.0 && !wordsList.isEmpty()) {
                long pronouncedWords = wordsList.stream()
                        .filter(word -> !"Omission".equals(word.get("error_type")))
                        .count();
                double fallbackIntegrity = pronouncedWords * 100.0 / wordsList.size();
                result.put("integrity_score", Math.round(fallbackIntegrity * 100.0) / 100.0);
            }
        } catch (Exception e) {
            System.err.println("Failed to parse ISE XML: " + e.getMessage());
        }
        return result;
    }

    private boolean isNonSpeechNode(String content, String nodeType) {
        if (content == null || content.isBlank()) return true;
        String normalizedContent = content.trim().toLowerCase(Locale.ROOT);
        String normalizedType = nodeType == null ? "" : nodeType.trim().toLowerCase(Locale.ROOT);
        return Set.of("sil", "fil", "sp", "noise", "<sil>", "<fil>").contains(normalizedContent)
                || Set.of("sil", "fil", "noise").contains(normalizedType);
    }

    private Double getOptionalDoubleAttr(Element element, String attrName) {
        String val = element.getAttribute(attrName);
        if (val == null || val.trim().isEmpty()) return null;
        try {
            return Double.parseDouble(val);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private double getDoubleAttr(Element element, String attrName) {
        String val = element.getAttribute(attrName);
        if (val == null || val.trim().isEmpty()) {
            return 0.0;
        }
        try {
            return Double.parseDouble(val);
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }
}
