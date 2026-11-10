import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InvestorDayTape from "@/components/InvestorDayTape";

const TITLE = "Anthropic IPO Tape";
const DESCRIPTION =
  "Live tape from Anthropic's Oct 14 investor day through the IPO: the S-1/A $70–$78 range vs Hyperliquid io:ANTH and Polymarket on stated share bases, IPO odds, filing figures with page citations, and public proxies vs QQQ. Public market data only.";

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
