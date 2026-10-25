import { NextResponse } from "next/server";
import { fetchTickets } from "@/lib/sheetData";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { tickets, fetchedAt, teamMapping } = await fetchTickets();
    return NextResponse.json(
      { tickets, fetchedAt, teamMapping },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
