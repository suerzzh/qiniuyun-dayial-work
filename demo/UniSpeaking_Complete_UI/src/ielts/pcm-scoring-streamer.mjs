export function createPcmScoringStreamer({ createAudioContext, createWebSocket, onEvent = () => {} }) {
  let socket = null;
  let context = null;
  let source = null;
  let processor = null;

  const control = (event) => {
    if (socket?.readyState === 1) socket.send(JSON.stringify(event));
  };
  async function attach(stream, wsUrl) {
    if (socket) return;
    socket = createWebSocket(wsUrl);
    socket.binaryType = "arraybuffer";
    socket.onmessage = ({ data }) => {
      try { onEvent(JSON.parse(data)); } catch { onEvent({ type: "stream.error", message: "Invalid scoring event" }); }
    };
    context = createAudioContext({ sampleRate: 16000 });
    source = context.createMediaStreamSource(stream);
    processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = ({ inputBuffer }) => {
      if (socket?.readyState !== 1) return;
      const samples = inputBuffer.getChannelData(0);
      const pcm = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i += 1) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
      socket.send(pcm.buffer);
    };
    source.connect(processor);
    processor.connect(context.destination);
  }
  async function stop() {
    control({ type: "stream.end" });
    processor?.disconnect?.(); source?.disconnect?.(); socket?.close?.(); await context?.close?.();
    socket = null; context = null; source = null; processor = null;
  }
  return { attach, control, stop, isAttached: () => Boolean(socket) };
}
