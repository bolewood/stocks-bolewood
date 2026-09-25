import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MuseComputeFinder from "@/components/MuseComputeFinder";
import { readMuseScenario } from "@/lib/museCompute.mjs";

export const metadata = {
  title: "Muse Compute Split",
  description:
    "Research calculator for Meta Muse compute: token burn, duty-cycle versus always-on VMs, and an explicit assumption for how much of the runtime could land at AWS.",
  openGraph: {
    title: "Muse Compute Split",
    description:
      "Duty-cycle CPU, token burn, and VM persistence, with sliders for a Graviton, EC2, and Bedrock split.",
    url: "https://stocks.bolewood.com/muse",
  },
};

export default async function MusePage({ searchParams }) {
  const query = await searchParams;
  const params = new URLSearchParams(
    Object.entries(query || {}).filter(([, value]) => typeof value === "string"),
  );
  const scenario = readMuseScenario(params);
  return (
    <>
      <Header />
      <MuseComputeFinder initialInputs={scenario.inputs} initialPreset={scenario.preset} />
      <Footer />
    </>
  );
}
