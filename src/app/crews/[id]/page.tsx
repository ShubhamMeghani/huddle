import { CrewPage } from '@/client/components/CrewPages';

export default async function CrewRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CrewPage id={id} />;
}
