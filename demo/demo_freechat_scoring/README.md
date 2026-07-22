# UniSpeaking Free Chat + IELTS Scoring Demo

This directory contains the Spring Boot backend for the existing free-chat
scoring flow and the IELTS Speaking scoring MVP. Free chat keeps its existing
REST and `/api/scoring-stream` WebSocket contracts. IELTS uses a separate
in-memory Attempt API and `/api/ielts/scoring-stream`, while both modes share
the same PCM ring-buffer, 500 ms pre-roll and 700 ms post-roll implementation.

## Model boundary

- Qwen Realtime: examiner interaction, ASR and VAD.
- Qwen non-Realtime (`QWEN_SCORING_MODEL` and
  `QWEN_IELTS_JUDGE_MODEL`, both default `qwen-plus`): structured language and
  holistic evidence. It never returns or controls Overall.
- iFlytek ISE: pronunciation evidence only. The current Demo calls the existing
  `read_sentence` API and marks it low-confidence evidence; its provider scores
  are never converted directly into IELTS Band.
- Java `IeltsBandCalculator`: validates four nullable half-band suggestions,
  applies equal weighting and rounds only Overall to the nearest 0.5.

No other model provider is used.

## Configuration

Copy `.env.example` to `.env`, replace the placeholders, then export it into
the shell that starts Spring Boot:

```bash
cp .env.example .env
set -a
source .env
set +a
```

Required for a live end-to-end run:

```text
DASHSCOPE_API_KEY
BAILIAN_WORKSPACE_ID
BAILIAN_MODEL
QWEN_SCORING_MODEL
QWEN_IELTS_JUDGE_MODEL
XFYUN_APPID
XFYUN_APIKEY
XFYUN_APISECRET
```

Optional IELTS prompt configuration is also listed in `.env.example`.
`IELTS_*_PROMPT_RESOURCE` accepts the default `classpath:` resources or an
external `file:/absolute/path/to/prompt.txt`; increment `IELTS_PROMPT_VERSION`
when changing a deployed prompt set.

## Run the Java backend

Java 21 is required.

```bash
cd backend_java
./mvnw spring-boot:run
```

The backend listens on `http://127.0.0.1:8000`.

## Run the existing free-chat UI

From this directory:

```bash
python3 -m http.server 8081
```

Open `http://127.0.0.1:8081/webrtc_demo.html`. This remains the regression
path for the original free-chat session, Realtime proxy, PCM scoring stream and
report.

## Run the IELTS UI

In another terminal:

```bash
cd ../../7.14/UniSpeaking_Complete_UI
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080/#/ielts`. The browser requests one microphone
MediaStream, sends it to Qwen WebRTC and the PCM scoring streamer, and keeps the
deterministic paper assembler and exam state machine in control of the flow.

Full mock uses real exam timing by default. The preflight screen has an
explicit accelerated-Demo switch for local acceptance testing; it never changes
question pairing or scoring rules. The examiner starts with the fixed English
`Hello...` introduction, records but excludes the candidate introduction from
scoring, asks 4 or 5 ordered questions from one Part 1 topic, displays rather
than reads the Part 2 card, then asks Part 3 questions belonging to that exact
Part 2 bundle.

Part 2 is one logical long turn. Realtime VAD may create internal speech
chunks, but only the explicit end-turn action or exam transition sends
`part2.speaking_completed`; an 800 ms VAD stop cannot complete it.

The IELTS Realtime session consumes Qwen incremental ASR events (`text` plus
tentative `stash`) so the raw transcript appears while the learner is still
speaking. The examiner uses 800 ms `server_vad` with automatic model responses
disabled; questions are sent explicitly only after `session.updated`. This
keeps short pauses as speech chunks without letting VAD advance the exam.

Live scoring can take longer than 15 seconds because iFlytek and the two Qwen
stages run with independent timeouts. The UI keeps polling for up to two
minutes and always renders FC, LR, GRA and Pronunciation. User-facing evidence
and Part summaries are requested and labelled in Simplified Chinese; a missing
Pronunciation Band remains visibly unavailable instead of hiding the fourth
criterion.

## Tests

```bash
cd backend_java
./mvnw test

cd ../../../7.14/UniSpeaking_Complete_UI
npm test
```

Provider tests use fakes and do not spend live API quota. A live accelerated
mock still requires valid Qwen and iFlytek credentials.

## Demo limitations

- Attempts, PCM, transcripts, evidence and reports live in one Java process and
  disappear on restart.
- There is no login, billing, database, object storage, queue, distributed
  recovery or production monitoring.
- The present iFlytek integration is `read_sentence`, not verified free-speech
  `topic` entitlement, so IELTS pronunciation confidence is deliberately low.
- The report is an AI training estimate, never an official IELTS score.
- Live provider entitlement, account limits and Part 2 Realtime interruption
behaviour must be checked with the deployment credentials before a public
demo.

## Rebuild the IELTS question bank

The runtime bank is generated directly from the approved 2026 JSON sources:

```bash
python3 scripts/build_ielts_question_bank.py
```

The command writes `part1.json`, the atomic `part2_part3.json`, and
`manifest.json` into the Web UI question-bank directory. A Part 2 card and its
nested Part 3 questions are never split or independently selected. Part 1
selection stays inside one topic: 4 or 5 questions are sampled and then asked
in source order.

The upstream PDF/OCR extraction utilities remain in
`../../7.20/ielts-question-extractor`; the script above is the reviewed
normalization step from the supplied JSON into this Demo's runtime schema.

## Prompt locations

- Exact examiner utterances and examiner name: Web UI
  `src/ielts/examiner-prompt-catalog.mjs`.
- Realtime examiner constraints: Java resource
  `prompts/ielts/examiner-system.txt`.
- FC/LR/GRA structured evidence: `prompts/ielts/language-evidence.txt`.
- Four-dimension Judge and Chinese report evidence:
  `prompts/ielts/judge.txt`.

Prompts may be replaced, but the Java Band calculator, atomic question-bank
relationship and client state-machine timing remain authoritative.

Implementation details and the exact event/API contract are documented in
`docs/IELTS_SCORING_MVP_IMPLEMENTATION.md`.
