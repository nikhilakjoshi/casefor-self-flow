# Project Instructions

## Environment

- This is a git worktree, not the main repo checkout
- To sync local branch: `git merge origin/main`

## GitHub

- Use GitHub CLI (`gh`) for all GitHub interactions

## Commit Messages

- Be extremely concise. Sacrifice grammar for concision.
- Do not add "Co-Authored-By" or any extra metadata.

## Plan Mode

- Always ask clarifying questions, even when instructions don't explicitly request them.
- Be extremely concise. Sacrifice grammar for concision.

## Multi-Matter-Type Architecture

- Pipeline is dynamic: criteria, prompts, rubrics, denial frameworks resolve per ApplicationType
- DB models: `CaseAnalysis` (renamed from EB1AAnalysis via `@@map`), `EvidenceTypeDefinition`, `StrengthRubric`, `CriterionPromptLink`, `DenialFramework`
- `AgentPrompt` scoped per type via `applicationTypeId` FK. Lookup: type-specific -> global -> hardcoded fallback
- `getCriteriaForCase(caseId)` / `getCriteriaMetadata(appTypeId)` in `lib/criteria.ts` are the single source of truth
- `getPromptForType(slug, appTypeId)` in `lib/agent-prompt.ts` for type-scoped prompt resolution
- `CriterionId` is now `string` (was `z.enum`). `CRITERIA_METADATA` is deprecated, use DB
- Admin: `/admin/application-types` manages types, criteria, rubrics, frameworks. Clone flow duplicates everything
- O-1B seeded with 8 criteria, prompt links reuse EB-1A prompts where criteria overlap

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
