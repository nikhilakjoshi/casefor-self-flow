import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { markdownToPdf } from '@/lib/pdf-utils'
import { isS3Configured, uploadToS3, buildDocumentKey } from '@/lib/s3'

// --- Markdown sample docs (SYSTEM_GENERATED, editable in TiptapEditor) ---

interface MarkdownSample {
  name: string
  category: string
  content: string
  routing?: { criterion: string; score: number }
}

const MARKDOWN_DOCS: MarkdownSample[] = [
  {
    name: 'Sample Cover Letter',
    category: 'COVER_LETTER',
    content: `# Cover Letter

Date: [Date]

U.S. Citizenship and Immigration Services
Texas Service Center
6046 N. Belt Line Road, Suite 172
Irving, TX 75038-0001

**RE: Form I-140, Immigrant Petition for Alien Workers -- Extraordinary Ability Classification (EB-1A)**

Dear Officer:

We respectfully submit this petition on behalf of Dr. Jane A. Smith ("the Beneficiary") for classification as an alien of extraordinary ability in the sciences, pursuant to Section 203(b)(1)(A) of the Immigration and Nationality Act, 8 U.S.C. Section 1153(b)(1)(A).

As detailed in the enclosed Petition Letter and supporting exhibits, Dr. Smith has risen to the very top of her field of computational neuroscience. She meets at least three of the ten regulatory criteria set forth at 8 CFR 204.5(h)(3), and the totality of the evidence demonstrates sustained national and international acclaim.

The petition is organized as follows:

- **Exhibit A** -- Cover Letter and Petition Letter
- **Exhibit B** -- USCIS Forms
- **Exhibit C** -- Identity and Immigration Documents
- **Exhibit D** -- Curriculum Vitae
- **Exhibit E** -- Personal Statement
- **Exhibit F** -- Expert Testimony / Recommendation Letters
- **Exhibits G+** -- Evidence by Criterion

We respectfully request that this petition be approved. Thank you for your time and consideration.

Respectfully submitted,

[Attorney Name, Esq.]
[Bar Number]
[Firm Name]`,
  },
  {
    name: 'Sample Petition Letter',
    category: 'PETITION_LETTER',
    content: `# Petition Letter

## I. Introduction

This letter is submitted in support of the Form I-140 petition filed on behalf of Dr. Jane A. Smith ("Dr. Smith" or "the Beneficiary") seeking classification as an alien of extraordinary ability under Section 203(b)(1)(A) of the Immigration and Nationality Act ("INA"), 8 U.S.C. Section 1153(b)(1)(A), and 8 C.F.R. Section 204.5(h).

Dr. Smith is a leading researcher in computational neuroscience at Stanford University, where she directs the Neural Dynamics Laboratory. Her pioneering work in brain-computer interface algorithms has been cited over 2,400 times and has led to three issued U.S. patents.

## II. Extraordinary Ability Standard

Under 8 C.F.R. Section 204.5(h)(2), a petitioner must demonstrate "sustained national or international acclaim" and that their achievements have been recognized in the field of expertise. The petitioner must provide evidence of a one-time achievement (a major, internationally recognized award) or meet at least three of the ten criteria listed in 8 C.F.R. Section 204.5(h)(3).

## III. The Beneficiary Meets the Following Criteria

### A. Criterion 1 -- Awards (8 C.F.R. Section 204.5(h)(3)(i))

Dr. Smith has received nationally and internationally recognized awards for excellence, including:

- **IEEE Neural Engineering Best Paper Award (2022)** -- Awarded to the top paper at the International Conference on Neural Engineering, selected from over 800 submissions by a panel of distinguished researchers.
- **NSF CAREER Award (2021)** -- The National Science Foundation's most prestigious award for early-career faculty, recognizing researchers who exemplify the role of teacher-scholar.
- **Helmholtz Prize for Neuroscience (2020)** -- Awarded by the German Helmholtz Association to recognize transformative contributions in neuroscience research.

### B. Criterion 6 -- Scholarly Articles (8 C.F.R. Section 204.5(h)(3)(vi))

Dr. Smith has authored 47 peer-reviewed publications in leading journals including *Nature Neuroscience*, *Science*, *PNAS*, and *Neural Computation*. Her h-index of 32 places her in the top 2% of researchers in her field.

### C. Criterion 5 -- Original Contributions of Major Significance (8 C.F.R. Section 204.5(h)(3)(v))

Dr. Smith's development of the Adaptive Neural Decoding (AND) algorithm represents a paradigmatic shift in brain-computer interface technology. The AND algorithm has been:

- Adopted by 14 research laboratories worldwide
- Licensed by two Fortune 500 medical device companies
- Featured in coverage by the *New York Times*, *MIT Technology Review*, and *Scientific American*

## IV. Conclusion

The evidence presented herein demonstrates that Dr. Smith has achieved sustained national and international acclaim and is one of the small percentage who have risen to the very top of the field of computational neuroscience. We respectfully request that this petition be approved.`,
  },
  {
    name: 'Sample Personal Statement',
    category: 'PERSONAL_STATEMENT',
    content: `# Personal Statement

## My Journey in Computational Neuroscience

My passion for understanding the brain began during my undergraduate studies in biomedical engineering at MIT, where I first encountered the challenge of decoding neural signals. What started as a fascination with the mathematical patterns in brain activity has grown into a career dedicated to developing technologies that restore communication for individuals with severe motor disabilities.

## Research Vision and Contributions

After completing my Ph.D. at Caltech in 2016, I joined Stanford University, where I established the Neural Dynamics Laboratory. My research sits at the intersection of neuroscience, machine learning, and clinical engineering. The central question driving my work is: how can we build more robust, adaptive, and clinically practical brain-computer interfaces?

My most significant contribution has been the development of the Adaptive Neural Decoding (AND) algorithm. Prior to AND, brain-computer interfaces required frequent recalibration and degraded in performance over hours. The AND algorithm continuously adapts to shifting neural patterns, enabling stable performance over weeks without recalibration. This work, published in *Nature Neuroscience* (2021), has fundamentally changed how the field approaches decoder design.

## Impact Beyond Academia

The practical impact of my work extends beyond publications. In collaboration with clinicians at Stanford Medical Center, we conducted the first long-term clinical trial of AND-based brain-computer interfaces in patients with ALS. Three participants who had lost the ability to speak were able to communicate at rates exceeding 60 characters per minute -- a five-fold improvement over prior technology.

## Plans for Continued Work in the United States

The United States is uniquely positioned as the global leader in neurotechnology research. My continued presence here is essential to the advancement of my research program, which depends on:

- Access to Stanford's world-class computational infrastructure
- Collaboration with leading clinicians and neurosurgeons
- Proximity to the medical device industry in the Bay Area
- Continued NIH and NSF funding for my laboratory

I am deeply committed to advancing this field and believe my work will continue to benefit the United States through scientific innovation and improved quality of life for individuals with neurological disorders.`,
  },
  {
    name: 'Sample Recommendation -- Dr. Robert Chen',
    category: 'RECOMMENDATION_LETTER',
    content: `# Letter of Recommendation for Dr. Jane A. Smith

**From:** Dr. Robert Chen, M.D., Ph.D.
Professor and Chair, Department of Neurology
Johns Hopkins University School of Medicine
Baltimore, MD 21205

**Date:** [Date]

To Whom It May Concern:

I write this letter in enthusiastic support of Dr. Jane A. Smith's petition for classification as an alien of extraordinary ability (EB-1A). I have known Dr. Smith for over eight years in my capacity as a leading researcher in clinical neurology and brain-computer interfaces.

## My Qualifications to Evaluate Dr. Smith

I am a Professor and Chair of Neurology at Johns Hopkins University, where I have conducted research in neurorehabilitation and neural prosthetics for over twenty years. I have published more than 180 peer-reviewed articles, hold 12 patents, and have been elected to the National Academy of Medicine. I am independently familiar with Dr. Smith's work through the published literature and through our interactions at professional conferences.

## Dr. Smith's Extraordinary Contributions

Dr. Smith's Adaptive Neural Decoding algorithm represents, in my expert opinion, the single most important advance in brain-computer interface technology in the past decade. Before AND, the field struggled with decoder instability -- a problem that had stymied clinical translation for years.

What makes Dr. Smith's work extraordinary is not merely the technical innovation but its clinical impact. Her clinical trial results demonstrated that patients with complete motor paralysis could achieve communication rates previously thought impossible. I have adopted her methods in my own laboratory, and her publications are required reading for all trainees in my department.

## Conclusion

Dr. Smith is, without question, among the very top researchers in computational neuroscience and neural engineering worldwide. Her continued work in the United States will benefit both the scientific community and the patients who stand to gain from her innovations.

Sincerely,

Robert Chen, M.D., Ph.D.
Professor and Chair, Department of Neurology
Johns Hopkins University`,
  },
  {
    name: 'Sample Recommendation -- Prof. Maria Gonzalez',
    category: 'RECOMMENDATION_LETTER',
    content: `# Letter of Recommendation for Dr. Jane A. Smith

**From:** Prof. Maria Gonzalez, Ph.D.
Director, Neural Engineering Centre
ETH Zurich
Zurich, Switzerland

**Date:** [Date]

To Whom It May Concern:

I am writing to provide my strongest recommendation in support of Dr. Jane A. Smith's petition for EB-1A extraordinary ability classification. As the Director of the Neural Engineering Centre at ETH Zurich, one of the top-ranked technical universities in the world, I am well positioned to evaluate Dr. Smith's standing in our field.

## Independent Knowledge of Dr. Smith's Work

Although I have never collaborated directly with Dr. Smith, I have followed her research closely since her landmark 2019 paper in *Science* on real-time neural population dynamics. Her work has had a profound influence on the direction of research in my own laboratory and across the European neurotechnology community.

## Assessment of Dr. Smith's Contributions

From an international perspective, Dr. Smith's contributions stand out for several reasons:

1. **Technical originality**: The AND algorithm introduced a fundamentally new approach to neural decoding that departed from the prevailing paradigm. This is not an incremental improvement but a reconceptualization of the problem.

2. **Reproducibility and impact**: Unlike many high-profile results in our field, Dr. Smith's methods have been successfully replicated by independent groups across three continents. My own group at ETH Zurich has confirmed her core findings.

3. **Clinical translation**: Dr. Smith has bridged the gap between laboratory research and clinical application more effectively than any other researcher I am aware of in this generation.

## Standing in the Field

In my assessment, Dr. Smith ranks among the top five researchers worldwide in the area of brain-computer interfaces. Her h-index of 32 at her career stage is exceptional, and her work has attracted over 2,400 citations.

I offer this evaluation based purely on the merits of Dr. Smith's published work and its impact on our field.

Sincerely,

Maria Gonzalez, Ph.D.
Director, Neural Engineering Centre
ETH Zurich`,
  },
  {
    name: 'Sample Award Documentation',
    category: 'AWARD_CERTIFICATE',
    routing: { criterion: 'awards', score: 8.5 },
    content: `# Award Documentation -- Dr. Jane A. Smith

## Award 1: IEEE Neural Engineering Best Paper Award (2022)

### Description
The IEEE International Conference on Neural Engineering (NER) is the premier conference in neural engineering, held biennially and sponsored by the IEEE Engineering in Medicine and Biology Society. The Best Paper Award is selected by the program committee from all accepted submissions.

### Significance
- **Conference acceptance rate**: 28% (2022)
- **Best Paper selection**: 1 of 312 accepted papers (top 0.3%)
- **Selection committee**: 12 internationally recognized experts in neural engineering
- **Previous recipients include**: Dr. Krishna Shenoy (Stanford), Dr. Jose Carmena (UC Berkeley)

### Evidence Enclosed
- Award certificate
- Conference program showing award announcement
- Letter from IEEE NER Program Chair confirming selection criteria

---

## Award 2: NSF CAREER Award (2021)

### Description
The NSF Faculty Early Career Development (CAREER) Program is the National Science Foundation's most prestigious award for junior faculty. It recognizes researchers who exemplify the integration of research and education.

### Significance
- **Funding level**: $750,000 over 5 years
- **Selection rate**: Approximately 15-20% of applicants
- **Field-specific context**: Among the most competitive awards in biomedical engineering

### Evidence Enclosed
- NSF award letter
- Award abstract from NSF website

---

## Award 3: Helmholtz Prize for Neuroscience (2020)

### Description
The Hermann von Helmholtz Prize is awarded by the German Helmholtz Association to recognize transformative contributions in neuroscience. The prize carries an award of EUR 30,000 and is given to one researcher annually.

### Significance
- **International scope**: Open to researchers worldwide
- **Selection**: Nominated by previous laureates; selected by 8-member international jury
- **Notable previous recipients**: Dr. Karl Deisseroth (2015), Dr. Nikos Logothetis (2012)

### Evidence Enclosed
- Prize diploma
- Helmholtz Association press release
- Jury citation letter`,
  },
  {
    name: 'Sample Media Coverage',
    category: 'MEDIA_COVERAGE',
    routing: { criterion: 'original_contributions', score: 7.5 },
    content: `# Media Coverage -- Dr. Jane A. Smith

## Overview

Dr. Smith's research has received significant coverage in major media outlets, reflecting the broad impact and public interest in her work on brain-computer interfaces.

---

## Article 1: New York Times

**Title**: "A New Algorithm Lets Paralyzed Patients Communicate at Record Speed"
**Date**: March 15, 2022
**Section**: Science
**Circulation**: 7.5 million (digital + print)

> "Dr. Jane Smith's team at Stanford has achieved what many in the field considered a distant goal: a brain-computer interface that works reliably enough for everyday use by patients with ALS."

**Significance**: The *New York Times* is a major media outlet with national and international reach. Coverage in its Science section indicates broad recognition of Dr. Smith's work beyond the academic community.

---

## Article 2: MIT Technology Review

**Title**: "10 Breakthrough Technologies 2022: Adaptive Brain-Computer Interfaces"
**Date**: February 2022
**Readership**: 2.1 million monthly

Dr. Smith's Adaptive Neural Decoding technology was named one of MIT Technology Review's 10 Breakthrough Technologies for 2022. This annual list, published since 2001, identifies technologies "most likely to change the world."

**Significance**: Inclusion on this list places Dr. Smith's work alongside historically significant innovations and is recognized globally as a marker of transformative technology.

---

## Article 3: Scientific American

**Title**: "The Future of Brain-Computer Interfaces"
**Date**: July 2021
**Feature type**: Cover story
**Circulation**: 3.5 million

> "Among the new generation of researchers pushing BCI technology toward clinical reality, Stanford's Jane Smith stands out for her ability to bridge the gap between mathematical theory and patient outcomes."

**Significance**: *Scientific American* is one of the oldest and most widely read popular science magazines in the world. A cover feature represents the highest level of coverage reserved for the most impactful scientific advances.

---

## Article 4: BBC World Service

**Title**: "Brain Implant Restores Communication for ALS Patient"
**Date**: November 2022
**Program**: Science Hour
**Audience**: 365 million weekly listeners

Radio interview and feature segment discussing the clinical trial results published in the *New England Journal of Medicine*.

**Significance**: The BBC World Service reaches one of the largest global audiences of any media outlet, demonstrating international recognition of Dr. Smith's work.`,
  },
]

