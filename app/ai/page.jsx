import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AIPerDollarFinder from "@/components/AIPerDollarFinder";

const OG_TITLE = "Pre-IPO Anthropic & OpenAI per $100 | stocks.bolewood.com";
const DESCRIPTION =
  "Estimated Anthropic and OpenAI exposure per $100 of wrapper value. Market value for listed securities; total net assets for unlisted funds. Live prices; curated denominator inputs. Not per share.";

export const metadata = {
  title: "Pre-IPO Anthropic & OpenAI per $100",
  description: DESCRIPTION,
  openGraph: {
    title: OG_TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og-ai.png", width: 1200, height: 630 }],
    url: "https://stocks.bolewood.com/ai",
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: DESCRIPTION,
    images: ["/og-ai.png"],
  },
};

export default function AIPage() {
  return (
    <>
      <Header />
      <AIPerDollarFinder />
      <Footer />
    </>
  );
}
