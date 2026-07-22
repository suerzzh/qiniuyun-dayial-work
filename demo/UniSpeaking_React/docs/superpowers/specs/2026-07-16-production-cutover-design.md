# UniSpeaking Production Cutover Design

## Decision

Upgrade the existing Supabase project and Vercel project in place. Keep the
Supabase project because its publishable and secret keys are project-scoped,
but replace the active `realtime-gateway` implementation and the Vercel
production deployment.

## Considered approaches

1. **Supabase Edge Function v4 (selected).** Reuses the existing database,
   secrets, rate limits, and public endpoint. It requires a small compatibility
   layer for the Python-shaped frontend API but avoids a new hosting provider.
2. **Deploy the Python aiohttp server to a container host.** Minimal backend
   code change, but introduces another provider and requires persistent storage
   and single-instance/session-affinity decisions.
3. **Run Python on Vercel Functions.** Rejected because the current backend
   keeps active sessions in memory and writes local files across requests.

## Architecture

- Vercel serves `UniSpeaking_React` at the existing production project.
- The browser calls the existing Supabase function URL over HTTPS.
- The browser sends the Supabase publishable key in the `apikey` header.
- The Edge Function validates origin and public key, rate-limits session
  creation, stores final transcripts and metrics in the existing RLS-enabled
  tables, and exchanges SDP with Bailian using server-side secrets.
- The latest reviewed Clara English prompt is embedded in the function source.

## Compatibility contract

The gateway supports:

- `GET /health`
- `POST /api/sessions`
- `POST /api/realtime?session_id=...`
- `POST /api/sessions/:id/events`
- `POST /api/sessions/:id/provider-session`
- `POST /api/sessions/:id/tools/learner-level`
- `POST /api/sessions/:id/quality`
- `DELETE /api/sessions/:id`

Legacy v3 paths remain accepted during the cutover.

## Security

- `DASHSCOPE_API_KEY`, Supabase secret keys, and database credentials never
  enter the browser bundle or Git.
- `VITE_SUPABASE_PUBLISHABLE_KEY` is public by design and is protected by
  origin checks, rate limiting, and database RLS.
- Production CORS accepts `https://app.unispeaking.cn` and Vercel HTTPS
  preview origins; local development remains allowed.
- Error responses do not include upstream response bodies or secret values.

## Cutover and verification

1. Deploy gateway v4 to the existing function slug.
2. Verify health, unauthorized access, session creation, and SDP error safety.
3. Configure the existing Vercel project to build the new frontend directory.
4. Deploy production and verify page load, route refresh, console/network
   errors, and the realtime session flow.
5. Keep only the currently active function version and production deployment
   serving traffic. Historical platform records may remain where the platform
   does not expose safe per-version deletion.

## Success criteria

- The production frontend loads from the expected Vercel project and domain.
- The browser can create a session through Supabase with a publishable key.
- The returned session config contains the reviewed Clara prompt.
- Bailian credentials remain server-only.
- Frontend lint, typecheck, tests, build, gateway contract tests, and live
  health/session checks pass.
