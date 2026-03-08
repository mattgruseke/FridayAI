import ListDetail from "@/views/ListDetail";

type Props = {
  params: Promise<{ listId: string }>;
};

export default async function Page({ params }: Props) {
  const { listId } = await params;
  return <ListDetail listId={listId} />;
}
