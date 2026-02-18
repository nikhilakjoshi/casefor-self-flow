const DOCUSEAL_API_URL =
  process.env.DOCUSEAL_API_URL || 'https://api.docuseal.com'

export function isDocuSealConfigured(): boolean {
  return !!process.env.DOCUSEAL_API_KEY
}

function getApiKey(): string {
  const key = process.env.DOCUSEAL_API_KEY
  if (!key) throw new Error('DOCUSEAL_API_KEY env var not set')
  return key
}

async function docusealFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${DOCUSEAL_API_URL}${path}`, {
    ...options,
    headers: {
      'X-Auth-Token': getApiKey(),
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DocuSeal API error ${res.status}: ${text}`)
  }
  return res
}

interface Submitter {
  email: string
  name?: string
  role?: string
  values?: Record<string, string>
}

interface SubmissionSubmitter {
  id: number
  slug: string
  email: string
  name: string
  role: string
  status: string
  sent_at: string | null
  completed_at: string | null
}

interface SubmissionResponse {
  id: number
  submitters: SubmissionSubmitter[]
  status: string
  created_at: string
  audit_log_url?: string
}

export async function createSubmissionFromPdf(
  name: string,
  fileBase64: string,
  submitters: Submitter[],
  fields?: Array<{ name: string; type?: string; role?: string }>
): Promise<SubmissionResponse> {
  const body: Record<string, unknown> = {
    template: {
      name,
      document_urls: [`data:application/pdf;base64,${fileBase64}`],
    },
    submitters: submitters.map((s) => ({
      email: s.email,
      name: s.name,
      role: s.role || 'Signer',
      values: s.values,
    })),
    send_email: true,
  }

  if (fields && fields.length > 0) {
    body.fields = fields
  }

  const res = await docusealFetch('/submissions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function getSubmission(
  id: number
): Promise<SubmissionResponse> {
  const res = await docusealFetch(`/submissions/${id}`)
  return res.json()
}

interface SubmitterResponse {
  id: number
  slug: string
  email: string
  name: string
  role: string
  status: string
  completed_at: string | null
  documents: Array<{ name: string; url: string }>
}

export async function getSubmitter(
  id: number
): Promise<SubmitterResponse> {
  const res = await docusealFetch(`/submitters/${id}`)
  return res.json()
}

export async function archiveSubmission(id: number): Promise<void> {
  await docusealFetch(`/submissions/${id}`, { method: 'DELETE' })
}
