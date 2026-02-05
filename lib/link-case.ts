import { db } from './db'

export async function linkPendingCase(
  userId: string,
  caseId: string
): Promise<boolean> {
  // Only link if case exists and has no owner
  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
  })

  if (!caseRecord || caseRecord.userId) {
    return false
  }

  await db.case.update({
    where: { id: caseId },
    data: { userId },
  })

  return true
}
