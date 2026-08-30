"use client";

import { kstDateKey } from "@/lib/sheetData";
import type { Filters } from "@/lib/dashboardStats";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  types: string[];
  agents: string[];
  statuses: string[];
}

const PRESETS: { label: string; days: number | null }[] = [
  { label: "오늘", days: 0 },
  { label: "최근 7일", days: 7 },
  { label: "최근 30일", days: 30 },
  { label: "최근 90일", days: 90 },
  { label: "전체", days: null },
];

export function FiltersBar({ filters, onChange, types, agents, statuses }: Props) {
  function applyPreset(days: number | null) {
    if (days == null) {
      onChange({ ...filters, from: null, to: null });
      return;
    }
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onChange({ ...filters, from: kstDateKey(from), to: kstDateKey(to) });
  }

  const isPresetActive = (days: number | null) => {
    if (days == null) return !filters.from && !filters.to;
    const from = new Date();
    from.setDate(from.getDate() - days);
    return filters.from === kstDateKey(from) && filters.to === kstDateKey(new Date());
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1 text-xs">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.days)}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              isPresetActive(p.days)
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <input
          type="date"
          value={filters.from ?? ""}
          max={filters.to ?? undefined}
          onChange={(e) => onChange({ ...filters, from: e.target.value || null })}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
          aria-label="시작일"
        />
        <span>~</span>
        <input
          type="date"
          value={filters.to ?? ""}
          min={filters.from ?? undefined}
          onChange={(e) => onChange({ ...filters, to: e.target.value || null })}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
          aria-label="종료일"
        />
      </div>
      <select
        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700"
        value={filters.type}
        onChange={(e) => onChange({ ...filters, type: e.target.value })}
      >
        <option value="all">전체 문의유형</option>
        {types.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700"
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
      >
        <option value="all">전체 상태</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700"
        value={filters.agent}
        onChange={(e) => onChange({ ...filters, agent: e.target.value })}
      >
        <option value="all">전체 담당자</option>
        {agents.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <div className="relative min-w-[220px] flex-1">
        <svg
          viewBox="0 0 20 20"
          className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <circle cx="9" cy="9" r="6" />
          <line x1="18" y1="18" x2="13.6" y2="13.6" />
        </svg>
        <input
          type="text"
          placeholder="요청자·주문번호·내용 검색"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full rounded-lg border-2 border-gray-300 bg-white py-1.5 pr-2.5 pl-8 text-xs text-gray-800 shadow-sm outline-none placeholder:text-gray-400 focus:border-[#2a78d6] focus:ring-2 focus:ring-[#2a78d6]/15"
        />
      </div>
    </div>
  );
}
