import V2Shell from "@/components/v2/v2-shell";
import { readVisitorCountry } from "@/lib/v2/visitor-country.server";
import "./v2.css";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const visitor = await readVisitorCountry(firstParam(params.geo));
  return <V2Shell mode="overview" country={visitor.country} countrySource={visitor.source} mapQuery={firstParam(params.map)} />;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
