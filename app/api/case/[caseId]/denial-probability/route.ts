import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  streamDenialProbabilityPass1,
  streamDenialProbabilityPass2,
} from "@/lib/denial-probability"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    select: { userId: true },
  })
  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const latest = await db.denialProbability.findFirst({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  })

  return Response.json(latest?.data ?? null)
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    select: { userId: true },
  })
  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const { stream: pass1Stream, inventory } = await streamDenialProbabilityPass1(caseId)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Phase 1: stream qualitative analysis
        let pass1Final: Record<string, unknown> = {}
        for await (const partial of pass1Stream.partialOutputStream) {
          pass1Final = partial as Record<string, unknown>
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(pass1Final)}\n\n`)
          )
        }

        // Await pass 1 complete output for pass 2 input
        const pass1Output = await pass1Stream.output
        if (!pass1Output) {
          controller.close()
          return
        }

        // Phase 2: stream probability calculations, merged with pass 1
        const pass2Stream = streamDenialProbabilityPass2(pass1Output, inventory)
        for await (const partial of pass2Stream.partialOutputStream) {
          const merged = { ...pass1Final, ...(partial as Record<string, unknown>) }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(merged)}\n\n`)
          )
        }

        const pass2Output = await pass2Stream.output
        if (!pass2Output) {
          controller.close()
          return
        }

        // Merge final result
        const data = JSON.parse(JSON.stringify({ ...pass1Output, ...pass2Output }))

        // Consistency enforcement: denial_probability_pct must match final_denial_probability
        const breakdown = data.probability_breakdown
        const overall = data.overall_assessment
        if (breakdown?.final_denial_probability != null && overall) {
          overall.denial_probability_pct = breakdown.final_denial_probability
          const pct = breakdown.final_denial_probability
          overall.risk_level = pct >= 60 ? "VERY_HIGH" : pct >= 40 ? "HIGH" : pct >= 20 ? "MEDIUM" : "LOW"
        }

        // Send final consistent version
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        )

        // Save to DB
        const latestVersion = await db.denialProbability.findFirst({
          where: { caseId },
          orderBy: { version: "desc" },
          select: { version: true },
        })
        await db.denialProbability.create({
          data: {
            caseId,
            version: (latestVersion?.version ?? 0) + 1,
            data,
          },
        })

        controller.close()
      } catch (err) {
        console.error("Denial probability stream error:", err)
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
