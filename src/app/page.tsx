import HomeContent from "./HomeContent";
import { getConfig } from "@/lib/config";

export default async function Home() {
  const cfg = await getConfig();
  return (
    <HomeContent
      price={cfg.price}
      firstButtonText={cfg.firstButtonText}
      purchaseButtonText={cfg.purchaseButtonText}
    />
  );
}
