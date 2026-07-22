import React from "react";

const CENTER = 160;
const RADIUS = 105;
const LABEL_RADIUS = 137;
const GRID_LEVELS = [0.2, 0.4, 0.6, 0.8, 1];

function axisPoint(index, radius) {
  const angle = -Math.PI / 2 + index * (Math.PI * 2 / 5);
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

function pointList(points) {
  return points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

function labelAnchor(x) {
  if (x < CENTER - 8) return "end";
  if (x > CENTER + 8) return "start";
  return "middle";
}

export default function FiveDimensionRadar({ dimensions = [], complete = false }) {
  const fiveDimensions = dimensions.slice(0, 5);
  const hasCompleteData = complete
    && fiveDimensions.length === 5
    && fiveDimensions.every((item) => Number.isFinite(item.score));
  const accessibleScores = fiveDimensions.map((item) => (
    Number.isFinite(item.score)
      ? `${item.code} ${item.score}分`
      : `${item.code} 不可用`
  ));
  const ariaLabel = `UniSpeaking 五维训练诊断。${accessibleScores.join("；")}`;

  const axisPoints = fiveDimensions.map((_, index) => axisPoint(index, RADIUS));
  const dataPoints = fiveDimensions.map((item, index) => {
    if (!Number.isFinite(item.score)) return null;
    const score = Math.min(100, Math.max(0, item.score));
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
          const point = axisPoint(index, LABEL_RADIUS);
          const value = Number.isFinite(item.score) ? `${item.score}` : "不可用";
          return (
            <text
              key={item.code}
              x={point.x}
              y={point.y}
              textAnchor={labelAnchor(point.x)}
              dominantBaseline="middle"
            >
              {item.label} {value}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
