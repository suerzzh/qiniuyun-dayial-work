// @ts-check

/**
 * @param {{
 *   createAudio: () => any,
 *   createAudioContext: () => any,
 *   requestFrame: (callback: FrameRequestCallback) => number,
 *   cancelFrame: (id: number) => void,
 *   onAudibleChange: (audible: boolean) => void,
 * }} options
 */
export function createAudioPlayback({
  createAudio,
  createAudioContext,
  requestFrame,
  cancelFrame,
  onAudibleChange,
}) {
  /** @type {any} */
  let audio = null;
  /** @type {any} */
  let context = null;
  /** @type {any} */
  let source = null;
  /** @type {any} */
  let analyser = null;
  let frame = 0;
  let audible = false;
  let silenceFrames = 0;
  let paused = false;

  function stopMonitor() {
    if (frame) cancelFrame(frame);
    frame = 0;
    if (source) {
      try { source.disconnect(); } catch { /* already disconnected */ }
    }
    source = null;
    analyser = null;
    silenceFrames = 0;
  }

  /** @param {boolean} value */
  function updateAudible(value) {
    if (audible === value) return;
    audible = value;
    onAudibleChange(value);
  }

  function startMonitor() {
    if (!analyser) return;
    const samples = new Uint8Array(analyser.fftSize);
    const monitor = () => {
      if (!analyser) return;
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) {
        const normalized = (sample - 128) / 128;
        energy += normalized * normalized;
      }
      const rms = Math.sqrt(energy / samples.length);
      if (rms >= 0.015) {
        silenceFrames = 0;
        updateAudible(true);
      } else if (audible) {
        silenceFrames += 1;
        if (silenceFrames >= 3) {
          silenceFrames = 0;
          updateAudible(false);
        }
      }
      frame = requestFrame(monitor);
    };
    frame = requestFrame(monitor);
  }

  /** @param {MediaStream | any} stream */
  async function attach(stream) {
    if (!stream?.getAudioTracks?.().length) {
      throw new Error("远端音频流不可用");
    }
    stopMonitor();
    if (!audio) audio = createAudio();
    if (!context || context.state === "closed") context = createAudioContext();

    audio.autoplay = true;
    audio.playsInline = true;
    audio.muted = false;
    audio.srcObject = stream;
    if (!paused) {
      await context.resume?.();
      await audio.play?.();
    }

    source = context.createMediaStreamSource(stream);
    analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    startMonitor();
  }

  /** @param {boolean} value */
  async function setPaused(value) {
    paused = Boolean(value);
    if (!audio || !context) return paused;
    if (paused) {
      audio.pause?.();
      await context.suspend?.();
      updateAudible(false);
    } else {
      await context.resume?.();
      await audio.play?.();
    }
    return paused;
  }

  async function stop() {
    if (!audio && !context && !source && !frame) return;
    stopMonitor();
    updateAudible(false);
    const closingAudio = audio;
    const closingContext = context;
    audio = null;
    context = null;
    paused = false;
    if (closingAudio) {
      closingAudio.pause?.();
      closingAudio.srcObject = null;
    }
    if (closingContext && closingContext.state !== "closed") {
      await closingContext.close?.();
    }
  }

  return { attach, setPaused, stop, isAudible: () => audible };
}
