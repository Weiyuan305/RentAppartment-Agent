import { notFound } from "next/navigation";
import { getPublicCatalogue } from "@/lib/merchant/server";
import ListingDetail from "@/components/listing-detail";
import { buildingById } from "@/lib/student/catalog";
export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const listings = await getPublicCatalogue();
  const listing = listings.find((l) => l.id === id);
  if (!listing) notFound();
  const building =
    typeof query.building === "string"
      ? buildingById(query.building)
      : undefined;
  const compare =
    typeof query.compare === "string" ? query.compare.split(",") : [];
  const compareIds =
    compare.length <= 3 &&
    new Set(compare).size === compare.length &&
    compare.every((id) =>
      listings.some((l) => l.id === id && l.cityId === listing.cityId),
    )
      ? compare
      : [];
  return (
    <ListingDetail
      listing={listing}
      buildingId={building?.cityId === listing.cityId ? building.id : undefined}
      compareIds={compareIds}
    />
  );
}
