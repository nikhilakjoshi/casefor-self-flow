import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { assemblePackage } from '@/lib/package-assembly'
import type { PackageStructure } from '@/lib/package-assembly'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    select: { id: true, userId: true },
  })

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response('Not found', { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const label = body.label || null

  // Build live structure
  const structure = await assemblePackage(caseId)

  // Freeze letter content: snapshot all SYSTEM_GENERATED doc contents
  const allDocIds = structure.exhibits.flatMap((e) =>
    e.documents.filter((d) => d.source === 'SYSTEM_GENERATED').map((d) => d.documentId)
  )

  const letterDocs = allDocIds.length > 0
    ? await db.document.findMany({
        where: { id: { in: allDocIds } },
        select: { id: true, content: true },
      })
    : []

  const letterSnapshots: Record<string, string> = {}
  for (const doc of letterDocs) {
    if (doc.content) letterSnapshots[doc.id] = doc.content
  }

  const data: PackageStructure = {
    ...structure,
    letterSnapshots,
  }

  // Determine next version number
  const lastVersion = await db.packageVersion.findFirst({
    where: { caseId },
    orderBy: { version: 'desc' },
    select: { version: true },
  })

  const version = (lastVersion?.version ?? 0) + 1

  const saved = await db.packageVersion.create({
    data: {
      caseId,
      version,
      label,
      data: JSON.parse(JSON.stringify(data)),
    },
  })

  return Response.json({
    id: saved.id,
    version: saved.version,
    label: saved.label,
    createdAt: saved.createdAt,
  })
}
