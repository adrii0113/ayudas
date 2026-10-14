import {
  bdnsDetailSchema,
  bdnsSearchPageSchema,
  type BdnsDetail,
  type BdnsSearchPage,
} from "./schemas";

export const BDNS_API_BASE = "https://www.infosubvenciones.es/bdnstrans/api";

export type BdnsSearchParams = {
  /** Region ids (see GET /regiones). Castilla y León = 29. */
  regions?: number[];
  beneficiaryTypes?: number[];
  /** "C" State, "A" regional, "L" local, "O" others. */
  administrationType?: "C" | "A" | "L" | "O";
  /** YYYY-MM-DD, converted to the API's dd/mm/yyyy. */
  from?: string;
  to?: string;
  text?: string;
  page?: number;
  pageSize?: number;
};

export type BdnsClientOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Minimum delay between requests, to be polite with a public service. */
  minIntervalMs?: number;
  retries?: number;
  userAgent?: string;
  sleep?: (ms: number) => Promise<void>;
};

const toApiDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/** Small, rate-limited client for the public BDNS/SNPSAP REST API. */
export class BdnsClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly retries: number;
  private readonly userAgent: string;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastRequestAt = 0;

  constructor(options: BdnsClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? BDNS_API_BASE;
    this.fetchFn = options.fetch ?? fetch;
    this.minIntervalMs = options.minIntervalMs ?? 1000;
    this.retries = options.retries ?? 2;
    this.userAgent = options.userAgent ?? "TeToca/0.1 (ayudas para ciudadanos; ingesta diaria)";
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private async request(path: string, params: URLSearchParams): Promise<Response> {
    const url = `${this.baseUrl}${path}?${params.toString()}`;
    for (let attempt = 0; ; attempt++) {
      const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
      if (wait > 0) await this.sleep(wait);
      this.lastRequestAt = Date.now();
      const res = await this.fetchFn(url, { headers: { "User-Agent": this.userAgent } });
      if (res.ok) return res;
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= this.retries) {
        throw new Error(`BDNS ${path} failed with HTTP ${res.status}`);
      }
      await this.sleep(this.minIntervalMs * 2 ** (attempt + 1));
    }
  }

  async search(p: BdnsSearchParams): Promise<BdnsSearchPage> {
    const params = new URLSearchParams({
      vpd: "GE",
      page: String(p.page ?? 0),
      pageSize: String(p.pageSize ?? 50),
      order: "numeroConvocatoria",
      direccion: "desc",
    });
    if (p.regions?.length) params.set("regiones", p.regions.join(","));
    if (p.beneficiaryTypes?.length) params.set("tiposBeneficiario", p.beneficiaryTypes.join(","));
    if (p.administrationType) params.set("tipoAdministracion", p.administrationType);
    if (p.from) params.set("fechaDesde", toApiDate(p.from));
    if (p.to) params.set("fechaHasta", toApiDate(p.to));
    if (p.text) {
      params.set("descripcion", p.text);
      params.set("descripcionTipoBusqueda", "1");
    }
    const res = await this.request("/convocatorias/busqueda", params);
    return bdnsSearchPageSchema.parse(await res.json());
  }

  /** Iterates over every page of a search. */
  async *searchAll(p: Omit<BdnsSearchParams, "page">) {
    for (let page = 0; ; page++) {
      const result = await this.search({ ...p, page });
      yield* result.content;
      if (result.last || result.content.length === 0) return;
    }
  }

  async getCall(code: string): Promise<BdnsDetail> {
    const res = await this.request(
      "/convocatorias",
      new URLSearchParams({ vpd: "GE", numConv: code }),
    );
    return bdnsDetailSchema.parse(await res.json());
  }

  async getDocument(id: number): Promise<Uint8Array> {
    const res = await this.request(
      "/convocatorias/documentos",
      new URLSearchParams({ idDocumento: String(id) }),
    );
    return new Uint8Array(await res.arrayBuffer());
  }

  /** Public web page of a call (for users and reviewers). */
  static callUrl(code: string): string {
    return `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${code}`;
  }
}
