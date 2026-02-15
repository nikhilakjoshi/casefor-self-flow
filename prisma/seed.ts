import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { agentPromptSeeds } from './agent-prompt-seeds'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  // 1. Upsert EB-1A ApplicationType
  const eb1a = await prisma.applicationType.upsert({
    where: { code: 'EB1A' },
    update: { name: 'EB-1A Extraordinary Ability' },
    create: {
      code: 'EB1A',
      name: 'EB-1A Extraordinary Ability',
      defaultThreshold: 3,
      active: true,
    },
  })
  console.log(`Upserted ApplicationType: ${eb1a.code} (${eb1a.id})`)

  // 2. Upsert 10 CriteriaMapping rows matching lib/eb1a-criteria.ts
  const criteria = [
    { criterionKey: 'awards', name: 'Awards', description: 'Documentation of receipt of lesser nationally or internationally recognized prizes or awards for excellence in the field of endeavor.', displayOrder: 0 },
    { criterionKey: 'membership', name: 'Membership', description: 'Documentation of membership in associations in the field which require outstanding achievements of their members, as judged by recognized national or international experts.', displayOrder: 1 },
    { criterionKey: 'published_material', name: 'Published Material', description: 'Published material about the person in professional or major trade publications or other major media, relating to their work in the field.', displayOrder: 2 },
    { criterionKey: 'judging', name: 'Judging', description: 'Evidence of participation, either individually or on a panel, as a judge of the work of others in the same or an allied field.', displayOrder: 3 },
    { criterionKey: 'original_contributions', name: 'Original Contributions', description: 'Evidence of original scientific, scholarly, artistic, athletic, or business-related contributions of major significance in the field.', displayOrder: 4 },
    { criterionKey: 'scholarly_articles', name: 'Scholarly Articles', description: 'Evidence of authorship of scholarly articles in the field, in professional or major trade publications or other major media.', displayOrder: 5 },
    { criterionKey: 'exhibitions', name: 'Artistic Exhibitions', description: 'Evidence of display of the person\'s work in the field at artistic exhibitions or showcases.', displayOrder: 6 },
    { criterionKey: 'leading_role', name: 'Leading/Critical Role', description: 'Evidence of performing in a leading or critical role for organizations or establishments that have a distinguished reputation.', displayOrder: 7 },
    { criterionKey: 'high_salary', name: 'High Salary', description: 'Evidence of commanding a high salary or other significantly high remuneration for services, in relation to others in the field.', displayOrder: 8 },
    { criterionKey: 'commercial_success', name: 'Commercial Success', description: 'Evidence of commercial successes in the performing arts, as shown by box office receipts or record, cassette, compact disk, or video sales.', displayOrder: 9 },
  ]

  for (const c of criteria) {
    await prisma.criteriaMapping.upsert({
      where: {
        applicationTypeId_criterionKey: {
          applicationTypeId: eb1a.id,
          criterionKey: c.criterionKey,
        },
      },
      update: { name: c.name, description: c.description, displayOrder: c.displayOrder },
      create: {
        applicationTypeId: eb1a.id,
        criterionKey: c.criterionKey,
        name: c.name,
        description: c.description,
        displayOrder: c.displayOrder,
        active: true,
      },
    })
  }
  console.log(`Upserted ${criteria.length} CriteriaMapping rows`)

  // 3. Upsert 4 Templates (systemInstruction = drafting guidelines, variations = actual template body)
  const templates = [
    {
      name: 'Recommendation Letter',
      type: 'RECOMMENDATION_LETTER' as const,
      systemInstruction: 'Draft a recommendation letter for an EB-1A petition. The letter should be from a qualified expert in the field who can attest to the applicant\'s extraordinary ability. Include specific examples of achievements, contributions, and impact in the field.',
      defaultVariationContent: 'Write a formal recommendation letter. Open with the recommender\'s credentials and relationship to the applicant. Provide 2-3 specific examples of the applicant\'s extraordinary contributions. Close with a strong endorsement of their EB-1A eligibility.',
    },
    {
      name: 'Personal Statement',
      type: 'PERSONAL_STATEMENT' as const,
      systemInstruction: 'Draft a personal statement for an EB-1A petition. The statement should describe the applicant\'s career trajectory, key achievements, and how they demonstrate extraordinary ability in their field. Focus on concrete evidence that maps to USCIS criteria.',
      defaultVariationContent: 'Write a compelling first-person narrative. Begin with early career motivation, progress through key milestones, highlight specific achievements that meet EB-1A criteria, and conclude with future plans and continued impact in the field.',
    },
    {
      name: 'Petition Letter',
      type: 'PETITION' as const,
      systemInstruction: 'Draft a petition letter (cover letter) for an EB-1A application. The letter should summarize the applicant\'s qualifications, identify which criteria are met, and present a compelling legal argument for extraordinary ability classification.',
      defaultVariationContent: 'Write a formal legal petition letter addressed to USCIS. Introduce the applicant, state the classification sought, enumerate each qualifying criterion with supporting evidence, and conclude with a request for approval.',
    },
    {
      name: 'USCIS Form Instructions',
      type: 'USCIS_FORM' as const,
      systemInstruction: 'Provide guidance for completing USCIS Form I-140 (Immigrant Petition for Alien Workers) for an EB-1A extraordinary ability classification. Include instructions for each relevant section and common pitfalls to avoid.',
      defaultVariationContent: 'Provide section-by-section guidance for Form I-140. Cover beneficiary information, classification requested, and supporting documentation requirements. Note common mistakes and best practices for each field.',
    },
    {
      name: 'Cover Letter',
      type: 'COVER_LETTER' as const,
      systemInstruction: 'Draft a cover letter for an EB-1A petition package. The letter should introduce the petitioner, summarize qualifying criteria with supporting evidence, reference attached exhibits, and present a compelling legal argument for extraordinary ability classification under INA 203(b)(1)(A).',
      defaultVariationContent: 'Write a formal cover letter addressed to USCIS. Structure: (1) Introduction of petitioner and classification sought, (2) Summary of extraordinary ability evidence across qualifying criteria, (3) Reference to attached exhibits and supporting documents, (4) Legal framework citing INA 203(b)(1)(A) and 8 CFR 204.5(h), (5) Conclusion requesting approval.',
    },
    {
      name: 'USCIS Advisory Letter',
      type: 'USCIS_ADVISORY' as const,
      systemInstruction: 'Draft an expert opinion / advisory letter for USCIS review in support of an EB-1A petition. The letter should be from a recognized expert who can provide authoritative assessment of the applicant\'s contributions and standing in the field. Focus on the significance and impact of the applicant\'s work from an independent expert perspective.',
      defaultVariationContent: 'Write a formal expert opinion letter. Structure: (1) Expert\'s credentials and basis for providing opinion, (2) Overview of the field and standards for extraordinary ability, (3) Assessment of applicant\'s specific contributions and their significance, (4) Comparison to peers and field benchmarks, (5) Conclusion that applicant meets extraordinary ability standard.',
    },
  ]

  for (const t of templates) {
    const templateId = `${eb1a.id}-${t.type}`
    await prisma.template.upsert({
      where: { id: templateId },
      update: { name: t.name, systemInstruction: t.systemInstruction },
      create: {
        id: templateId,
        applicationTypeId: eb1a.id,
        name: t.name,
        type: t.type,
        systemInstruction: t.systemInstruction,
        version: 1,
        active: true,
      },
    })

    // Upsert default variation
    const defaultVarId = `${templateId}-default`
    await prisma.templateVariation.upsert({
      where: { id: defaultVarId },
      update: { content: t.defaultVariationContent, label: 'Default' },
      create: {
        id: defaultVarId,
        templateId,
        label: 'Default',
        content: t.defaultVariationContent,
        matchField: '',
        matchValue: '',
        isDefault: true,
        active: true,
      },
    })
  }
  console.log(`Upserted ${templates.length} Template rows with default variations`)

  // 3b. Upsert relationship-type-specific TemplateVariation rows for Recommendation Letter
  const recLetterTemplateId = `${eb1a.id}-RECOMMENDATION_LETTER`
  const recLetterVariations = [
    {
      id: `${recLetterTemplateId}-ACADEMIC_ADVISOR`,
      label: 'Academic Advisor',
      matchField: 'relationshipType',
      matchValue: 'ACADEMIC_ADVISOR',
      isDefault: false,
      content: `Write a recommendation letter from an academic advisor perspective. Structure:
1. ADVISOR CREDENTIALS: State the advisor's academic position, institution, research focus, and years of experience in the field. Establish why the advisor is qualified to evaluate extraordinary ability.
2. MENTORSHIP RELATIONSHIP: Describe how the advisor supervised or mentored the applicant -- thesis/dissertation work, research projects, academic collaborations. Include duration and depth of relationship.
3. ACADEMIC EXCELLENCE: Highlight the applicant's scholarly achievements under the advisor's guidance -- publications, conference presentations, research breakthroughs. Use specific metrics (citation counts, impact factors, acceptance rates).
4. INTELLECTUAL CONTRIBUTIONS: Describe original contributions the applicant made to the field during their academic work. Explain significance relative to the state of the art.
5. COMPARISON TO PEERS: Compare the applicant to other students/researchers the advisor has mentored over their career. Quantify where the applicant ranks (e.g., "top 2% of the 50+ doctoral students I have supervised").
6. FIELD IMPACT: Describe how the applicant's work has influenced the broader field -- adopted methodologies, follow-on research by others, practical applications.
7. CONCLUSION: Strong endorsement of EB-1A eligibility based on sustained extraordinary achievement observed firsthand.

Tone: Authoritative, scholarly. Use field-specific technical language to demonstrate deep familiarity with the applicant's work.`,
    },
    {
      id: `${recLetterTemplateId}-RESEARCH_COLLABORATOR`,
      label: 'Research Collaborator',
      matchField: 'relationshipType',
      matchValue: 'RESEARCH_COLLABORATOR',
      isDefault: false,
      content: `Write a recommendation letter from a research collaborator perspective. Structure:
1. COLLABORATOR CREDENTIALS: State the collaborator's position, institution, research focus, and notable accomplishments (publications, grants, awards). Establish peer-level authority.
2. COLLABORATION CONTEXT: Describe the nature of the collaboration -- joint research projects, co-authored publications, shared grants. Include timeline and scope.
3. TECHNICAL CONTRIBUTIONS: Detail the applicant's specific technical contributions to joint work. Distinguish the applicant's unique contributions from the collaborator's own. Emphasize originality and significance.
4. RESEARCH METHODOLOGY: Describe innovative methods, techniques, or approaches the applicant introduced or advanced. Explain how these advanced the field.
5. PUBLICATION AND CITATION IMPACT: Reference co-authored and solo publications. Cite specific impact metrics -- citation counts, journal rankings, conference acceptance rates.
6. PEER RECOGNITION: Describe how others in the field have recognized the applicant's work -- invited talks, awards, adoption of their methods, requests for collaboration from other leading researchers.
7. CONCLUSION: Endorsement based on firsthand experience working alongside the applicant, affirming their contributions rise to the level of extraordinary ability.

Tone: Collegial but authoritative. Emphasize mutual respect and the unique value the applicant brought to collaborative work.`,
    },
    {
      id: `${recLetterTemplateId}-INDUSTRY_COLLEAGUE`,
      label: 'Industry Colleague',
      matchField: 'relationshipType',
      matchValue: 'INDUSTRY_COLLEAGUE',
      isDefault: false,
      content: `Write a recommendation letter from an industry colleague perspective. Structure:
1. COLLEAGUE CREDENTIALS: State the colleague's industry position, company, role, and years of experience. Establish industry authority and perspective.
2. PROFESSIONAL RELATIONSHIP: Describe how the colleague knows the applicant -- same company, industry conferences, professional associations, project collaborations. Include duration.
3. INDUSTRY IMPACT: Describe the applicant's contributions to products, services, or technologies with real-world commercial or societal impact. Use specific examples with measurable outcomes (revenue, users, performance improvements).
4. TECHNICAL LEADERSHIP: Highlight instances where the applicant led technical initiatives, solved critical industry problems, or introduced innovations adopted across the organization or industry.
5. MARKET INFLUENCE: Describe how the applicant's work has influenced industry standards, best practices, or market direction. Reference patents, trade publications, or industry adoption.
6. PEER STANDING: Compare the applicant to other professionals at similar career levels. Explain what sets them apart in terms of skill, innovation, and influence.
7. CONCLUSION: Strong endorsement based on industry-specific evaluation of extraordinary ability.

Tone: Professional, business-oriented. Ground claims in measurable industry outcomes and market impact.`,
    },
    {
      id: `${recLetterTemplateId}-SUPERVISOR`,
      label: 'Supervisor',
      matchField: 'relationshipType',
      matchValue: 'SUPERVISOR',
      isDefault: false,
      content: `Write a recommendation letter from a direct supervisor perspective. Structure:
1. SUPERVISOR CREDENTIALS: State the supervisor's title, organization, management scope, and years of experience overseeing professionals in the field.
2. SUPERVISORY RELATIONSHIP: Describe duration and context of supervision -- direct reports, project leadership, performance evaluations. Specify the applicant's role and responsibilities.
3. EXCEPTIONAL PERFORMANCE: Describe specific instances of outstanding performance that exceeded expectations. Reference performance reviews, promotion velocity, or special recognition.
4. LEADERSHIP AND INITIATIVE: Highlight the applicant's leadership within the organization -- team building, mentoring others, driving strategic initiatives beyond their formal role.
5. KEY ACHIEVEMENTS: Detail 2-3 major accomplishments under the supervisor's watch with quantifiable impact (revenue generated, efficiency improvements, problems solved, products launched).
6. COMPARATIVE ASSESSMENT: Compare the applicant to other professionals the supervisor has managed throughout their career. Provide specific ranking or percentile assessment.
7. ORGANIZATIONAL IMPACT: Describe how the applicant's contributions changed the organization -- new capabilities, cultural shifts, competitive advantages established.
8. CONCLUSION: Endorsement based on direct observation of consistently extraordinary performance.

Tone: Managerial, evaluative. Emphasize observed performance and organizational impact with concrete metrics.`,
    },
    {
      id: `${recLetterTemplateId}-MENTEE`,
      label: 'Mentee',
      matchField: 'relationshipType',
      matchValue: 'MENTEE',
      isDefault: false,
      content: `Write a recommendation letter from a mentee perspective. Structure:
1. MENTEE CREDENTIALS: State the mentee's current position and accomplishments, establishing that they are themselves a credible voice in the field who benefited from the applicant's mentorship.
2. MENTORSHIP RELATIONSHIP: Describe how the applicant mentored the writer -- formal programs, informal guidance, career development. Include duration and depth.
3. KNOWLEDGE TRANSFER: Describe specific knowledge, skills, or methodologies the applicant imparted. Explain how these were novel or uniquely valuable compared to what was available from other sources.
4. CAREER IMPACT: Detail how the applicant's mentorship concretely shaped the mentee's career trajectory -- positions obtained, publications enabled, skills developed, research directions inspired.
5. TEACHING AND COMMUNICATION: Highlight the applicant's ability to explain complex concepts, develop talent, and raise the capabilities of those around them. Provide specific examples.
6. BROADER MENTORSHIP IMPACT: Reference other mentees or team members who similarly benefited, demonstrating a pattern of extraordinary influence on the next generation of professionals.
7. CONCLUSION: Endorsement emphasizing the applicant's extraordinary ability as evidenced by their outsized impact on developing talent in the field.

Tone: Respectful, appreciative but substantive. Focus on concrete outcomes of mentorship rather than general praise.`,
    },
    {
      id: `${recLetterTemplateId}-CLIENT`,
      label: 'Client',
      matchField: 'relationshipType',
      matchValue: 'CLIENT',
      isDefault: false,
      content: `Write a recommendation letter from a client perspective. Structure:
1. CLIENT CREDENTIALS: State the client's organization, role, and industry context. Establish why their perspective on the applicant's work is authoritative.
2. ENGAGEMENT CONTEXT: Describe the nature of the professional engagement -- consulting, service delivery, product development. Include scope, timeline, and why the applicant was selected.
3. PROBLEM AND SOLUTION: Detail the specific challenge the client faced and how the applicant's expertise addressed it. Emphasize complexity and stakes involved.
4. DELIVERED VALUE: Quantify the impact of the applicant's work -- ROI, efficiency gains, problems solved, revenue generated, risks mitigated. Use specific metrics.
5. EXPERTISE DIFFERENTIATION: Explain what set the applicant apart from other professionals the client has worked with. Describe unique skills, approaches, or insights.
6. ONGOING RELATIONSHIP: Describe whether the client has engaged the applicant repeatedly, referred them to others, or sought their counsel on subsequent challenges -- indicators of exceptional value.
7. CONCLUSION: Endorsement based on real-world results delivered, affirming the applicant operates at an extraordinary level in their field.

Tone: Results-oriented, practical. Ground claims in business outcomes and delivered value rather than abstract qualities.`,
    },
    {
      id: `${recLetterTemplateId}-PEER_EXPERT`,
      label: 'Peer Expert (Default)',
      matchField: 'relationshipType',
      matchValue: 'PEER_EXPERT',
      isDefault: true,
      content: `Write a recommendation letter from a peer expert perspective. Structure:
1. EXPERT CREDENTIALS: State the expert's position, institution/organization, field of expertise, and notable accomplishments. Establish independent authority to evaluate extraordinary ability.
2. PROFESSIONAL KNOWLEDGE: Describe how the expert knows of the applicant's work -- conferences, publications, professional networks, field reputation. Clarify whether knowledge is from direct interaction, review of work, or both.
3. FIELD CONTEXT: Provide overview of the field, current challenges, and what constitutes extraordinary achievement. Set the bar for what "extraordinary ability" means in this specific domain.
4. CONTRIBUTION ASSESSMENT: Evaluate the applicant's key contributions against that bar. Analyze 2-3 specific contributions in depth -- what was done, why it matters, how it advanced the field.
5. COMPARATIVE STANDING: Compare the applicant to other leading figures in the field. Use objective benchmarks -- publication records, citation impact, awards, adoption of methods, industry influence.
6. FIELD RECOGNITION: Describe evidence of peer recognition -- invited lectures, editorial board positions, prestigious awards, adoption of the applicant's work by others.
7. CONCLUSION: Independent expert endorsement of EB-1A eligibility based on objective assessment of the applicant's standing and contributions relative to the field.

Tone: Independent, analytical. The expert evaluates from a position of authority without personal bias. Focus on objective evidence and field-level impact.`,
    },
  ]

  for (const v of recLetterVariations) {
    await prisma.templateVariation.upsert({
      where: { id: v.id },
      update: { content: v.content, label: v.label, matchField: v.matchField, matchValue: v.matchValue, isDefault: v.isDefault },
      create: {
        id: v.id,
        templateId: recLetterTemplateId,
        label: v.label,
        content: v.content,
        matchField: v.matchField,
        matchValue: v.matchValue,
        isDefault: v.isDefault,
        active: true,
      },
    })
  }
  console.log(`Upserted ${recLetterVariations.length} recommendation letter TemplateVariation rows`)

  // 4. Backfill existing cases with applicationTypeId
  const updated = await prisma.case.updateMany({
    where: { applicationTypeId: null },
    data: { applicationTypeId: eb1a.id },
  })
  console.log(`Backfilled ${updated.count} cases with applicationTypeId`)

  // 5. Upsert AgentPrompt records
  for (const seed of agentPromptSeeds) {
    await prisma.agentPrompt.upsert({
      where: { slug: seed.slug },
      update: {
        name: seed.name,
        description: seed.description,
        variables: seed.variables,
        provider: seed.provider,
        modelName: seed.modelName,
        content: seed.content,
        defaultContent: seed.content,
        category: seed.category,
      },
      create: {
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        category: seed.category,
        content: seed.content,
        defaultContent: seed.content,
        variables: seed.variables,
        provider: seed.provider,
        modelName: seed.modelName,
      },
    })
  }
  console.log(`Upserted ${agentPromptSeeds.length} AgentPrompt rows`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
