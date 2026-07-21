# FreeTalk

The browser owns microphone/video capture, live user transcription, and the
streaming AI reply UI. The Python backend owns credentials, SDP proxying, the
free-chat speaking role, prompt composition, learner-level persistence,
CORS, and the extension point for business rules.

## Run locally

This workspace is configured to use the `unispeaking` Conda environment:

```bash
conda activate unispeaking
pip install -r backend/requirements.txt
```

Set `DASHSCOPE_API_KEY` and `BAILIAN_WORKSPACE_ID` in `.vscode/.env` (or a
project-root `.env`), then start the backend:

```bash
python3 -m backend.app
```

In a second terminal, serve the frontend independently:

```bash
python3 -m http.server 8080
```

Open <http://127.0.0.1:8080/webrtc_demo.html>.

The default turn-taking settings treat 800 ms of silence as the end of the
learner's turn. Five seconds of full inactivity lets the coach gently prompt
the learner. Tune `VAD_SILENCE_DURATION_MS` if needed. Automatic idle prompts
are disabled by default (`IDLE_TIMEOUT_MS=0`) because they can overlap a normal
reply; set a positive value only if you explicitly want assistant-only prompts.
The prompt still tells the coach not to interrupt audible hesitation sounds.

## Backend extension points

- `backend/business_logic.py`: fixed English-coach role, adaptive difficulty
  instructions, prompt composition, event normalization, and learner profile
  persistence.
- `POST /api/sessions`: creates an in-memory session and returns the backend
  generated Realtime `session.update` config plus the saved learner profile.
- `POST /api/sessions/{id}/events`: temporarily collects final learner and
  coach messages for the current call. These messages are kept only in the
  running backend session and are not summarized into long-term memory.
- `DELETE /api/sessions/{id}`: closes the backend session without saving a
  long-term conversation summary.
- `GET /api/sessions/{id}/profile`: inspects the current transcript buffer and
  learner profile during development.
- `DELETE /api/conversations/{id}`: clears the saved learner profile for that
  conversation ID.
- `POST /api/realtime?session_id=...`: exchanges browser SDP with Bailian
  without exposing the API key or workspace ID.
- `POST /api/sessions/{id}/tools/learner-level`: validates a model-requested
  level adjustment. At least three learner turns are required and each update
  is limited to one level.
- `POST /api/sessions/{id}/latency`: records one browser-measured turn.
- `GET /api/latency-report`: reads the generated Markdown latency report.

Long-term conversation summaries are not stored. Realtime handles short-term
context inside each call. `data/conversations.json` stores only the learner
profile used for level adaptation. Replace the JSON store with Redis or a
database before running multiple backend instances.

The learner starts at level 4 (`CET-4`). The persistent learner profile uses
levels 1–6. The Realtime model can call `update_learner_level` after multi-turn
evidence suggests a consistent need to raise or lower difficulty.

Per-turn timings are appended to `data/latency_report.md`, including speech
start to first transcript, speech-end to first audible AI audio, interruption
to audible silence, and speech-end to first AI text. The report marks each
target with pass/fail symbols. First audible audio and interruption stop are
measured from the remote WebRTC track with a browser audio-energy monitor.

At call end, WebRTC `getStats()` data is also recorded: duration, packet loss,
maximum jitter, average RTT, and connection disruptions. A 3–10 minute call is
marked as passing when packet loss is at most 3%, jitter is at most 100 ms, RTT
is at most 500 ms, and no connection disruption occurred.
