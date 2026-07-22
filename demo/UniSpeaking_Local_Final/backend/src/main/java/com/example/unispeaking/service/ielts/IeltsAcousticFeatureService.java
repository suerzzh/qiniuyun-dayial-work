package com.example.unispeaking.service.ielts;

import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class IeltsAcousticFeatureService {
    private static final Pattern WORD = Pattern.compile("[A-Za-z]+(?:['’][A-Za-z]+)?");
    // Only unambiguous hesitation tokens are counted. Context-dependent words
    // such as "like" and "well" are deliberately not guessed as fillers.
    private static final Pattern FILLER = Pattern.compile("(?i)\\b(um+|uh+|erm+|er+|hmm+)\\b");

    public IeltsAcousticMetrics calculate(IeltsTurn turn) {
        Long answer = turn.completedAtMs() == null ? null : Math.max(0, turn.completedAtMs() - turn.openedAtMs());
        List<IeltsTurn.SpeechChunk> complete = turn.speechChunks().stream().filter(c -> c.endMs() != null).toList();
        Long speech = complete.isEmpty() ? null : complete.stream().mapToLong(c -> Math.max(0, c.endMs() - c.startMs())).sum();
        Double silence = answer == null || answer == 0 || speech == null ? null
                : Math.max(0, Math.min(1, (answer - speech) / (double) answer));
        int words = count(WORD, turn.rawTranscript());
        Double rate = speech == null || speech == 0 ? null : words * 60_000.0 / speech;
        int pauses = Math.max(0, complete.size() - 1);
        int longPauses = 0;
        for (int i = 1; i < complete.size(); i++) {
            if (complete.get(i).startMs() - complete.get(i - 1).endMs() >= 2_000) longPauses++;
        }
        Long latency = complete.isEmpty() ? null : Math.max(0, complete.getFirst().startMs() - turn.openedAtMs());
        Long longest = !turn.part2LongTurn() || complete.isEmpty() ? null
                : complete.stream().mapToLong(c -> c.endMs() - c.startMs()).max().orElse(0);
        return new IeltsAcousticMetrics(answer, speech, silence, words, rate, pauses, longPauses,
                count(FILLER, turn.rawTranscript().toLowerCase(Locale.ROOT)), latency, longest, null);
    }

    private int count(Pattern pattern, String text) {
        int count = 0;
        Matcher matcher = pattern.matcher(text == null ? "" : text);
        while (matcher.find()) count++;
        return count;
    }
}
