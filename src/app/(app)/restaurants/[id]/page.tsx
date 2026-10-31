import RestaurantDetail from "@/views/RestaurantDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RestaurantDetail id={id} />;
}
