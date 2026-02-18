import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string; versionId: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id, versionId } = await params

  const version = await db.agentPromptVersion.findFirst({
    where: { id: versionId, promptId: id },
  })

  if (!version) {
    return new Response('Not found', { status: 404 })
  }

  return NextResponse.json(version)
}
