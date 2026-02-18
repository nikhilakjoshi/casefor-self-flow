import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; versionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId, versionId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    select: { id: true, userId: true },
  })

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response('Not found', { status: 404 })
  }

  const pv = await db.packageVersion.findFirst({
    where: { id: versionId, caseId },
  })

  if (!pv) {
    return new Response('Version not found', { status: 404 })
  }

  return Response.json({
    id: pv.id,
    version: pv.version,
    label: pv.label,
    createdAt: pv.createdAt,
    structure: pv.data,
  })
}
