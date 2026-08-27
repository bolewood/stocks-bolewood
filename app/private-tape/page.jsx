import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PrivateTapeDashboard from "@/components/PrivateTapeDashboard";

const TITLE = "Private Tape | DXYZ Shadow NAV";
const DESCRIPTION =
  "Compare 24/7 Hyperliquid Anthropic and SpaceX return signals against DXYZ. Tests whether private-market price discovery leads the next NYSE open.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: `${TITLE} | stocks.bolewood.com`,
    description: DESCRIPTION,
    url: "https://stocks.bolewood.com/private-tape",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | stocks.bolewood.com`,
    description: DESCRIPTION,
  },
};

export default function PrivateTapePage() {
  return (
    <>
      <Header />
      <PrivateTapeDashboard />
      <Footer />
    </>
  );
}
