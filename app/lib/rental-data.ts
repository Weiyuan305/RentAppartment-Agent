export type CityId = "london" | "sydney" | "singapore" | "kuala-lumpur" | "hong-kong";
export type City = { id: CityId; name: string; english: string; country: string; flag: string; university: string; campus: string; currency: string; period: "周" | "月"; lng: number; lat: number; neighborhoods: string[]; prices: number[]; };
export const cities: City[] = [
  { id: "london", name: "伦敦", english: "London", country: "英国", flag: "🇬🇧", university: "伦敦大学学院 UCL", campus: "Bloomsbury 校区", currency: "£", period: "周", lng: -0.1339, lat: 51.5246, neighborhoods: ["Bloomsbury", "Fitzrovia", "King’s Cross", "Euston", "Camden", "Clerkenwell"], prices: [320, 385, 295, 425, 265, 350] },
  { id: "sydney", name: "悉尼", english: "Sydney", country: "澳大利亚", flag: "🇦🇺", university: "悉尼大学 USYD", campus: "Camperdown / Darlington", currency: "A$", period: "周", lng: 151.1873, lat: -33.8886, neighborhoods: ["Camperdown", "Glebe", "Chippendale", "Newtown", "Redfern", "Ultimo"], prices: [480, 560, 440, 620, 390, 520] },
  { id: "singapore", name: "新加坡", english: "Singapore", country: "新加坡", flag: "🇸🇬", university: "新加坡国立大学 NUS", campus: "Kent Ridge 校区", currency: "S$", period: "月", lng: 103.7764, lat: 1.2966, neighborhoods: ["Kent Ridge", "Clementi", "West Coast", "Dover", "Pasir Panjang", "One-North"], prices: [1450, 1900, 1250, 2300, 1100, 1650] },
  { id: "kuala-lumpur", name: "吉隆坡", english: "Kuala Lumpur", country: "马来西亚", flag: "🇲🇾", university: "马来亚大学 UM", campus: "主校区", currency: "RM", period: "月", lng: 101.6543, lat: 3.1206, neighborhoods: ["Bangsar South", "Pantai Dalam", "Bangsar", "Petaling Jaya", "Kerinchi", "Pantai Hillpark"], prices: [1300, 1650, 1050, 2100, 850, 1450] },
  { id: "hong-kong", name: "香港", english: "Hong Kong", country: "中国香港", flag: "🇭🇰", university: "香港大学 HKU", campus: "薄扶林主校区", currency: "HK$", period: "月", lng: 114.1371, lat: 22.2830, neighborhoods: ["西营盘", "坚尼地城", "石塘咀", "薄扶林", "上环", "西环"], prices: [8800, 11500, 7600, 14800, 6500, 9900] },
];
export type Listing = { id: string; cityId: CityId; name: string; area: string; price: number; roomType: "独立 Studio" | "独卫单间" | "合租单间"; size: number; bills: boolean; lng: number; lat: number; photos: string[] };
const offsets = [[.002, .004], [-.006, .001], [.009, .007], [-.003, -.004], [.006, -.01], [.013, -.002]];
export const listings: Listing[] = cities.flatMap(city => city.prices.map((price, i) => ({
  id: `${city.id}-${i+1}`, cityId: city.id, name: ["The Academic", "Chapter House", "Parkside Living", "The Greenhouse", "Union Rooms", "Atlas Residence"][i], area: city.neighborhoods[i], price,
  roomType: (["独卫单间", "独立 Studio", "合租单间", "独立 Studio", "合租单间", "独卫单间"] as const)[i], size: [19, 27, 16, 32, 14, 22][i], bills: i % 3 !== 2,
  lng: city.lng + offsets[i][0], lat: city.lat + offsets[i][1], photos: ["/photos/" + ["room-single.jpg", "room-desk.jpg", "interior-3.jpg", "living-1.jpg", "room-single.jpg", "room-desk.jpg"][i], "/photos/living-2.jpg", "/photos/kitchen.jpg"],
})));
export function getCity(id: string) { return cities.find(c => c.id === id) ?? cities[0]; }
export function priceLabel(listing: Listing) { const city = getCity(listing.cityId); return `${city.currency}${listing.price.toLocaleString("en-US")}`; }
export function cityPhoto(id: CityId) { return `/photos/${id}.jpg`; }
