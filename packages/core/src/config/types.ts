export type OfficialConstants = {
  year: number;
  /** IPREM monthly amount (€). */
  ipremMonthly: number;
  /** IPREM yearly amount, 12 payments (€). */
  iprem: number;
  /** IPREM yearly amount, 14 payments (€). Most income thresholds use this one. */
  iprem14: number;
  /** SMI monthly amount, 14 payments (€). */
  smiMonthly: number;
  /** SMI yearly amount (€). */
  smi: number;
  /** Ingreso Mínimo Vital: yearly guaranteed income for a single adult (€). */
  imvAnnualBase: number;
  /** Pensión no contributiva (jubilación/invalidez), yearly amount (€). */
  pncAnnual: number;
};

export const CONSTANT_KEYS = [
  "ipremMonthly",
  "iprem",
  "iprem14",
  "smiMonthly",
  "smi",
  "imvAnnualBase",
  "pncAnnual",
] as const;
export type ConstantKey = (typeof CONSTANT_KEYS)[number];
