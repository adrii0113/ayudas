import openCallsJson from "@/generated/open-calls.json";

export type OpenCall = {
  bdnsCode: string;
  title: string;
  organism: string;
  opensAt: string | null;
  closesAt: string | null;
  windowText: string | null;
  url: string;
  publishedAt: string | null;
};

export type OpenCallsData = {
  generatedAt: string | null;
  byRegion: Record<string, OpenCall[]>;
};

/** Open BDNS calls per community (detected, not reviewed). */
export function getOpenCalls(): OpenCallsData {
  const data = openCallsJson as unknown as OpenCallsData;
  return { generatedAt: data.generatedAt ?? null, byRegion: data.byRegion ?? {} };
}
