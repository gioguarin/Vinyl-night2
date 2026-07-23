import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import LiveFeed from "@/components/LiveFeed";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function ProjectorPage({ params }: Props) {
  const { slug } = await params;
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) notFound();

  return (
    <main className="mx-auto max-w-5xl px-8 py-10">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">{event.title}</p>
        <Link href={`/e/${event.slug}`} className="font-mono text-xs text-muted hover:text-amber">
          event page →
        </Link>
      </div>
      <LiveFeed eventId={event.id} variant="projector" />
    </main>
  );
}
