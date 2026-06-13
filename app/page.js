import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

const tools = [
  {
    slug: "/vcx",
    name: "VCX NAV Finder",
    status: "live",
    description:
      "Interactive calculator for the Fundrise Innovation Fund (NYSE: VCX). Mark each underlying private-company position to current secondary-market prices and see the implied premium to net asset value.",
    tag: "NYSE: VCX",
  },
  {
    slug: "/dxyz",
    name: "DXYZ NAV Finder",
    status: "live",
    description:
      "Interactive calculator to estimate the real-time Net Asset Value of Destiny Tech100 (NYSE: DXYZ). Adjust underlying valuations and SPV multipliers to see implied premiums.",
    tag: "NYSE: DXYZ",
  },
  {
    slug: "/bot",
    name: "BOT NAV Finder",
    status: "live",
    description:
      "Interactive calculator to estimate the Net Asset Value of RoboStrategy (NASDAQ: BOT). Mark private robotics shares (Apptronik, Figure AI) to market to determine the implied premium.",
    tag: "NASDAQ: BOT",
  },
  {
    slug: "/sats",
    name: "SATS SOTP Finder",
    status: "live",
    description:
      "Sum-of-the-parts & SpaceX proxy calculator for EchoStar Corp (NASDAQ: SATS). Visualize the SpaceX re-rate upside against spectrum tax liabilities and credit default risk.",
    tag: "NASDAQ: SATS",
  },
];

export default function HomePage() {
  return (
    <>
      <Header />
      <main style={styles.main}>
        <div style={styles.hero}>
          <div style={styles.eyebrow}>BOLEWOOD GROUP · PUBLIC MARKET RESEARCH</div>
          <h1 style={styles.title}>
            Analytical tools for
            <br />
            <span style={styles.titleAccent}>public markets</span>
          </h1>
          <p style={styles.subtitle}>
            Open-source calculators and dashboards for closed-end funds,
            private-company wrapper vehicles, and other corners of the market
            where the math is hard to find.
          </p>
        </div>

        <div style={styles.toolsSection}>
          <div style={styles.toolsHeader}>
            <span style={styles.sectionNum}>01</span>
            <h2 style={styles.sectionTitle}>Available Tools</h2>
          </div>

          <div style={styles.toolGrid}>
            {tools.map((tool) => (
              <div key={tool.slug} style={styles.toolCard}>
                <div style={styles.cardTop}>
                  <span
                    style={{
                      ...styles.tag,
                      ...(tool.status === "live"
                        ? styles.tagLive
                        : styles.tagComing),
                    }}
                  >
                    {tool.status === "live" ? "Live" : "Coming Soon"}
                  </span>
                  <span style={styles.ticker}>{tool.tag}</span>
                </div>
                <h3 style={styles.cardTitle}>{tool.name}</h3>
                <p style={styles.cardDesc}>{tool.description}</p>
                {tool.status === "live" ? (
                  <Link href={tool.slug} style={styles.cardLink}>
                    Open tool →
                  </Link>
                ) : (
                  <span style={styles.cardLinkDisabled}>In development</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

const styles = {
  main: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "0 56px",
  },
  hero: {
    paddingTop: "80px",
    paddingBottom: "64px",
    borderBottom: "1px solid #e7e5e4",
  },
  eyebrow: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.18em",
    color: "#78716c",
    marginBottom: "20px",
    fontWeight: 500,
  },
  title: {
    fontSize: "56px",
    lineHeight: 1.05,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    margin: "0 0 24px 0",
    color: "#1c1917",
  },
  titleAccent: {
    color: "#d97706",
    fontStyle: "italic",
    fontWeight: 600,
  },
  subtitle: {
    fontSize: "18px",
    lineHeight: 1.6,
    color: "#44403c",
    maxWidth: "560px",
    margin: 0,
  },
  toolsSection: {
    paddingTop: "48px",
  },
  toolsHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: "16px",
    marginBottom: "32px",
    paddingBottom: "8px",
    borderBottom: "1px solid #d6d3d1",
  },
  sectionNum: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "12px",
    color: "#d97706",
    fontWeight: 700,
    letterSpacing: "0.05em",
  },
  sectionTitle: {
    fontSize: "22px",
    fontWeight: 600,
    margin: 0,
    letterSpacing: "-0.01em",
  },
  toolGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "20px",
  },
  toolCard: {
    border: "1px solid #e7e5e4",
    padding: "28px 24px",
    background: "#fefdf8",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  tag: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "3px 8px",
  },
  tagLive: {
    background: "#f0fdf4",
    color: "#15803d",
    border: "1px solid #bbf7d0",
  },
  tagComing: {
    background: "#f5f5f4",
    color: "#78716c",
    border: "1px solid #d6d3d1",
  },
  ticker: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    color: "#78716c",
    fontWeight: 500,
    letterSpacing: "0.04em",
  },
  cardTitle: {
    fontSize: "20px",
    fontWeight: 700,
    margin: "0 0 10px 0",
    color: "#1c1917",
  },
  cardDesc: {
    fontSize: "14px",
    lineHeight: 1.55,
    color: "#57534e",
    margin: "0 0 20px 0",
  },
  cardLink: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "12px",
    fontWeight: 600,
    color: "#d97706",
    textDecoration: "none",
    letterSpacing: "0.04em",
    borderBottom: "1px solid #d97706",
    paddingBottom: "2px",
    transition: "color 0.15s ease",
  },
  cardLinkDisabled: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "12px",
    fontWeight: 500,
    color: "#a8a29e",
    letterSpacing: "0.04em",
  },
};
