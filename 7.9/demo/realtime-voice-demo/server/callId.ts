// call_id 生成。
// design.md 第 5.2 节：格式 call_yyyyMMddHHmmss_random6，示例 call_20260709143005_a1b2c3
function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

function randomHex6(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]
  }
  return s
}

export function generateCallId(now: Date = new Date()): string {
  const yyyy = now.getFullYear()
  const MM = pad(now.getMonth() + 1)
  const dd = pad(now.getDate())
  const HH = pad(now.getHours())
  const mm = pad(now.getMinutes())
  const ss = pad(now.getSeconds())
  return `call_${yyyy}${MM}${dd}${HH}${mm}${ss}_${randomHex6()}`
}
