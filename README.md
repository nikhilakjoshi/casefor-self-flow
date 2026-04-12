# CaseFor AI

AI-powered immigration case management platform. Supports multiple visa/petition types (EB-1A, O-1B, and configurable via admin) with AI-driven analysis, document drafting, strength evaluation, and petition package assembly.

## Features

### Case Management
- **Multi-matter-type support**: EB-1A, O-1B, and any new visa type configurable through admin UI by a domain expert
- **Resume analysis**: upload PDF/DOCX/TXT, get AI evaluation against the criteria for the case's application type
- **Criteria-based pipeline**: extraction, strength evaluation, gap analysis, case strategy, denial probability -- all dynamically scoped per application type
- **Case tracker**: evidence coverage matrix, document status table, gap cross-reference in one view

### AI Agents
- **Drafting agent**: recommendation letters, personal statements, petition letters, cover letters, USCIS advisory letters
- **Evidence agent**: AI-guided evidence collection, per-criterion verification
- **Slash commands**: in-editor AI assistance (`/evidence`, `/argue`, `/recommender`, `/outline`, `/address-weakness`, `/profile`, `/exhibit`) -- category-aware per document type
- **Inline edit**: right-click selection for improve/shorten/formalize with streaming replacement

### Document Workflow
- **TipTap editor**: markdown-based rich editor with track changes, AI insertion marks, paragraph-boundary streaming
- **Document classification**: auto-categorize uploaded documents
- **Criteria routing**: map documents to criteria they support
- **E-signature**: DocuSeal integration for signing recommendation letters
- **Package assembly**: compile petition package with exhibit numbering

### Admin Configuration
- **Matter types**: create, clone, edit application types with criteria, prompts, rubrics, and denial frameworks
- **Prompt management**: TipTap-based prompt editor with version history, variable insertion, per-type scoping (3-panel Vercel-style layout)
- **Template management**: document templates with variations matched by profile data (e.g. relationship type for rec letters)
- **Strength rubric editor**: per-type evaluation rubric in rich text
- **Denial framework editor**: per-type legal standard for risk assessment

### Design System
- **Casefor Ink**: warm-neutral editorial letterpress aesthetic -- Cormorant Garamond display, DM Sans body, JetBrains Mono data, parchment/ink/gold palette, paper grain overlay
- **Spec location**: `~/.claude/design-systems/casefor-ink.md`

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database**: PostgreSQL (Supabase) + Prisma 7
- **Auth**: NextAuth v5
- **AI**: Anthropic Claude Sonnet (agents), Google Gemini Flash (PDF extraction), Vercel AI SDK 6
- **Vector DB**: Pinecone
- **Storage**: AWS S3
- **UI**: Tailwind CSS 4, Radix UI, TipTap 3, tw-animate-css, motion (framer-motion)
- **Editor**: TipTap with tiptap-markdown, @tiptap/suggestion (slash commands), track changes, AI inline edit
- **Package manager**: pnpm

## Setup

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL database (Supabase recommended)
- Pinecone account
- AWS S3 bucket
- Anthropic API key
- Google AI API key

### Environment Variables

```bash
# Database (pooler for runtime, direct for schema push)
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://...db.supabase.co:5432/postgres"

# Auth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# AI
ANTHROPIC_API_KEY="..."
GOOGLE_GENERATIVE_AI_API_KEY="..."

# Vector DB
PINECONE_API_KEY="..."
PINECONE_INDEX="..."

# Storage
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="..."
S3_BUCKET="..."

# Email
RESEND_API_KEY="..."
```

### Install & Run

```bash
pnpm install
pnpm db:generate
pnpm db:push          # needs DIRECT_URL
pnpm db:seed          # seeds EB-1A criteria, templates, prompts
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Seed O-1B (optional)

```bash
node --env-file=.env --import tsx prisma/seed-o1b.ts
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database (needs DIRECT_URL) |
| `pnpm db:seed` | Seed EB-1A application type, criteria, templates, prompts |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm lint` | Run ESLint |

## Architecture

### Multi-Matter-Type Pipeline

The pipeline resolves criteria, prompts, rubrics, and denial frameworks dynamically per `ApplicationType`. Adding a new visa type is an admin operation, not a code change.

```
ApplicationType (e.g. EB1A, O1B)
  -> CriteriaMapping (N criteria per type)
  -> CriterionPromptLink (per-criterion prompt slugs for extraction/verification)
  -> StrengthRubric (evaluation rubric prompt)
  -> DenialFramework (risk assessment framework)
  -> EvidenceTypeDefinition (evidence schemas the type uses)
  -> AgentPrompt (type-scoped agent prompts with fallback chain)
