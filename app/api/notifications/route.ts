import { NextResponse } from "next/server";

export async function GET() {
  // Notifications are not implemented yet - return empty array
  return NextResponse.json({ notifications: [] });
}
