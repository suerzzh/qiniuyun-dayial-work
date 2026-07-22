import React from "react";

/**
 * @typedef {object} RadarDimension
 * @property {string} code
 * @property {string} [label]
 * @property {number | null} [score]
 */

/** @typedef {{ x: number, y: number }} RadarPoint */

const CENTER = 160;
const RADIUS = 105;
const GRID_LEVELS = [0.2, 0.4, 0.6, 0.8, 1];
const CANONICAL_AXES = [
  { code: "FC", label: "流利度与连贯性" },
  { code: "LR", label: "词汇资源" },
  { code: "GRA", label: "语法多样性与准确性" },
  { code: "P", label: "发音" },
  { code: "TA", label: "任务完成度/互动回应" },
];
/** @type {Array<{ x: number, y: number, anchor: "start" | "middle" | "end", split?: [string, string] }>} */
const LABEL_LAYOUT = [
  { x: 160, y: 18, anchor: "middle" },
  { x: 316, y: 118, anchor: "end" },
  { x: 316, y: 270, anchor: "end", split: ["语法多样性", "与准确性"] },
  { x: 4, y: 270, anchor: "start" },
  { x: 4, y: 118, anchor: "start", split: ["任务完成度/", "互动回应"] },
];

/**
 * @param {number} index
 * @param {number} radius
 * @returns {RadarPoint}
 */
function axisPoint(index, radius) {
  const angle = -Math.PI / 2 + index * (Math.PI * 2 / 5);
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

/** @param {Array<RadarPoint | null>} points */
function pointList(points) {
  return points
    .filter((point) => point !== null)
    .map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
}

/** @param {{ dimensions?: RadarDimension[], complete?: boolean }} props */
export default function FiveDimensionRadar({ dimensions = [], complete = false }) {
  const suppliedByCode = new Map(dimensions.map((item) => [item.code, item]));
  const fiveDimensions = CANONICAL_AXES.map((axis) => {
    const supplied = suppliedByCode.get(axis.code);
    const suppliedScore = supplied?.score;
    return {
      ...axis,
      ...supplied,
      code: axis.code,
      label: supplied?.label ?? axis.label,
      score: Number.isFinite(suppliedScore) ? Number(suppliedScore) : null,
    };
  });
  const hasCompleteData = complete
    && fiveDimensions.every((item) => Number.isFinite(item.score));
  const accessibleScores = fiveDimensions.map((item) => (
    Number.isFinite(item.score)
      ? `${item.code} ${item.score}分`
      : `${item.code} 不可用`
  ));
  const ariaLabel = `UniSpeaking 五维训练诊断。${accessibleScores.join("；")}`;

  const axisPoints = fiveDimensions.map((_, index) => axisPoint(index, RADIUS));
  const dataPoints = fiveDimensions.map((item, index) => {
    const itemScore = item.score;
    if (!Number.isFinite(itemScore)) return null;
    const score = Math.min(100, Math.max(0, Number(itemScore)));
    return axisPoint(index, RADIUS * score / 100);
  });

  return (
    <svg
      className="ielts-radar"
      viewBox="0 0 320 320"
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>

      <g className="ielts-radar-grid" aria-hidden="true">
        {GRID_LEVELS.map((level) => (
          <polygon
            key={level}
            points={pointList(fiveDimensions.map((_, index) => axisPoint(index, RADIUS * level)))}
            fill="none"
            stroke="currentColor"
            strokeOpacity={level === 1 ? "0.3" : "0.14"}
            strokeWidth="1"
          />
        ))}
        {axisPoints.map((point, index) => (
          <line
            key={fiveDimensions[index]?.code ?? index}
            x1={CENTER}
            y1={CENTER}
            x2={point.x}
            y2={point.y}
            stroke="currentColor"
            strokeOpacity="0.22"
            strokeWidth="1"
          />
        ))}
      </g>

      {hasCompleteData && (
        <polygon
          data-radar-polygon="true"
          points={pointList(dataPoints)}
          fill="currentColor"
          fillOpacity="0.16"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          aria-hidden="true"
        />
      )}

      <g className="ielts-radar-values" aria-hidden="true">
        {fiveDimensions.map((item, index) => {
          if (!Number.isFinite(item.score)) return null;
          const point = dataPoints[index];
          if (!point) return null;
          return (
            <circle
              key={item.code}
              cx={point.x}
              cy={point.y}
              r="3.5"
              fill="currentColor"
            />
          );
        })}
      </g>

      <g className="ielts-radar-labels" aria-hidden="true">
        {fiveDimensions.map((item, index) => {
          const layout = LABEL_LAYOUT[index];
          const value = Number.isFinite(item.score) ? `${item.score}` : "不可用";
          const lines = layout.split
            ? [layout.split[0], `${layout.split[1]} ${value}`]
            : [`${item.label} ${value}`];
          return (
            <text
              key={item.code}
              x={layout.x}
              y={layout.y}
              textAnchor={layout.anchor}
              dominantBaseline="middle"
            >
              {lines.map((line, lineIndex) => (
                <tspan
                  key={line}
                  x={layout.x}
                  dy={lines.length === 1 ? 0 : lineIndex === 0 ? "-0.55em" : "1.15em"}
                >
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
