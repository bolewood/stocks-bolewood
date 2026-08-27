import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PrivateTapeDashboard from "@/components/PrivateTapeDashboard";

const TITLE = "Private Tape | DXYZ Tape Lab";
const DESCRIPTION =
  "Compare Anthropic's private/pre-IPO tape and SpaceX's public 24/7 tape against DXYZ. Tests whether overnight tape returns lead the next NYSE open.";

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
