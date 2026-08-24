import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SFTBYSOTPFinder from "@/components/SFTBYSOTPFinder";

export const metadata = {
  title: "SFTBY SOTP Finder",
  description:
    "Holdco sum-of-the-parts calculator for SoftBank Group (OTCPK: SFTBY / TSE: 9984). Live Arm mark, OpenAI stripped from SVF2, and IR-adjusted SBG net debt — not consolidated EV.",
  openGraph: {
    title: "SFTBY SOTP Finder",
    description:
      "Holdco sum-of-the-parts calculator for SoftBank Group (OTCPK: SFTBY / TSE: 9984).",
    url: "https://stocks.bolewood.com/sftby",
  },
  twitter: {
    card: "summary_large_image",
    title: "SFTBY SOTP Finder",
  },
};

export default function SFTBYPage() {
  return (
    <>
      <Header />
      <SFTBYSOTPFinder />
      <Footer />
    </>
  );
}
