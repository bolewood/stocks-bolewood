import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InvestorDayTape from "@/components/InvestorDayTape";

const TITLE = "Anthropic IPO Tape";
const DESCRIPTION =
  "Live tape from Anthropic's Oct 14 investor day through the IPO: Hyperliquid io:ANTH implied valuation, Polymarket and Kalshi IPO odds, investor-day figures with sources, and public proxies vs QQQ. Public market data only.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: `${TITLE} | stocks.bolewood.com`,
    description: DESCRIPTION,
    url: "https://stocks.bolewood.com/anthropic-ipo-tape",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | stocks.bolewood.com`,
    description: DESCRIPTION,
  },
};

export default function AnthropicIpoTapePage() {
  return (
    <>
      <Header />
      <InvestorDayTape />
      <Footer />
    </>
  );
}
