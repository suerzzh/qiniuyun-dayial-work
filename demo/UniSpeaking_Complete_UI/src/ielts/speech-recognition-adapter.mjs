const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);

export function createSpeechRecognitionAdapter({
  windowRef = globalThis.window,
  mediaDevices = globalThis.navigator?.mediaDevices,
  onInterim = () => {},
  onFinal = () => {},
  onError = () => {},
} = {}) {
  const Recognition = windowRef?.SpeechRecognition || windowRef?.webkitSpeechRecognition;
  let stream = null;
  let recognition = null;
  let disposed = false;
  let desiredState = "idle";
  let restartAttempts = 0;

  const isSupported = () => Boolean(Recognition && mediaDevices?.getUserMedia);

  function createRecognition() {
    const instance = new Recognition();
    instance.lang = "en-GB";
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = (event) => {
      if (disposed) return;
      for (let index = event.resultIndex || 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim();
        if (!text) continue;
        if (result.isFinal) onFinal(text);
        else onInterim(text);
      }
    };
    instance.onerror = (event) => {
      if (disposed) return;
      const code = event?.error || "recognition-error";
      onError({ code, recoverable: !FATAL_ERRORS.has(code) });
    };
    instance.onend = () => {
      if (disposed || desiredState !== "listening" || recognition !== instance) return;
      if (restartAttempts < 1) {
        restartAttempts += 1;
        recognition = createRecognition();
        recognition.start();
        return;
      }
      desiredState = "stopped";
      onError({ code: "recognition-ended", recoverable: false });
    };
    return instance;
  }

  async function begin({ requestPermission }) {
    if (disposed) throw new Error("Speech recognition adapter is disposed");
    if (!isSupported()) throw new Error("Speech recognition is not supported");
    if (requestPermission && !stream) stream = await mediaDevices.getUserMedia({ audio: true });
    desiredState = "listening";
    restartAttempts = 0;
    recognition = createRecognition();
    recognition.start();
  }

  function stopTracks() {
    for (const track of stream?.getTracks?.() || []) track.stop();
    stream = null;
  }

  return {
    isSupported,
    async start() { await begin({ requestPermission: true }); },
    pause() {
      desiredState = "paused";
      recognition?.stop?.();
      recognition = null;
    },
    async resume() { await begin({ requestPermission: false }); },
    stop() {
      desiredState = "stopped";
      recognition?.abort?.();
      recognition = null;
      stopTracks();
    },
    dispose() {
      disposed = true;
      desiredState = "stopped";
      recognition?.abort?.();
      recognition = null;
      stopTracks();
    },
  };
}
