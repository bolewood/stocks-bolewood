import ipoTape from "../data/anthropic-investor-day.json";

// Site-wide note for pages that show Anthropic filing figures.
export default function AnthropicSources() {
  const filings = ipoTape.filings || [];
  return (
    <aside aria-label="Anthropic primary sources" style={{ maxWidth: "1180px", margin: "0 auto", padding: "8px 24px 0", fontFamily: "var(--font-mono), monospace", fontSize: "11px", lineHeight: 1.6, color: "#57534e" }}>
      Primary sources:{" "}
      {filings.map((f, i) => (
        <span key={f.key}>
          {i > 0 ? ", " : ""}
          <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: "#1d4ed8" }}>
            {f.label}
          </a>{" "}
          ({f.acceptedEt.replace(/, \d{4},.*$/, "")})
        </span>
      ))}
      . S-1/A No. 2 supersedes the S-1&apos;s June 30 derived share count (price range, outstanding and fully diluted counts); S-1/A No. 1 supersedes press-reported Q3 figures; S-1/A No. 2 supersedes S-1/A No. 1&apos;s commitments. Pages cited are the printed pages of the filing named.
    </aside>
  );
}
