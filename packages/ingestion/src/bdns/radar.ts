import { territoryAncestors } from "@tetoca/core";
import {
  listEditionsToRefresh,
  listEditionsWithoutDetail,
  upsertDetectedEdition,
  type Database,
  type DetectedEditionInput,
} from "@tetoca/db";
import { BdnsClient } from "./client";
import {
  callFromDetail,
  callFromSearchItem,
  commonTerritory,
  type DetectedCall,
  type MunicipalityIndex,
} from "./normalize";

/**
 * National radar: registers every call published in the BDNS (all
 * administrations, all beneficiary types) as a `detected` program/edition.
 *
 * Two cheap passes, so a daily run stays small and a backfill can resume:
 * 1. listing: search results by publication date → stubs (1 request per 50 calls);
 * 2. details: one request per call, for new stubs and for open calls whose
 *    data may have changed (deadlines are extended, corrections published).
 */
export type RadarOptions = {
  db: Database;
  client: BdnsClient;
  municipalities: MunicipalityIndex;
  /** YYYY-MM-DD publication-date range for the listing pass. */
  from?: string;
  to?: string;
  /** Max detail requests in this run (the BDNS is a public service: be gentle). */
  maxDetails?: number;
  /** Re-fetch open calls last refreshed before this date. */
  refreshBefore?: Date;
  today: string;
  log?: (message: string) => void;
};

export type RadarResult = {
  listed: number;
  created: number;
  detailed: number;
  sourceChanged: string[];
  errors: { bdnsCode: string; message: string }[];
};

/** The narrowest of the organism's territory and the call's declared regions. */
export function scopeTerritory(call: DetectedCall): string {
  const organism = call.organism.territoryId;
  const declared = call.detail ? commonTerritory(call.detail.territoryIds) : organism;
  if (territoryAncestors(declared).includes(organism)) return declared;
  if (territoryAncestors(organism).includes(declared)) return organism;
  return organism;
}

export function toEditionInput(call: DetectedCall): DetectedEditionInput {
  const { raw, purpose: _purpose, ...detail } = call.detail ?? ({} as never);
  return {
    bdnsCode: call.bdnsCode,
    title: call.title,
    publishedAt: call.publishedAt,
    programType: call.programType,
    territoryId: scopeTerritory(call),
    organism: call.organism,
    detail: call.detail
      ? {
          ...detail,
          // Calls without their own e-office page link to the official BDNS record.
          officialUrl: detail.officialUrl ?? BdnsClient.callUrl(call.bdnsCode),
          raw: raw as unknown as Record<string, unknown>,
        }
      : undefined,
  };
}

export async function runBdnsRadar(opts: RadarOptions): Promise<RadarResult> {
  const { db, client, municipalities, today } = opts;
  const log = opts.log ?? (() => {});
  const result: RadarResult = { listed: 0, created: 0, detailed: 0, sourceChanged: [], errors: [] };

  if (opts.from) {
    for await (const item of client.searchAll({ from: opts.from, to: opts.to, pageSize: 50 })) {
      const outcome = await upsertDetectedEdition(
        db,
        toEditionInput(callFromSearchItem(item, municipalities)),
      );
      result.listed++;
      if (outcome.created) result.created++;
      if (result.listed % 500 === 0) log(`listed ${result.listed} (${result.created} new)`);
    }
  }

  const budget = opts.maxDetails ?? 200;
  const pending = await listEditionsWithoutDetail(db, budget);
  const refresh = opts.refreshBefore
    ? await listEditionsToRefresh(db, opts.refreshBefore, Math.max(0, budget - pending.length))
    : [];
  for (const code of [...pending, ...refresh].slice(0, budget)) {
    try {
      const detail = await client.getCall(code);
      const outcome = await upsertDetectedEdition(
        db,
        toEditionInput(callFromDetail(detail, municipalities, today)),
      );
      result.detailed++;
      if (outcome.sourceChanged) result.sourceChanged.push(code);
    } catch (err) {
      result.errors.push({ bdnsCode: code, message: (err as Error).message });
    }
    if (result.detailed % 100 === 0 && result.detailed) log(`details ${result.detailed}`);
  }
  log(
    `radar: ${result.listed} listed, ${result.created} new, ${result.detailed} detailed, ` +
      `${result.sourceChanged.length} changed, ${result.errors.length} errors`,
  );
  return result;
}
