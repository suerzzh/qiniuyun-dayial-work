import { useCallback, useEffect, useReducer, useRef } from "react";
import { createAudioPlayback } from "../realtime/audio-playback.mjs";
import { createMicrophone } from "../realtime/microphone.mjs";
import {
  applyRealtimeEvent,
  canRetry,
  createRealtimeState,
  sessionStatusText,
} from "../realtime/realtime-state.mjs";
import { createRealtimeClient } from "../realtime/realtime-client.mjs";
import { createRealtimeApi } from "../services/realtime-api.mjs";

const CONVERSATION_STORAGE_KEY = "unispeaking-free-chat-conversation-id";
const DEFAULT_API_BASE = "http://127.0.0.1:8000";

/**
 * @param {ReturnType<typeof createRealtimeState>} state
 * @param {any} event
 */
function realtimeReducer(state, event) {
  return applyRealtimeEvent(state, event);
}

/** @param {string} storageKey */
function readConversationId(storageKey) {
  try {
    const value = window.localStorage.getItem(storageKey) || "";
    return /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** @param {string} storageKey @param {string | null | undefined} conversationId */
function persistConversationId(storageKey, conversationId) {
  if (!conversationId) return;
  try {
    window.localStorage.setItem(storageKey, conversationId);
  } catch {
    // Private browsing or a restrictive browser policy can disable storage.
  }
}

/** @param {(audible: boolean) => void} onAudibleChange */
function createBrowserAudioPlayback(onAudibleChange) {
  return createAudioPlayback({
    createAudio: () => new Audio(),
    createAudioContext: () => {
      const AudioContextClass =
        window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("当前浏览器不支持实时音频播放");
      }
      return new AudioContextClass();
    },
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
    onAudibleChange,
  });
}

/** @param {{ scenarioId?: string, prompt?: string }} [options] */
export function useRealtimeSession({ scenarioId = "", prompt = "" } = {}) {
  const conversationStorageKey = scenarioId
    ? `${CONVERSATION_STORAGE_KEY}:${scenarioId}`
    : CONVERSATION_STORAGE_KEY;
  const [state, dispatch] = useReducer(realtimeReducer, undefined, createRealtimeState);
  const clientRef = useRef(
    /** @type {ReturnType<typeof createRealtimeClient> | null} */ (null),
  );

  if (!clientRef.current) {
    const apiBase = import.meta.env.VITE_REALTIME_API_BASE || DEFAULT_API_BASE;
    const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
    const api = createRealtimeApi({ baseUrl: apiBase, publicKey });
    const mediaDevices = {
      /** @param {MediaStreamConstraints} constraints */
      getUserMedia: async (constraints) => {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("当前浏览器不支持麦克风采集");
        }
        return navigator.mediaDevices.getUserMedia(constraints);
      },
    };
    const microphone = createMicrophone({ mediaDevices });
    const playback = createBrowserAudioPlayback((audible) => {
      dispatch({ type: "local.remote_audio", audible });
    });

    clientRef.current = createRealtimeClient({
      api,
      microphone,
      audioPlayback: playback,
      createPeerConnection: () => new RTCPeerConnection(),
      onEvent: (event) => dispatch(event),
    });
  }

  const start = useCallback(async () => {
    try {
      const result = await clientRef.current?.start({
        conversationId: readConversationId(conversationStorageKey),
        prompt,
        scenarioId,
      });
      persistConversationId(conversationStorageKey, result?.conversationId);
      return true;
    } catch {
      return false;
    }
  }, [conversationStorageKey, prompt, scenarioId]);

  const retry = useCallback(async () => {
    try {
      const result = await clientRef.current?.retry();
      persistConversationId(conversationStorageKey, result?.conversationId);
      return true;
    } catch {
      return false;
    }
  }, [conversationStorageKey]);

  const togglePause = useCallback(async () => {
    if (state.paused) {
      await clientRef.current?.setPaused(false);
    } else {
      await clientRef.current?.setPaused(true);
    }
  }, [state.paused]);

  const toggleMute = useCallback(() => {
    clientRef.current?.setMuted(!state.muted);
  }, [state.muted]);

  const sendText = useCallback(async (/** @type {string} */ text) => {
    try {
      await clientRef.current?.sendText(text);
      return true;
    } catch (error) {
      dispatch({
        type: "local.error",
        message: error instanceof Error ? error.message : "文字消息发送失败",
      });
      return false;
    }
  }, []);

  const end = useCallback(async () => {
    await clientRef.current?.stop();
  }, []);

  useEffect(
    () => () => {
      void clientRef.current?.stop({ silent: true });
    },
    [],
  );

  return {
    state,
    statusText: sessionStatusText(state),
    canRetry: canRetry(state),
    start,
    retry,
    togglePause,
    toggleMute,
    sendText,
    end,
  };
}
