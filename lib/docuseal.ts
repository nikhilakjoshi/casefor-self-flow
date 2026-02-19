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

interface TemplateResponse {
  id: number
  name: string
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

// Step 1: Create a template from a base64-encoded PDF
async function createTemplateFromPdf(
  name: string,
  fileBase64: string,
  roles: string[]
): Promise<TemplateResponse> {
  const res = await docusealFetch('/templates/pdf', {
    method: 'POST',
    body: JSON.stringify({
      name,
      documents: [
        {
          name: `${name}.pdf`,
          file: fileBase64,
          fields: roles.map((role) => ({
            name: 'Signature',
            type: 'signature',
            role,
            required: true,
            areas: [{ x: 0.05, y: 0.9, w: 0.3, h: 0.05, page: -1 }],
          })),
        },
      ],
    }),
  })
  return res.json()
}

// Step 2: Create a submission from a template
// Returns array of submitter objects (not a submission wrapper)
async function createSubmission(
  templateId: number,
  submitters: Submitter[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const res = await docusealFetch('/submissions', {
    method: 'POST',
    body: JSON.stringify({
      template_id: templateId,
      send_email: true,
      submitters: submitters.map((s) => ({
        email: s.email,
        name: s.name,
        role: s.role || 'First Party',
        values: s.values,
      })),
    }),
  })
  return res.json()
}

// Combined: create template from PDF then create submission
// Note: /submissions returns an array of submitter objects, not a wrapper
export async function createSubmissionFromPdf(
  name: string,
  fileBase64: string,
  submitters: Submitter[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const roles = submitters.map((s) => s.role || 'First Party')
  const template = await createTemplateFromPdf(name, fileBase64, roles)
  return createSubmission(template.id, submitters)
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
