import { prisma } from "@/lib/db";

export async function GET(_request: Request, ctx: RouteContext<"/api/analyses/[id]">) {
  const { id } = await ctx.params;

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: {
      runs: {
        orderBy: [{ round: "asc" }, { agentKey: "asc" }],
        include: { citations: true },
      },
      scores: true,
    },
  });

  if (!analysis) {
    return Response.json({ error: "Analiz bulunamadı" }, { status: 404 });
  }

  return Response.json({ analysis });
}
