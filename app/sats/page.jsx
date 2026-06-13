import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SATSSOTPFinder from "@/components/SATSSOTPFinder";

export const metadata = {
  title: "SATS SOTP Finder",
  description:
    "Sum-of-the-parts and SpaceX proxy calculator for EchoStar (NASDAQ: SATS). Visualize the SpaceX re-rate upside against corporate tax liabilities and credit default risk.",
  openGraph: {
    title: "SATS SOTP Finder",
    description:
      "Sum-of-the-parts and SpaceX proxy calculator for EchoStar (NASDAQ: SATS).",
    images: ["/og-sats.png"],
    url: "https://stocks.bolewood.com/sats",
  },
  twitter: {
    card: "summary_large_image",
    title: "SATS SOTP Finder",
    images: ["/og-sats.png"],
  },
};

export default function SATSPage() {
  return (
    <>
      <Header />
      <SATSSOTPFinder />
      <Footer />
    </>
  );
}
