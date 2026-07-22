// @ts-check

import { resolveHttpBase } from "./local-service-config.mjs";

/**
 * @param {{ origin?: string, fetchImpl?: typeof fetch }} [options]
 */
export function createRealtimeApi({ origin, fetchImpl = fetch } = {}) {
  const base = resolveHttpBase(origin);

  /** @param {string} path @param {RequestInit} [options] */
  async function request(path, options = {}) {
    const response = await fetchImpl(`${base}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
      },
    });
    if (response.status === 204) return null;
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      const message = body && typeof body === "object" && "error" in body
        ? String(body.error)
        : typeof body === "string" && body.trim()
        ? body.trim()
        : `实时服务请求失败（${response.status}）`;
      throw new Error(message);
    }
    return body;
  }

  /** @param {string} path @param {unknown} body */
  const postJson = (path, body) => request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    health: () => request("/health"),
    /** @param {{ prompt?: string, conversation_id?: string | null, scenario_id?: string }} body */
    createSession: (body = {}) => postJson("/api/sessions", body),
    /** @param {string} sessionId @param {string} offerSdp */
    exchangeSdp: async (sessionId, offerSdp) => {
      const response = await request(
        `/api/realtime?session_id=${encodeURIComponent(sessionId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offerSdp,
        }
      );
      return String(response || "");
    },
    /** @param {string} sessionId @param {unknown} event */
    rememberEvent: (sessionId, event) => postJson(
      `/api/sessions/${encodeURIComponent(sessionId)}/events`,
      { event }
    ),
    /** @param {string} sessionId @param {string} providerSessionId */
    bindProviderSession: (sessionId, providerSessionId) => postJson(
      `/api/sessions/${encodeURIComponent(sessionId)}/provider-session`,
      { provider_session_id: providerSessionId }
    ),
    /** @param {string} sessionId @param {unknown} argumentsObject */
    updateLearnerLevel: (sessionId, argumentsObject) => postJson(
      `/api/sessions/${encodeURIComponent(sessionId)}/tools/learner-level`,
      { arguments: argumentsObject }
    ),
    /** @param {string} sessionId @param {unknown} metric */
    recordQuality: (sessionId, metric) => postJson(
      `/api/sessions/${encodeURIComponent(sessionId)}/quality`,
      metric
    ),
    /** @param {string} sessionId */
    closeSession: (sessionId) => request(
      `/api/sessions/${encodeURIComponent(sessionId)}`,
      { method: "DELETE" }
    ),
  };
}