```

Lookup chain: type-specific -> global -> hardcoded EB-1A fallback.

Key functions:
- `lib/criteria.ts`: `getCriteriaForCase()`, `getCriteriaMetadata()`
- `lib/agent-prompt.ts`: `getPromptForType(slug, applicationTypeId)`

### TipTap Editor

Two rendering modes:
- **Document mode** (default): paper-page on gray background, 816px max-width, heavy padding -- for drafting legal documents
- **Minimal mode** (`minimal` prop): inline form field, parchment bg, compact padding -- for admin prompt/rubric editing

Features: slash commands (7 commands, category-aware), AI inline edit, track changes, paragraph-boundary streaming, markdown storage via tiptap-markdown.

Streaming implementation: `lib/stream-markdown.ts` -- flushes to editor only on `\n\n` paragraph boundaries to prevent mid-heading/list re-renders.

### Design System (Casefor Ink)

Canonical spec: `~/.claude/design-systems/casefor-ink.md`

Key tokens: `--ink` (near-black), `--parchment` (page bg), `--warm-white` (card bg), `--cream` (borders), `--accent-gold` (the accent), `--green-ok`/`--amber-warn`/`--blue-info`/`--red-urgent`/`--purple-ip` (semantic states).

Typography: Cormorant Garamond (display/headings), DM Sans (body/UI), JetBrains Mono (data/IDs/dates).

## Project Structure

```
app/
  (auth)/                     # Login/register pages
  admin/
    application-types/        # Matter type management (overview + detail)
    criteria/                 # Criteria CRUD
    templates/                # Template + variation management
    prompts/                  # Prompt editor (3-panel Vercel-style layout)
  api/
    admin/                    # Admin API routes
    case/[caseId]/
      analyze/                # Resume extraction + analysis
      criterion/              # Per-criterion evaluation
      slash/                  # Slash command list + execute
      tracker/                # Evidence coverage + doc status + gap cross-ref
      strength-evaluation/    # Strength scoring
      gap-analysis/           # Gap analysis
      denial-probability/     # Risk assessment
      draft-chat/             # Document drafting agent
      evidence-chat/          # Evidence collection chat
      document-chat/          # Document review chat
    dashboard/                # Dashboard aggregation
  case/[caseId]/              # Case detail pages
    _components/
      report-panel.tsx        # Main report with tabs (Criteria, Gap, Evidence, Letters, Tracker, Vault, etc.)
      drafting-panel.tsx      # Document editor overlay
      tracker-panel.tsx       # Evidence coverage matrix + doc status + gaps
      letters-panel.tsx       # Document drafting cards
  dashboard/                  # Dashboard page
  onboard/                    # Resume upload flow

components/
  ui/
    tiptap-editor.tsx         # Rich editor (document + minimal modes)
    slash-command-extension.ts # TipTap suggestion extension
    slash-command-menu.tsx    # Slash command popup menu
    animated-content.tsx      # Route-change fade-in animation
    button.tsx                # Casefor ink button (4px radius, ink primary)
    badge.tsx                 # Semantic badge variants (strong/weak/info/warning/etc.)
    chat-input.tsx            # Chat input with attach + send
    scroll-area.tsx           # Radix scroll area

lib/
  criteria.ts                 # Dynamic criteria resolution (getCriteriaForCase, getCriteriaMetadata)
  agent-prompt.ts             # Prompt resolution with type-scoped fallback chain
  eb1a-agent.ts               # Extraction + evaluation (accepts applicationTypeId)
  multipass-extraction.ts     # Parallel per-criterion extraction
  criterion-extraction-schemas.ts  # Evidence type schema registry
  strength-evaluation.ts      # Strength scoring (reads StrengthRubric from DB)
  evidence-verification.ts    # Per-criterion document verification
  denial-probability.ts       # Risk assessment (reads DenialFramework from DB)
  gap-analysis.ts             # Gap analysis
  case-strategy.ts            # Case strategy
  drafting-agent.ts           # Document drafting (ToolLoopAgent)
  stream-markdown.ts          # Paragraph-boundary flush for TipTap streaming
  slash-commands.ts           # Slash command types + category mapping
  merge-extraction.ts         # Survey + extraction merge
  tier-evidence-guide.ts      # Tier definitions per criterion

prisma/
  schema.prisma               # Database schema (CaseAnalysis, ApplicationType, CriteriaMapping, etc.)
  seed.ts                     # EB-1A seed data
  seed-o1b.ts                 # O-1B seed data
  backfill-case-analysis.ts   # Migration: backfill applicationTypeId on CaseAnalysis rows

plans/
  designs/
    multi-matter-type-design.md   # Office-hours design doc (problem, premises, approaches, gaps)
    multi-matter-type-plan.md     # 8-phase implementation plan (file-by-file refactor details)
  prd.json                        # Product requirements
  prd.md                          # PRD narrative
```
