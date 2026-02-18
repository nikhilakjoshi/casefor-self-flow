import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { assemblePackage } from '@/lib/package-assembly'

export async function GET(
  _request: Request,
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

  const [structure, versions] = await Promise.all([
    assemblePackage(caseId),
    db.packageVersion.findMany({
      where: { caseId },
      select: { id: true, version: true, label: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return Response.json({ structure, versions })
}
