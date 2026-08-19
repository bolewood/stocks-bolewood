export default function PriceBadge({ source }) {
  const live = source === "live" || source === "cache";
  const partial = source === "partial";
  return (
    <span
      style={{
        fontSize: "10px",
        fontFamily: "monospace",
        padding: "2px 6px",
        borderRadius: "3px",
        border: `1px solid ${live ? "#15803d" : partial ? "#d97706" : "#78716c"}`,
        color: live ? "#15803d" : partial ? "#d97706" : "#78716c",
        background: live ? "#f0fdf4" : partial ? "#fffbeb" : "transparent",
      }}
    >
      {live
        ? "● LIVE"
        : partial
          ? "◐ PARTIAL"
          : source === "manual"
            ? "● MANUAL"
            : source === "fallback"
              ? "○ FALLBACK"
              : "○ DEFAULT"}
    </span>
  );
}
