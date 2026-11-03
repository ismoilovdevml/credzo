import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import packageJson from "@/package.json";

export const dynamic = "force-dynamic";

/**
 * GET /api/health (public, used by the Docker healthcheck)
 * 200 { status: "ok", db: "ok", version } or 503 { status: "error", db: "error", version }.
 */
export function GET() {
  let dbStatus: "ok" | "error" = "ok";
  try {
    getDb().prepare("SELECT 1").get();
  } catch (error) {
    console.error("[health] database check failed:", error);
    dbStatus = "error";
  }

  const healthy = dbStatus === "ok";
  return NextResponse.json(
    { status: healthy ? "ok" : "error", db: dbStatus, version: packageJson.version },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
