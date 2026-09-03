"use client";

import { useMemo, useState } from "react";
import type { CheckRequest } from "@/lib/checkRequests";

export function CheckRequestList({ items }: { items: CheckRequest[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const types = useMemo(
    () => [...new Set(items.map((i) => i.requestType))].sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => typeFilter === "all" || i.requestType === typeFilter)
      .filter((i) => {
        if (!q) return true;
        const hay =
          `${i.confirmRequester} ${i.originalRequester} ${i.requestType} ${i.reason}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""));
  }, [items, search, typeFilter]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
        >
          <option value="all">전체 요청 유형</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="요청자·사유 검색"
          className="min-w-[180px] flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700"
        />
        <span className="text-xs text-gray-400">{filtered.length}건</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2 pr-3 font-medium">확인 요청 일시</th>
              <th className="py-2 pr-3 font-medium">확인 요청자</th>
              <th className="py-2 pr-3 font-medium">원문 요청자</th>
              <th className="py-2 pr-3 font-medium">요청 유형</th>
              <th className="py-2 pr-3 font-medium">세부 사유</th>
              <th className="py-2 font-medium">원문 링크</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i, idx) => (
              <tr
                key={`${i.requestedAt ?? i.requestedLabel}-${idx}`}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="py-2 pr-3 tabular-nums whitespace-nowrap text-gray-600">
                  {i.requestedLabel ?? "-"}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap text-gray-900">
                  {i.confirmRequester || "-"}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                  {i.originalRequester || "-"}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                  {i.requestType}
                </td>
                <td className="py-2 pr-3 text-gray-700">{i.reason || "-"}</td>
                <td className="py-2">
                  {i.link ? (
                    <a
                      href={i.link}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md bg-violet-50 px-2 py-1 font-medium text-violet-700 hover:bg-violet-100"
                    >
                      원문 보기 →
                    </a>
                  ) : (
                    <span className="text-gray-300">링크 없음</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400">
                  조건에 맞는 체크 요청이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
