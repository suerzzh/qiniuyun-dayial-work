import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("migration creates five protected persistence tables", async () => {
  const sql = await read("supabase/migrations/202607140001_realtime_web.sql");
  for (const table of ["learner_profiles", "realtime_sessions", "session_messages", "realtime_metrics", "request_rate_limits"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
  }
  assert.match(sql, /no audio is stored/i);
});

test("Edge Function exposes the expected gateway and keeps provider credentials server-side", async () => {
  const source = await read("supabase/functions/realtime-gateway/index.ts");
  for (const route of ["/health", "/session", "/sdp", "events", "learner-level", "metrics"])
    assert.equal(source.includes(route), true, `missing route ${route}`);
  for (const variable of ["DASHSCOPE_API_KEY", "BAILIAN_WORKSPACE_ID", "SUPABASE_SECRET_KEYS"])
    assert.equal(source.includes(variable), true, `missing environment variable ${variable}`);
  assert.match(source, /ACCEPTED_PUBLIC_KEYS/);
  assert.match(source, /request_rate_limits/);
  assert.equal(/sk-[A-Za-z0-9_-]{20,}/.test(source), false);
});
