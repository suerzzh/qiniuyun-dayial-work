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

Set `DASHSCOPE_API_KEY` and `BAILIAN_WORKSPACE_ID` in the project-root `.env`.
For the local 10-minute temporary-key test, keep the permanent parent key in
`DASHSCOPE_API_KEY` and enable these settings:

```dotenv
DASHSCOPE_API_KEY=your-permanent-parent-key
DASHSCOPE_USE_TEMP_KEY=true
DASHSCOPE_TEMP_KEY_TTL_SECONDS=600
BAILIAN_WORKSPACE_ID=your-workspace-id
BAILIAN_MODEL=qwen3.5-omni-plus-realtime
DEMO_USER_ID=demo-user-001
```

Do not paste an `st-...` temporary key into `DASHSCOPE_API_KEY` while
`DASHSCOPE_USE_TEMP_KEY=true`. The backend uses the permanent parent key to
mint a new 600-second temporary key for each new WebRTC SDP exchange. Neither
key is returned to the browser or written to logs.

From the project directory, start the backend:

```bash
cd /Users/mac/Documents/七牛云/7.16/UniSpeaking
source .venv/bin/activate
pip install -r backend/requirements.txt
python -m backend.app
```

In another terminal, verify the safe configuration summary:

```bash
curl http://127.0.0.1:8000/health
```

The response should contain `"credential_mode": "temporary"` and
`"temporary_key_ttl_seconds": 600`. It never contains the key value.

In a second terminal, run the integrated product frontend:

```bash
cd /Users/mac/Documents/七牛云/7.16/UniSpeaking_React
npm ci
npm run dev
```

Open <http://127.0.0.1:8080/#/conversation>. The standalone
`webrtc_demo.html` remains a diagnostic reference and is no longer the product
entry point.

## Validate session ID to `task_uuid`

This local validation uses one fixed test user. The default is
`demo-user-001`; change `DEMO_USER_ID` in `.env` and restart the backend if you
want another test value.

Start a call normally, then click **End Session**. When the browser receives
`session.created`, it binds `session.id` to the local session and test user.
The backend writes the most recently closed call to:

```text
/Users/mac/Documents/七牛云/7.16/UniSpeaking/data/last_session_identity.txt
```

Open that file and compare its `provider_session_id` with `task_uuid` in the
Qwen cloud JSON for the same call. The browser also shows the captured ID and
file path after a normal close. If the file says `NOT_CAPTURED`, the
`session.created` event was not bound, so do not treat that run as a successful
comparison. Cloud log generation may be delayed; this Demo does not query or
aggregate cloud usage yet.

After clicking Start and completing the SDP exchange, the backend terminal
prints `Temporary DashScope API key issued` plus `expires_at`. It deliberately
does not print the token. Each new call gets a new 600-second key, so waiting
ten minutes does not permanently disable the Demo; the next call mints another
temporary key. To compare against the original permanent-key path, stop the
backend, set `DASHSCOPE_USE_TEMP_KEY=false`, and start it again.

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
- `POST /api/sessions/{id}/provider-session`: binds the provider
  `session.created.session.id` to the local session and fixed test user.
- `DELETE /api/sessions/{id}`: closes the backend session and overwrites
  `data/last_session_identity.txt` with the latest identity comparison record;
  it still does not save a long-term conversation summary.
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
