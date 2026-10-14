import {
  EMPLOYMENT_STATUSES,
  HOUSING_SITUATIONS,
  type HouseholdProfile,
  type ProfileField,
} from "../profile";
import { REGIONS } from "../regions";

/**
 * Questionnaire definition. Texts are NOT here: the web app looks them up by
 * question id / option value in its i18n messages.
 */
export type QuestionInput =
  | { type: "choice"; options: { value: string; set: Partial<HouseholdProfile> }[] }
  | {
      type: "number";
      field: ProfileField;
      min: number;
      max: number;
      unit?: "years" | "people" | "euros_month";
    }
  | { type: "income" }
  /** Number of children, their ages and whether each has a disability ≥ 33 %. */
  | { type: "children" }
  | { type: "yesNo"; field: ProfileField };

export type Question = {
  id: string;
  /** Profile fields this question fills; it is asked only if a rule uses them. */
  fields: ProfileField[];
  input: QuestionInput;
  /** Extra condition on previous answers. */
  showIf?: (profile: Partial<HouseholdProfile>) => boolean;
  /** If true, the question is asked whenever showIf passes (e.g. region). */
  always?: boolean;
  /**
   * Answer implied when `showIf` hides the question (e.g. no children → not a
   * single-parent family). Without it, a hidden question's fields are cleared.
   */
  whenHidden?: Partial<HouseholdProfile>;
};

const hasChildren = (p: Partial<HouseholdProfile>) => (p.children?.length ?? 0) > 0;

export const OUTSIDE_REGIONS = "OTHER";

export const QUESTIONS: Question[] = [
  {
    id: "region",
    fields: ["region"],
    always: true,
    input: {
      type: "choice",
      options: [
        ...REGIONS.map((r) => ({ value: r.code, set: { region: r.code } })),
        { value: OUTSIDE_REGIONS, set: { region: OUTSIDE_REGIONS, municipality: undefined } },
      ],
    },
  },
  {
    id: "municipality",
    fields: ["municipality"],
    whenHidden: { municipality: undefined },
    showIf: (p) => REGIONS.some((r) => r.code === p.region && r.municipalities.length > 0),
    input: {
      type: "choice",
      options: [
        ...REGIONS.flatMap((r) =>
          r.municipalities.map((m) => ({ value: m.ineCode, set: { municipality: m.ineCode } })),
        ),
        // Any other municipality: we only need to know it is not one we cover.
        { value: "other", set: { municipality: "other" } },
      ],
    },
  },
  {
    id: "yearsRegisteredInRegion",
    fields: ["yearsRegisteredInRegion"],
    whenHidden: { yearsRegisteredInRegion: 0 },
    showIf: (p) => p.region !== OUTSIDE_REGIONS,
    input: {
      type: "choice",
      options: [
        { value: "lt1", set: { yearsRegisteredInRegion: 0 } },
        { value: "1to2", set: { yearsRegisteredInRegion: 1 } },
        { value: "2to5", set: { yearsRegisteredInRegion: 2 } },
        { value: "5plus", set: { yearsRegisteredInRegion: 5 } },
      ],
    },
  },
  {
    id: "applicantAge",
    fields: ["applicantAge"],
    input: { type: "number", field: "applicantAge", min: 14, max: 120, unit: "years" },
  },
  {
    id: "children",
    fields: ["children"],
    input: { type: "children" },
  },
  {
    id: "householdSize",
    fields: ["householdSize"],
    input: { type: "number", field: "householdSize", min: 1, max: 20, unit: "people" },
  },
  {
    id: "familyType",
    fields: ["isSingleParent", "isLargeFamily"],
    showIf: hasChildren,
    whenHidden: { isSingleParent: false, isLargeFamily: false },
    input: {
      type: "choice",
      options: [
        { value: "none", set: { isSingleParent: false, isLargeFamily: false } },
        { value: "singleParent", set: { isSingleParent: true, isLargeFamily: false } },
        { value: "largeFamily", set: { isSingleParent: false, isLargeFamily: true } },
        { value: "both", set: { isSingleParent: true, isLargeFamily: true } },
      ],
    },
  },
  {
    id: "annualHouseholdIncome",
    fields: ["annualHouseholdIncome"],
    input: { type: "income" },
  },
  {
    id: "employmentStatus",
    fields: ["employmentStatus"],
    input: {
      type: "choice",
      options: EMPLOYMENT_STATUSES.map((s) => ({ value: s, set: { employmentStatus: s } })),
    },
  },
  {
    id: "housing",
    fields: ["housing"],
    input: {
      type: "choice",
      options: HOUSING_SITUATIONS.map((h) => ({ value: h, set: { housing: h } })),
    },
  },
  {
    id: "monthlyRent",
    fields: ["monthlyRent"],
    whenHidden: { monthlyRent: undefined },
    showIf: (p) => p.housing === "renting",
    input: { type: "number", field: "monthlyRent", min: 0, max: 10000, unit: "euros_month" },
  },
  {
    id: "hasDependentPerson",
    fields: ["hasDependentPerson"],
    input: { type: "yesNo", field: "hasDependentPerson" },
  },
  {
    id: "applicantDisabilityPercent",
    fields: ["applicantDisabilityPercent"],
    input: {
      type: "choice",
      options: [
        { value: "none", set: { applicantDisabilityPercent: 0 } },
        { value: "33to64", set: { applicantDisabilityPercent: 33 } },
        { value: "65plus", set: { applicantDisabilityPercent: 65 } },
      ],
    },
  },
  {
    id: "yearsLegalResidenceInSpain",
    fields: ["yearsLegalResidenceInSpain"],
    input: {
      type: "choice",
      options: [
        { value: "lt1", set: { yearsLegalResidenceInSpain: 0 } },
        { value: "1to5", set: { yearsLegalResidenceInSpain: 1 } },
        { value: "5plus", set: { yearsLegalResidenceInSpain: 5 } },
      ],
    },
  },
  {
    id: "receivesMinimumIncome",
    fields: ["receivesMinimumIncome"],
    input: { type: "yesNo", field: "receivesMinimumIncome" },
  },
];
