/**
 * EB-1A Extraordinary Ability visa criteria definitions
 * USCIS requires applicants to meet at least 3 of these 10 criteria
 */

export interface EB1ACriterion {
  id: string;
  name: string;
  description: string;
}

export const EB1A_CRITERIA: EB1ACriterion[] = [
  {
    id: "awards",
    name: "Awards",
    description:
      "Documentation of receipt of lesser nationally or internationally recognized prizes or awards for excellence in the field of endeavor.",
  },
  {
    id: "membership",
    name: "Membership",
    description:
      "Documentation of membership in associations in the field which require outstanding achievements of their members, as judged by recognized national or international experts.",
  },
  {
    id: "published_material",
    name: "Published Material",
    description:
      "Published material about the person in professional or major trade publications or other major media, relating to their work in the field.",
  },
  {
    id: "judging",
    name: "Judging",
    description:
      "Evidence of participation, either individually or on a panel, as a judge of the work of others in the same or an allied field.",
  },
  {
    id: "original_contributions",
    name: "Original Contributions",
    description:
      "Evidence of original scientific, scholarly, artistic, athletic, or business-related contributions of major significance in the field.",
  },
  {
    id: "scholarly_articles",
    name: "Scholarly Articles",
    description:
      "Evidence of authorship of scholarly articles in the field, in professional or major trade publications or other major media.",
  },
  {
    id: "exhibitions",
    name: "Artistic Exhibitions",
    description:
      "Evidence of display of the person's work in the field at artistic exhibitions or showcases.",
  },
  {
    id: "leading_role",
    name: "Leading/Critical Role",
    description:
      "Evidence of performing in a leading or critical role for organizations or establishments that have a distinguished reputation.",
  },
  {
    id: "high_salary",
    name: "High Salary",
    description:
      "Evidence of commanding a high salary or other significantly high remuneration for services, in relation to others in the field.",
  },
  {
    id: "commercial_success",
    name: "Commercial Success",
    description:
      "Evidence of commercial successes in the performing arts, as shown by box office receipts or record, cassette, compact disk, or video sales.",
  },
];

export type EB1ACriterionId = (typeof EB1A_CRITERIA)[number]["id"];
