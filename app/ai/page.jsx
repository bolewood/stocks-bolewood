import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AIPerDollarFinder from "@/components/AIPerDollarFinder";

export const metadata = {
  title: "Anthropic & OpenAI Per $",
  description:
    "Look-through calculator for public wrappers of Anthropic and OpenAI. Dollars of underlying per $100 of wrapper market cap, at a user-set IPO valuation.",
  openGraph: {
    title: "Anthropic & OpenAI Per $",
    description:
      "Look-through calculator for public Anthropic and OpenAI wrappers. Dollars of underlying per $100 of wrapper market cap. Not per share.",
    images: [{ url: "/og-ai.png", width: 1200, height: 630 }],
    url: "https://stocks.bolewood.com/ai",
  },
  twitter: {
    card: "summary_large_image",
    title: "Anthropic & OpenAI Per $",
    description:
      "Look-through calculator for public Anthropic and OpenAI wrappers. Dollars of underlying per $100 of wrapper market cap. Not per share.",
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
