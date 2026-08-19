import { NextResponse } from "next/server";
import {
  ARKVX_SHARES_EST,
  ARKVX_SHARES_EST_ASOF,
} from "../../../lib/aiFundBasis.mjs";

// Interval-fund SO drifts with subscriptions. Until a stable ARK issuer
// endpoint is wired, this returns the last curated print (2026-07-31).
export async function GET() {
  return NextResponse.json({
    shares: ARKVX_SHARES_EST,
    asOf: ARKVX_SHARES_EST_ASOF,
    source: "curated",
  });
}
