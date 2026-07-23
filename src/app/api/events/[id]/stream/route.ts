import { prisma } from "@/lib/db";
import { findEvent, publicEvent } from "@/lib/auth";
import { bus, channel } from "@/lib/bus";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const event = await findEvent(id);
  if (!event) return new Response("Event not found", { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const write = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          open = false;
        }
      };
      const send = (data: unknown) => write(`data: ${JSON.stringify(data)}\n\n`);

      // Hello frame: current state so late joiners sync instantly.
      const tracks = await prisma.track.findMany({
        where: { eventId: event.id, hidden: false },
        orderBy: { recognizedAt: "desc" },
        take: 10,
      });
      send({ type: "hello", event: publicEvent(event), tracks });

      const onMessage = (payload: unknown) => send(payload);
      bus.on(channel(event.id), onMessage);

      const heartbeat = setInterval(() => write(`: ping\n\n`), 25_000);

      const cleanup = () => {
        open = false;
        clearInterval(heartbeat);
        bus.off(channel(event.id), onMessage);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
