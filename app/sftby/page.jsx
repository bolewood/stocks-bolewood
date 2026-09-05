import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SFTBYSOTPFinder from "@/components/SFTBYSOTPFinder";
import { readSotpScenario } from "@/lib/sftbyScenario.mjs";

export const metadata = {
  title: "SFTBY SOTP Finder",
  description:
    "Holdco sum-of-the-parts calculator for SoftBank Group (OTCPK: SFTBY / TSE: 9984). Sourced June NAV bridge, current Arm quotes, OpenAI IPO and dilution scenarios, management-allocation sensitivity and funding adjustments.",
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

export default async function SFTBYPage({ searchParams }) {
  const query = await searchParams;
  const params = new URLSearchParams(Object.entries(query || {}).filter(([, value]) => typeof value === "string"));
  const scenario = readSotpScenario(params);
  return (
    <>
      <Header />
      <SFTBYSOTPFinder initialInputs={scenario.inputs} initialScenario={scenario.key}
        pinnedFields={[...scenario.pinned]} reference={params.get("reference") === "sftby"} />
      <Footer />
    </>
  );
}
