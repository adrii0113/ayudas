import type { OfficialConstants } from "./types";

/**
 * Official reference values for 2026.
 *
 * IPREM — Indicador Público de Renta de Efectos Múltiples.
 *   600 €/month, 7.200 €/year (12 payments), 8.400 €/year (14 payments).
 *   Set by Ley 31/2022 (PGE 2023), still in force through budget extensions
 *   (prórroga presupuestaria) in 2024, 2025 and 2026.
 *   Checked 2026-10-14 against OCU (https://www.ocu.org/dinero/trabajo-paro/noticias/smi-iprem)
 *   and other secondary sources.
 *   TODO(verify): confirm against a BOE text referencing the 2026 IPREM.
 *
 * SMI — Salario Mínimo Interprofesional.
 *   1.221 €/month in 14 payments = 17.094 €/year.
 *   Real Decreto 126/2026, de 18 de febrero (BOE 19-02-2026).
 *   Note: its transitional provision says the new SMI does not automatically
 *   replace SMI references in public-law thresholds; each benefit must say which
 *   value applies.
 *
 * IMV — Ingreso Mínimo Vital, renta garantizada 2026 for a single adult:
 *   733,60 €/month, 8.803,20 €/year. Each extra member adds 30 % (max. 220 %),
 *   single-parent households add 22 %.
 *   Source: Seguridad Social, "Ingreso Mínimo Vital" (checked 2026-10-14)
 *   https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/65850d68-8d06-4645-bde7-05374ee42ac7
 */
export const constants2026: OfficialConstants = {
  year: 2026,
  ipremMonthly: 600,
  iprem: 7200,
  iprem14: 8400,
  smiMonthly: 1221,
  smi: 17094,
  imvAnnualBase: 8803.2,
};
