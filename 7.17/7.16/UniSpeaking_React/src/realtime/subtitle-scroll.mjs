// @ts-check

export const SUBTITLE_FOLLOW_THRESHOLD = 48;

/**
 * @param {{ scrollHeight: number, scrollTop: number, clientHeight: number }} metrics
 * @param {number} [threshold]
 */
export function isNearScrollBottom(metrics, threshold = SUBTITLE_FOLLOW_THRESHOLD) {
  const remaining = metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop;
  return remaining <= threshold;
}
