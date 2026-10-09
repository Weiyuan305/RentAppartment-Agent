import { notFound } from "next/navigation";
import { listings } from "@/lib/rental-data";
import ListingDetail from "@/components/listing-detail";
export default async function ListingPage({params}:{params:Promise<{id:string}>}) {const {id}=await params;const listing=listings.find(l=>l.id===id);if(!listing)notFound();return <ListingDetail listing={listing}/>;}
