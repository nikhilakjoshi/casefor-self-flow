import { db } from '@/lib/db'
import type { SharePermission } from '@prisma/client'

export async function getShareAccess(
  shareId: string,
  userId: string,
  requiredPermission?: SharePermission[]
) {
  const share = await db.documentShare.findUnique({
    where: { id: shareId },
    include: {
      document: true,
    },
  })

  if (!share || share.status !== 'ACCEPTED' || share.inviteeId !== userId) {
    return null
  }

  if (requiredPermission && !requiredPermission.includes(share.permission)) {
    return null
  }

  return share
}
