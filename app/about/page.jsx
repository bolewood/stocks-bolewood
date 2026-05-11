import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "About",
  description:
    "About stocks.bolewood.com — analytical tools for public market research by Anthony Showalter.",
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main style={styles.main}>
        <div style={styles.header}>
          <div style={styles.eyebrow}>ABOUT THIS SITE</div>
          <h1 style={styles.title}>About</h1>
        </div>

        <div style={styles.content}>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>What is this?</h2>
            <p style={styles.text}>
              <strong>stocks.bolewood.com</strong> is a collection of
              open-source analytical tools for public market research, built and
              maintained by Anthony Showalter. The focus is on closed-end funds,
              private-company wrapper vehicles, and other corners of the market
              where the underlying math is hard to find or poorly presented
              elsewhere.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Who built this?</h2>
            <p style={styles.text}>
              Anthony Showalter is the founder of{" "}
              <a
                href="https://bolewood.com"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                Bolewood Group
              </a>
              . These tools are built for personal research and shared publicly
              because the analysis is more useful when more people can check the
              work.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Disclosures</h2>
            <div style={styles.disclosureBox}>
              <p style={styles.disclosureText}>
                This site is for informational and educational purposes only. It
                does not constitute investment advice, an offer to buy or sell
                securities, or a recommendation of any kind. The author may hold
                positions in securities discussed on this site. The author makes
                no warranty as to the accuracy of any figures shown. Past
                performance is not indicative of future results. Do your own
                work.
              </p>
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Contact</h2>
            <p style={styles.text}>
              Corrections, suggestions, and data contributions are welcome.
              Reach out via{" "}
              <a
                href="https://bolewood.com"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.link}
              >
                bolewood.com
              </a>
              .
            </p>
          </section>
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
  header: {
    paddingTop: "64px",
    paddingBottom: "32px",
    borderBottom: "1px solid #1c1917",
    marginBottom: "40px",
  },
  eyebrow: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "11px",
    letterSpacing: "0.18em",
    color: "#78716c",
    marginBottom: "16px",
    fontWeight: 500,
  },
  title: {
    fontSize: "48px",
    lineHeight: 1,
    fontWeight: 800,
    margin: 0,
    letterSpacing: "-0.03em",
  },
  content: {
    maxWidth: "640px",
  },
  section: {
    marginBottom: "40px",
  },
  sectionTitle: {
    fontSize: "20px",
    fontWeight: 700,
    margin: "0 0 12px 0",
    letterSpacing: "-0.01em",
  },
  text: {
    fontSize: "16px",
    lineHeight: 1.65,
    color: "#44403c",
    margin: 0,
  },
  link: {
    color: "#d97706",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  disclosureBox: {
    background: "#f5f5f4",
    border: "1px solid #d6d3d1",
    padding: "20px 24px",
  },
  disclosureText: {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    fontSize: "12px",
    color: "#57534e",
    lineHeight: 1.7,
    letterSpacing: "0.02em",
    margin: 0,
  },
};
