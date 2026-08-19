// Per-leg exposure basis (how we know the number) vs Security (what is held).
// Do not merge these. A row can carry two different badges (MSFT OpenAI
// Disclosed vs Anthropic Commitment).

export const EXPOSURE_BASIS = {
  disclosed: { label: "Disclosed", evidence: "disclosed" },
  proforma: { label: "Pro forma", evidence: "disclosed" },
  historical: { label: "Historical", evidence: "disclosed" },
  filedFv: { label: "Filed FV-equiv", evidence: "filed" },
  carrying: { label: "Carrying-value-equiv", evidence: "derived" },
  roundImplied: { label: "Round-implied", evidence: "derived" },
  commitment: { label: "Commitment", evidence: "derived" },
  estimate: { label: "Estimate", evidence: "estimate" },
};

export const EVIDENCE_RANK = {
  estimate: 0,
  derived: 1,
  filed: 2,
  disclosed: 3,
};

export const DENOM_KIND = {
  marketCap: { label: "Market cap", short: "mkt cap" },
  netAssets: { label: "Total net assets", short: "TNA" },
  adrMarketCap: { label: "Issuer-equivalent market cap", short: "ADR mkt cap" },
};

export function basisMeta(leg) {
  if (!leg) return null;
  return EXPOSURE_BASIS[leg.basis] || null;
}

export function evidenceOf(leg) {
  return basisMeta(leg)?.evidence || null;
}

export function weakestEvidence(wrapper) {
  const ranks = [wrapper.anthropic, wrapper.openai]
    .map(evidenceOf)
    .filter(Boolean)
    .map((e) => EVIDENCE_RANK[e] ?? 0);
  if (!ranks.length) return null;
  const min = Math.min(...ranks);
  return Object.keys(EVIDENCE_RANK).find((k) => EVIDENCE_RANK[k] === min);
}

export function freshnessLabel(level) {
  if (level === "ok") return "current";
  if (level === "amber") return "30–90d+";
  if (level === "red") return "stale";
  return "unknown";
}

// 5–6 significant figures so on-screen digits reproduce per-$100 (P0.6).
export function fmtExposurePct(n, { max = false } = {}) {
  if (!(n > 0)) return "—";
  const pct = n * 100;
  let body;
  if (pct >= 1) body = `${pct.toFixed(2)}%`;
  else if (pct >= 0.1) body = `${pct.toFixed(3)}%`;
  else body = `${pct.toPrecision(6)}%`;
  return max ? `≤${body}` : body;
}

export function fmtUsdPrecise(n) {
  if (!(n > 0)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(3)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(3)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(3)}M`;
  return `$${n.toLocaleString("en-US")}`;
}
