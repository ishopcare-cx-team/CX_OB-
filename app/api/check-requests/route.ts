import { NextResponse } from "next/server";
import { fetchCheckRequests } from "@/lib/checkRequests";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { items, fetchedAt } = await fetchCheckRequests();
    return NextResponse.json(
      { items, fetchedAt },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
