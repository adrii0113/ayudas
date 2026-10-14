/**
 * Regions and municipalities enabled in the product. Adding a new region is a
 * config change here plus its catalog entries in /data/seed.
 */
export type RegionConfig = {
  code: string;
  name: string;
  /** BDNS region id (see GET /regiones on the SNPSAP API). */
  bdnsRegionId: number;
  municipalities: { ineCode: string; name: string }[];
};

export const REGIONS: RegionConfig[] = [
  {
    code: "CL",
    name: "Castilla y León",
    bdnsRegionId: 29,
    municipalities: [{ ineCode: "47186", name: "Valladolid" }],
  },
];

export const DEFAULT_REGION = "CL";

export function getRegion(code: string): RegionConfig | undefined {
  return REGIONS.find((r) => r.code === code);
}