// --- PDF sample docs (USER_UPLOADED, read-only preview) ---

interface PdfSample {
  name: string
  category: string
  filename: string
  pdfContent: string // text rendered into a simple PDF via pdf-lib
  routing?: { criterion: string; score: number }
}

const PDF_DOCS: PdfSample[] = [
  {
    name: 'Sample Passport Copy',
    category: 'PASSPORT_ID',
    filename: 'passport_copy.pdf',
    pdfContent: `SAMPLE DOCUMENT -- Passport Copy

United States of America -- Passport

Surname: SMITH
Given Names: JANE ANNE
Nationality: United States of America
Date of Birth: 15 MAR 1988
Place of Birth: CALIFORNIA, U.S.A.
Date of Issue: 22 JUN 2020
Date of Expiration: 21 JUN 2030
Passport No.: 5XX-XXX-XXX

---

This is a sample placeholder document.
In a real petition, this would be a scanned copy
of the beneficiary's passport biographical page.`,
  },
  {
    name: 'Sample Curriculum Vitae',
    category: 'RESUME_CV',
    filename: 'curriculum_vitae.pdf',
    pdfContent: `CURRICULUM VITAE

DR. JANE A. SMITH, Ph.D.
Department of Bioengineering, Stanford University
443 Via Ortega, Stanford, CA 94305
jsmith@stanford.edu

EDUCATION

Ph.D. in Computational Neuroscience, California Institute of Technology, 2016
  Dissertation: "Latent Dynamics in Neural Population Activity"
  Advisor: Prof. Richard Andersen

B.S. in Biomedical Engineering (summa cum laude), MIT, 2011

ACADEMIC APPOINTMENTS

2018-present  Assistant Professor, Department of Bioengineering, Stanford University
2016-2018     Postdoctoral Fellow, Howard Hughes Medical Institute

SELECTED PUBLICATIONS

1. Smith JA et al. "Adaptive Neural Decoding for Stable Brain-Computer
   Interfaces." Nature Neuroscience 24: 1089-1101 (2021).
2. Smith JA, Lee K. "Real-Time Population Dynamics Reveal Cortical Basis
   of Motor Learning." Science 366: 234-241 (2019).
3. Smith JA et al. "Clinical Translation of Brain-Computer Interfaces:
   A Longitudinal Study in ALS Patients." NEJM 387: 1456-1467 (2022).

AWARDS AND HONORS

2022  IEEE Neural Engineering Best Paper Award
2021  NSF CAREER Award ($750,000)
2020  Helmholtz Prize for Neuroscience

PATENTS

US Patent 11,XXX,XXX -- "Adaptive Neural Signal Decoder" (2022)
US Patent 10,XXX,XXX -- "Real-Time Neural Population Tracking" (2020)
US Patent 10,XXX,XXX -- "High-Density Electrode Array Interface" (2019)

---

This is a sample placeholder document.
In a real petition, this would be the beneficiary's
uploaded CV/resume in PDF format.`,
  },
  {
    name: 'Sample Degree Certificate',
    category: 'DEGREE_CERTIFICATE',
    filename: 'degree_certificate.pdf',
    pdfContent: `CALIFORNIA INSTITUTE OF TECHNOLOGY

The Board of Trustees of the California Institute of Technology
on the recommendation of the Faculty hereby confers upon

JANE ANNE SMITH

the degree of

DOCTOR OF PHILOSOPHY
in
COMPUTATIONAL NEUROSCIENCE

with all the rights, privileges and responsibilities thereunto appertaining.

Given at Pasadena, California
on the twelfth day of June
Two Thousand and Sixteen

[Signature]                    [Signature]
President                      Secretary

---

This is a sample placeholder document.
In a real petition, this would be a scanned copy
of the beneficiary's doctoral degree certificate.`,
  },
  {
    name: 'Sample Publication -- Nature Neuroscience',
    category: 'PUBLICATION',
    filename: 'publication_nature_neuro.pdf',
    routing: { criterion: 'scholarly_articles', score: 9.0 },
    pdfContent: `Nature Neuroscience | Vol 24 | August 2021 | 1089-1101

ARTICLE

Adaptive Neural Decoding for Stable
Brain-Computer Interfaces

Jane A. Smith (1*), Kevin Lee (1), Sarah Park (1,2),
Michael Torres (3), Robert Chen (4)

1. Department of Bioengineering, Stanford University, Stanford, CA
2. Department of Electrical Engineering, Stanford University, Stanford, CA
3. Neurosciences Institute, UC San Diego, La Jolla, CA
4. Department of Neurology, Johns Hopkins University, Baltimore, MD

* Corresponding author: jsmith@stanford.edu

ABSTRACT

Brain-computer interfaces (BCIs) hold promise for restoring
communication and motor control in individuals with paralysis, but
existing decoders degrade in performance over hours due to neural
signal instability. Here we present an Adaptive Neural Decoding (AND)
algorithm that continuously updates its internal model to track
shifting neural population dynamics. In a cohort of three participants
with amyotrophic lateral sclerosis (ALS), AND maintained stable
decoding performance for over 30 days without manual recalibration,
achieving a median character output rate of 62 characters per minute.
These results represent a five-fold improvement over current
state-of-the-art and a critical step toward clinically viable BCIs.

Keywords: brain-computer interface, neural decoding, ALS,
neuroprosthetics, machine learning

---

This is a sample placeholder document.
In a real petition, this would be a full PDF copy
of the published journal article.`,
  },
]

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { caseId } = await params

  const caseRecord = await db.case.findUnique({
    where: { id: caseId },
    select: { id: true, userId: true },
  })

  if (!caseRecord || caseRecord.userId !== session.user.id) {
    return new Response('Not found', { status: 404 })
  }

  // Idempotency: skip if sample docs already exist
  const existing = await db.document.findFirst({
    where: { caseId, name: { startsWith: 'Sample ' } },
    select: { id: true },
  })

  if (existing) {
    return Response.json({ message: 'Sample docs already loaded', skipped: true })
  }

  const s3Ready = isS3Configured()

  // Create all documents in a transaction
  const created = await db.$transaction(async (tx) => {
    const results: { id: string; routing?: { criterion: string; score: number }; pdf?: PdfSample }[] = []

    // Markdown docs
    for (const sample of MARKDOWN_DOCS) {
      const doc = await tx.document.create({
        data: {
          caseId,
          name: sample.name,
          type: 'MARKDOWN',
          source: 'SYSTEM_GENERATED',
          status: 'DRAFT',
          category: sample.category as any,
          content: sample.content,
        },
      })
      results.push({ id: doc.id, routing: sample.routing })
    }

    // PDF docs
    for (const sample of PDF_DOCS) {
      const doc = await tx.document.create({
        data: {
          caseId,
          name: sample.name,
          type: 'PDF',
          source: 'USER_UPLOADED',
          status: 'DRAFT',
          category: sample.category as any,
        },
      })
      results.push({ id: doc.id, routing: sample.routing, pdf: sample })
    }

    // Create criterion routings
    for (const r of results) {
      if (!r.routing) continue
      await tx.documentCriterionRouting.create({
        data: {
          documentId: r.id,
          criterion: r.routing.criterion,
          score: r.routing.score,
          recommendation: 'INCLUDE',
          autoRouted: true,
        },
      })
    }

    return results
  })

  // Generate PDFs and upload to S3 (outside transaction)
  if (s3Ready) {
    const pdfDocs = created.filter((d) => d.pdf)
    await Promise.all(
      pdfDocs.map(async (d) => {
        try {
          const pdfBytes = await markdownToPdf(d.pdf!.pdfContent, d.pdf!.name)
          const s3Key = buildDocumentKey(caseId, d.id, d.pdf!.filename)
          const { url } = await uploadToS3(s3Key, Buffer.from(pdfBytes), 'application/pdf')
          await db.document.update({
            where: { id: d.id },
            data: { s3Key, s3Url: url },
          })
        } catch (err) {
          console.error(`Failed to upload sample PDF ${d.pdf!.name}:`, err)
        }
      })
    )
  }

  return Response.json({ message: 'Sample docs loaded', count: created.length })
}
