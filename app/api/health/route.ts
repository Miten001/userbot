import { NextResponse } from "next/server";
import { configStatus } from "@/lib/config";

/** GET /api/health — quick configuration sanity check. Used by /admin/setup. */
export async function GET() {
  return NextResponse.json(configStatus());
}
