const trimSlash = (value) => String(value || "").replace(/\/+$/, "");

export function createRealtimeApi({ baseUrl, publishableKey, fetchImpl = fetch }) {
  const endpoint = `${trimSlash(baseUrl)}/functions/v1/realtime-gateway`;
  const headers = (extra = {}) => ({ apikey: publishableKey, ...extra });
  const request = async (path, options = {}) => {
    const response = await fetchImpl(`${endpoint}${path}`, { ...options, headers: headers(options.headers) });
    const type = response.headers?.get?.("content-type") || "";
    const body = type.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) throw new Error(typeof body === "object" ? body.error || `请求失败（${response.status}）` : body || `请求失败（${response.status}）`);
    return body;
  };
  return {
    health: () => request("/health"),
    createSession: (body = {}) => request("/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    exchangeSdp: (sessionId, sdp) => request(`/sdp?session_id=${encodeURIComponent(sessionId)}`, { method: "POST", headers: { "Content-Type": "application/sdp" }, body: sdp }),
    rememberEvent: (sessionId, event) => request(`/session/${encodeURIComponent(sessionId)}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event }) }),
    updateLearnerLevel: (sessionId, payload) => request(`/session/${encodeURIComponent(sessionId)}/learner-level`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    closeSession: (sessionId) => request(`/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
    saveMetrics: (sessionId, metrics) => request(`/session/${encodeURIComponent(sessionId)}/metrics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metrics) }),
  };
}
