package com.example.unispeaking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

@SpringBootApplication
public class UnispeakingApplication {
    public static void main(String[] args) {
        loadDotEnv();
        SpringApplication.run(UnispeakingApplication.class, args);
    }

    private static void loadDotEnv() {
        // Search for .env or .vscode/.env in parent and current directories
        Path[] paths = {
            Paths.get(".env"),
            Paths.get("../.env"),
            Paths.get(".vscode/.env"),
            Paths.get("../.vscode/.env"),
            Paths.get("../../.vscode/.env")
        };

        for (Path path : paths) {
            if (Files.exists(path)) {
                try {
                    List<String> lines = Files.readAllLines(path);
                    for (String line : lines) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) {
                            continue;
                        }
                        int eqIdx = line.indexOf('=');
                        if (eqIdx > 0) {
                            String key = line.substring(0, eqIdx).trim();
                            String val = line.substring(eqIdx + 1).trim();
                            if (val.startsWith("\"") && val.endsWith("\"") && val.length() > 1) {
                                val = val.substring(1, val.length() - 1);
                            } else if (val.startsWith("'") && val.endsWith("'") && val.length() > 1) {
                                val = val.substring(1, val.length() - 1);
                            }
                            System.setProperty(key, val);
                        }
                    }
                    System.out.println("Loaded environment from: " + path.toAbsolutePath());
                    break;
                } catch (IOException e) {
                    System.err.println("Failed to read .env file: " + e.getMessage());
                }
            }
        }
    }
}
