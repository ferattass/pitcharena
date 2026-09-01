import { prisma } from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/db-errors";

export async function GET(_request: Request, ctx: RouteContext<"/api/analyses/[id]">) {
  const { id } = await ctx.params;

  try {
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
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return Response.json({ error: "Veritabanına erişilemiyor." }, { status: 503 });
    }
    throw error;
  }
}
