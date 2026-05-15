import DXYZNAVFinder from "../../components/DXYZNAVFinder";

export const metadata = {
  title: "DXYZ NAV Finder | Destiny Tech100 Calculator",
  description: "Calculate the real-time estimated Net Asset Value (NAV) of Destiny Tech100 (NYSE: DXYZ) based on current secondary market prices of Anthropic, SpaceX, OpenAI, and other holdings.",
  openGraph: {
    title: "DXYZ NAV Finder | Destiny Tech100 Calculator",
    description: "Calculate the real-time estimated Net Asset Value (NAV) of Destiny Tech100 (NYSE: DXYZ) based on current secondary market prices of Anthropic, SpaceX, OpenAI, and other holdings.",
    type: "website",
  },
};

export default function DXYZPage() {
  return (
    <main>
      <DXYZNAVFinder />
    </main>
  );
}
