export function resolveHttpBase(origin = globalThis.location?.origin) {
  if (!origin) throw new Error("无法确定本地服务地址");
  return new URL(origin).origin;
}

export function resolveWsBase(origin = globalThis.location?.origin) {
  const url = new URL(resolveHttpBase(origin));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.origin;
}
