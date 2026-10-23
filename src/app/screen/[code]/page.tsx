import { ScreenRoom } from '@/client/components/ScreenView';

export const metadata = { title: 'Big screen · Huddle' };

export default async function ScreenCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ScreenRoom code={code.toUpperCase()} />;
}
