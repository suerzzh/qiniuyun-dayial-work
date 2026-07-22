const trimSlash = (value) => String(value || "").replace(/\/+$/, "");

export function createIeltsApi({ baseUrl = "http://127.0.0.1:8000", fetchImpl = fetch } = {}) {
  const root = trimSlash(baseUrl);
  async function request(path, options = {}) {
    const response = await fetchImpl(`${root}${path}`, options);
    const type = response.headers?.get?.("content-type") || "";
    const body = type.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok && response.status !== 202) throw new Error(body?.error || body || `IELTS request failed (${response.status})`);
    return body;
  }
  return {
    createAttempt: (payload) => request("/api/ielts/attempts", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }),
    exchangeSdp: (attemptId, sdp) => request(`/api/realtime?session_id=${encodeURIComponent(attemptId)}`, {
      method: "POST", headers: { "Content-Type": "application/sdp" }, body: sdp,
    }),
    finalize: (id) => request(`/api/ielts/attempts/${encodeURIComponent(id)}/finalize`, { method: "POST" }),
    status: (id) => request(`/api/ielts/attempts/${encodeURIComponent(id)}/scoring-status`),
    report: (id) => request(`/api/ielts/attempts/${encodeURIComponent(id)}/report`),
    abandon: (id) => request(`/api/ielts/attempts/${encodeURIComponent(id)}/abandon`, { method: "POST" }),
    delete: (id) => request(`/api/ielts/attempts/${encodeURIComponent(id)}`, { method: "DELETE" }),
  };
}
