// @ts-check

/**
 * @param {{ mediaDevices: Pick<MediaDevices, "getUserMedia"> }} options
 */
export function createMicrophone({ mediaDevices }) {
  /** @type {MediaStream | null} */
  let stream = null;
  /** @type {Promise<MediaStream> | null} */
  let requestPromise = null;
  let muted = false;
  let paused = false;

  function applyTrackState() {
    for (const track of stream?.getAudioTracks() || []) {
      track.enabled = !muted && !paused;
    }
  }

  async function request() {
    if (stream) return stream;
    if (requestPromise) return requestPromise;
    requestPromise = mediaDevices.getUserMedia({ audio: true })
      .then((nextStream) => {
        stream = nextStream;
        applyTrackState();
        return nextStream;
      })
      .catch((error) => {
        const name = error instanceof Error ? error.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          throw new Error("麦克风权限被拒绝，请在浏览器和 macOS 设置中允许访问");
        }
        if (name === "NotFoundError") {
          throw new Error("没有检测到可用的麦克风设备");
        }
        throw new Error("无法访问麦克风，请检查设备设置后重试");
      })
      .finally(() => {
        requestPromise = null;
      });
    return requestPromise;
  }

  /** @param {boolean} value */
  function setMuted(value) {
    muted = Boolean(value);
    applyTrackState();
    return muted;
  }

  /** @param {boolean} value */
  function setPaused(value) {
    paused = Boolean(value);
    applyTrackState();
    return paused;
  }

  function stop() {
    const closingStream = stream;
    stream = null;
    requestPromise = null;
    muted = false;
    paused = false;
    for (const track of closingStream?.getTracks() || []) track.stop();
  }

  return {
    request,
    getStream: () => stream,
    getAudioTracks: () => stream?.getAudioTracks() || [],
    setMuted,
    setPaused,
    isMuted: () => muted,
    isPaused: () => paused,
    stop,
  };
}
