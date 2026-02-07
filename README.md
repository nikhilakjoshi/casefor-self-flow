# CaseFor AI

AI-powered EB-1A visa case builder. Upload your resume, get instant eligibility analysis, and build your evidence portfolio with AI assistance.

## Features

- **Resume Analysis**: Upload PDF/DOCX/TXT, get AI evaluation against all 10 EB-1A criteria
- **Case Management**: Track multiple cases with rename/delete support
- **AI Chat**: Conversational interface for case building and evidence gathering
- **Document Management**: Upload, organize, and verify supporting documents
- **Evidence Phase**: AI-guided evidence collection once eligibility threshold is met

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth v5
- **AI**: Anthropic Claude, Google Gemini
- **Vector DB**: Pinecone
- **Storage**: AWS S3
- **UI**: Tailwind CSS, Radix UI, TipTap

## Setup

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL database
- Pinecone account
- AWS S3 bucket
- Anthropic API key
- Google AI API key

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."

# Auth
AUTH_SECRET="..."
AUTH_GOOGLE_ID="..."
AUTH_GOOGLE_SECRET="..."

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
```

### Install & Run

```bash
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database |
| `pnpm db:seed` | Seed database with initial data |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm lint` | Run ESLint |

## Project Structure

```
app/
  (auth)/          # Login/register pages
  api/             # API routes
  case/[caseId]/   # Case detail pages
  onboard/         # Resume upload flow
  dashboard/       # Case list
components/
  ui/              # Reusable UI components
lib/
  auth.ts          # NextAuth config
  db.ts            # Prisma client
  eb1a-agent.ts    # AI evaluation logic
  embeddings.ts    # Vector embeddings
  pinecone.ts      # Vector DB client
prisma/
  schema.prisma    # Database schema
```
