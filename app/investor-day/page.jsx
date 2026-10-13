import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InvestorDayTape from "@/components/InvestorDayTape";

const TITLE = "Anthropic Investor Day Tape";
const DESCRIPTION =
  "Live tape for Anthropic's Oct 14, 2026 investor day: Hyperliquid io:ANTH implied valuation, Polymarket and Kalshi IPO odds, and public proxies vs QQQ. Public market data only.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: `${TITLE} | stocks.bolewood.com`,
    description: DESCRIPTION,
    url: "https://stocks.bolewood.com/investor-day",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | stocks.bolewood.com`,
    description: DESCRIPTION,
  },
};

export default function InvestorDayPage() {
  return (
    <>
      <Header />
      <InvestorDayTape />
      <Footer />
    </>
  );
}
