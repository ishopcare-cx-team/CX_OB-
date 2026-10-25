import type { CountBucket } from "@/lib/dashboardStats";

interface Props {
  data: CountBucket[];
  // 비율의 분모 — 기본은 막대 합계. 키워드처럼 한 건이 여러 막대에 걸리면 총 요청 수를 넘긴다.
  total?: number;
  // 막대를 누르면 그 항목으로 필터 (선택된 항목을 다시 누르면 해제)
  selected?: string;
  onSelect?: (key: string) => void;
}

export function BarChart({ data, total, selected, onSelect }: Props) {
  const denom = total || data.reduce((a, b) => a + b.count, 0) || 1;
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const pct = `${((d.count / denom) * 100).toFixed(1)}%`;
        const dimmed = selected && selected !== "all" && selected !== d.key;
        return (
          <div
            key={d.key}
            onClick={onSelect ? () => onSelect(d.key) : undefined}
            title={`${d.key} · ${d.count}건 (${pct})`}
            className={`grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-2 text-xs sm:grid-cols-[8.5rem_1fr_5.5rem] ${
              onSelect ? "-mx-1 cursor-pointer rounded px-1 hover:bg-gray-50" : ""
            } ${dimmed ? "opacity-40" : ""}`}
          >
            <span className="truncate text-gray-600">{d.key}</span>
            <div className="h-4 rounded bg-gray-100">
              <div
                className="h-full rounded bg-[#2a78d6]"
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            </div>
            <span className="text-right tabular-nums text-gray-900">
              <span className="font-medium">{d.count}건</span>{" "}
              <span className="text-gray-400">({pct})</span>
            </span>
          </div>
        );
      })}
      {data.length === 0 && <p className="text-gray-400">데이터 없음</p>}
    </div>
  );
}
