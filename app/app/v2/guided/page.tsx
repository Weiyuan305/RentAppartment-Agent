import { headers } from "next/headers";
import GuidedFlow from "@/components/guided/guided-flow";
import { visitorCountry } from "@/lib/guided/map-provider";
import "./guided.css";

export default async function GuidedPage() {
  const country = visitorCountry((await headers()).get("cf-ipcountry"));
  return <GuidedFlow country={country} />;
}
