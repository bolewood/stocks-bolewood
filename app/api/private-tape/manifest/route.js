import { NextResponse } from "next/server";
import { privateTapeOpenDataManifest } from "../../../../lib/privateTapeManifest.mjs";

export const dynamic = "force-static";

const MANIFEST_HEADERS = {
  "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
};

export async function GET() {
  return NextResponse.json(privateTapeOpenDataManifest(), {
    headers: MANIFEST_HEADERS,
  });
}
