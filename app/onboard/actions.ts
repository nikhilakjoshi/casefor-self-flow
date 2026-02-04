'use server'

import { db } from '@/lib/db'
import { parseFile, FileParseError } from '@/lib/file-parser'
import { chunkText } from '@/lib/chunker'
import { upsertChunks } from '@/lib/pinecone'
import { evaluateResume, countCriteriaStrengths, type EB1AEvaluation } from '@/lib/eb1a-agent'

export interface ProcessResumeResult {
  success: boolean
  caseId?: string
  evaluation?: EB1AEvaluation
  strongCount?: number
  weakCount?: number
  error?: string
}

export async function processResume(formData: FormData): Promise<ProcessResumeResult> {
  const file = formData.get('file') as File | null

  if (!file) {
    return { success: false, error: 'No file provided' }
  }

  try {
    // 1. Create Case record
    const caseRecord = await db.case.create({
      data: { status: 'SCREENING' },
    })

    // 2. Extract text from file
    let text: string
    try {
      text = await parseFile(file)
    } catch (err) {
      if (err instanceof FileParseError && err.message.includes('PDF')) {
        // PDF extraction via LLM not implemented yet - placeholder
        return { success: false, error: 'PDF extraction not yet supported' }
      }
      throw err
    }

    // 3. Chunk text
    const chunks = chunkText(text)

    // 4. Embed and upsert to Pinecone
    const { vectorIds } = await upsertChunks(chunks, caseRecord.id)

    // 5. Create ResumeUpload record
    await db.resumeUpload.create({
      data: {
        caseId: caseRecord.id,
        fileName: file.name,
        fileSize: file.size,
        pineconeVectorIds: vectorIds,
      },
    })

    // 6. Run AI evaluation
    const evaluation = await evaluateResume(text)
    const counts = countCriteriaStrengths(evaluation)

    // 7. Create EB1AAnalysis record
    await db.eB1AAnalysis.create({
      data: {
        caseId: caseRecord.id,
        criteria: evaluation.criteria,
        strongCount: counts.strong,
        weakCount: counts.weak,
      },
    })

    return {
      success: true,
      caseId: caseRecord.id,
      evaluation,
      strongCount: counts.strong,
      weakCount: counts.weak,
    }
  } catch (err) {
    console.error('processResume error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
    }
  }
}
