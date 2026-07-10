import Link from "next/link";

export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.inner}>
        <div style={styles.disclosure}>
          This site is for informational and educational purposes only. It does
          not constitute investment advice, an offer to buy or sell securities,
          or a recommendation of any kind. The author makes no warranty as to
          the accuracy of any figures shown. Do your own work.
        </div>

        <div style={styles.bottom}>
          <div style={styles.links}>
            <Link href="/" style={styles.link}>
              Home
            </Link>
            <span style={styles.sep}>·</span>
            <Link href="/vcx" style={styles.link}>
              VCX NAV Finder
            </Link>
            <span style={styles.sep}>·</span>
            <Link href="/echo" style={styles.link}>
              ECHO SOTP Finder
            </Link>
            <span style={styles.sep}>·</span>
            <Link href="/about" style={styles.link}>
              About
            </Link>
            <span style={styles.sep}>·</span>
            <a
              href="https://bolewood.com"
              style={styles.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              bolewood.com
            </a>
          </div>
          <div style={styles.copy}>
            © {new Date().getFullYear()} Bolewood Group, LLC
          </div>
        </div>
      </div>
    </footer>
  );
}

const styles = {
  footer: {
    borderTop: "1px solid #e7e5e4",
    background: "#fafaf9",
    marginTop: "64px",
  },
  inner: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "32px 56px",
  },
  disclosure: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "10px",
    color: "#a8a29e",
    letterSpacing: "0.03em",
    lineHeight: 1.7,
    maxWidth: "680px",
    marginBottom: "24px",
    fontStyle: "italic",
  },
  bottom: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
  },
  links: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
  },
  link: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    fontWeight: 500,
    color: "#78716c",
    textDecoration: "none",
    letterSpacing: "0.04em",
    transition: "color 0.15s ease",
  },
  sep: {
    color: "#d6d3d1",
    fontSize: "11px",
  },
  copy: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#a8a29e",
    letterSpacing: "0.04em",
  },
};
