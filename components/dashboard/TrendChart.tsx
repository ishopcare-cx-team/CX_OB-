"use client";

import { useMemo, useState } from "react";
import {
  aggregateTrend,
  type Granularity,
  type TrendPoint,
} from "@/lib/dashboardStats";

const WIDTH = 720;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 32 };

const GRANULARITY_OPTIONS: { key: Granularity; label: string }[] = [
  { key: "day", label: "일별" },
  { key: "week", label: "주간별" },
  { key: "month", label: "월별" },
];

function formatTick(date: string, granularity: Granularity): string {
  if (granularity === "month") {
    const [, m] = date.split("-");
    return `${Number(m)}월`;
  }
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function formatTooltipDate(date: string, granularity: Granularity): string {
  if (granularity === "month") return `${date} 월간`;
  if (granularity === "week") return `${date} 주 (월~일)`;
  return date;
}

export function TrendChart({ dailyData }: { dailyData: TrendPoint[] }) {
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const data = useMemo(
    () => aggregateTrend(dailyData, granularity),
    [dailyData, granularity]
  );

  const { points, maxY } = useMemo(() => {
    const maxY = Math.max(...data.map((d) => d.count), 1);
    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const xFor = (i: number) =>
      PAD.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const yFor = (v: number) => PAD.top + innerH - (v / maxY) * innerH;
    const points = data.map((d, i) => [xFor(i), yFor(d.count)] as const);
    return { points, maxY };
  }, [data]);

  const gridLines = 4;

  function handleMove(e: React.PointerEvent<SVGRectElement>) {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let best = Infinity;
    points.forEach(([x], i) => {
      const dist = Math.abs(x - relX);
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    });
    setHoverIdx(nearest);
  }

  const hover = hoverIdx != null ? data[hoverIdx] : null;
  const hoverX = hoverIdx != null ? points[hoverIdx][0] : 0;
  const hoverY = hoverIdx != null ? points[hoverIdx][1] : 0;
  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  const tickIdxs =
    data.length <= 1
      ? data.length === 1
        ? [0]
        : []
      : [
          0,
          Math.round((data.length - 1) / 2),
          data.length - 1,
        ].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1 text-xs">
        {GRANULARITY_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => {
              setGranularity(opt.key);
              setHoverIdx(null);
            }}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              granularity === opt.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">
          데이터 없음
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label="요청 건수 추이"
          >
            {Array.from({ length: gridLines + 1 }).map((_, i) => {
              const y = PAD.top + (i / gridLines) * (HEIGHT - PAD.top - PAD.bottom);
              const v = Math.round(maxY - (i / gridLines) * maxY);
              return (
                <g key={i}>
                  <line
                    x1={PAD.left}
                    x2={WIDTH - PAD.right}
                    y1={y}
                    y2={y}
                    stroke="#e1e0d9"
                    strokeWidth={1}
                  />
                  <text x={4} y={y + 3} fontSize={10} fill="#898781">
                    {v}
                  </text>
                </g>
              );
            })}
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={HEIGHT - PAD.bottom}
              y2={HEIGHT - PAD.bottom}
              stroke="#c3c2b7"
              strokeWidth={1}
            />

            {tickIdxs.map((i) => (
              <text
                key={i}
                x={points[i][0]}
                y={HEIGHT - PAD.bottom + 16}
                textAnchor="middle"
                fontSize={10}
                fill="#898781"
              >
                {formatTick(data[i].date, granularity)}
              </text>
            ))}

            <path
              d={path}
              fill="none"
              stroke="#2a78d6"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {hoverIdx != null && (
              <>
                <line
                  x1={hoverX}
                  x2={hoverX}
                  y1={PAD.top}
                  y2={HEIGHT - PAD.bottom}
                  stroke="#c3c2b7"
                  strokeWidth={1}
                  strokeDasharray="3,3"
                />
                <circle
                  cx={hoverX}
                  cy={hoverY}
                  r={4}
                  fill="#2a78d6"
                  stroke="#fcfcfb"
                  strokeWidth={2}
                />
              </>
            )}

            <rect
              x={PAD.left}
              y={PAD.top}
              width={WIDTH - PAD.left - PAD.right}
              height={HEIGHT - PAD.top - PAD.bottom}
              fill="transparent"
              onPointerMove={handleMove}
              onPointerLeave={() => setHoverIdx(null)}
            />
          </svg>
          {hover && (
            <div
              className="pointer-events-none absolute rounded-md border border-gray-200 bg-white px-2 py-1 text-xs whitespace-nowrap shadow-sm"
              style={{
                left: `${(hoverX / WIDTH) * 100}%`,
                top: `${(hoverY / HEIGHT) * 100}%`,
                transform: "translate(-50%, -130%)",
              }}
            >
              <div className="font-medium text-gray-900">
                {formatTooltipDate(hover.date, granularity)}
              </div>
              <div className="text-gray-600">{hover.count}건</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
