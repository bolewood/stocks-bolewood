// Banner for retired calculators. They stay online for reference but their
// curated inputs (filings, share counts, assumptions) are no longer maintained.
// `livePrices` pages still fetch market quotes; everything else is frozen at
// `lastUpdated`.
export const ARCHIVED_TOOLS = {
  "/private-tape": { name: "Private Tape", lastUpdated: "Nov 16, 2026", livePrices: true },
  "/echo": { name: "ECHO SOTP Finder", lastUpdated: "Aug 24, 2026", livePrices: true },
  "/sftby": { name: "SFTBY SOTP Finder", lastUpdated: "Sep 5, 2026", livePrices: true },
  "/muse": { name: "Muse Compute Split", lastUpdated: "Sep 25, 2026", livePrices: false },
};

export default function ArchivedBanner({ slug }) {
  const tool = ARCHIVED_TOOLS[slug];
  if (!tool) return null;
  return (
    <div role="note" style={styles.wrap}>
      <div style={styles.inner} className="archived-banner-inner">
        <span style={styles.kicker}>Archived</span>
        <span style={styles.text}>
          {tool.name} is no longer updated. Its filings, share counts and assumptions are as of{" "}
          <b>{tool.lastUpdated}</b> and may be out of date.
          {tool.livePrices ? " Market prices still load live, but the rest of the page is not maintained." : ""}
        </span>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    background: "#fef3c7",
    borderBottom: "1px solid #fcd34d",
  },
  inner: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "10px 56px",
    display: "flex",
    gap: "12px",
    alignItems: "baseline",
    flexWrap: "wrap",
  },
  kicker: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#92400e",
  },
  text: {
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#78350f",
  },
};
