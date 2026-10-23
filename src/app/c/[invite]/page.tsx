import { CrewInvite } from '@/client/components/CrewPages';

export default async function InvitePage({ params }: { params: Promise<{ invite: string }> }) {
  const { invite } = await params;
  return <CrewInvite token={invite} />;
}
