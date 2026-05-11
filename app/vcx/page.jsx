import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VCXNAVFinder from "@/components/VCXNAVFinder";

export const metadata = {
  title: "VCX NAV Finder",
  description:
    "Interactive calculator for the Fundrise Innovation Fund (NYSE: VCX). Mark each underlying private-company position to current secondary-market prices and see the implied premium to net asset value.",
  openGraph: {
    title: "VCX NAV Finder",
    description:
      "Estimate VCX net asset value from underlying secondary marks.",
    images: ["/og-vcx.png"],
    url: "https://stocks.bolewood.com/vcx",
  },
  twitter: {
    card: "summary_large_image",
    title: "VCX NAV Finder",
    images: ["/og-vcx.png"],
  },
};

export default function VCXPage() {
  return (
    <>
      <Header />
      <VCXNAVFinder />
      <Footer />
    </>
  );
}
