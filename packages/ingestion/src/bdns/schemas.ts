import { z } from "zod";

/**
 * Response schemas of the public SNPSAP/BDNS API, as documented in
 * https://www.infosubvenciones.es/bdnstrans/estaticos/doc/snpsap-api.json
 * (checked 2026-10-14). Unknown fields are ignored.
 */
export const bdnsSearchItemSchema = z.object({
  id: z.number(),
  numeroConvocatoria: z.string(),
  descripcion: z.string(),
  fechaRecepcion: z.string(),
  nivel1: z.string().nullable(),
  nivel2: z.string().nullable(),
  nivel3: z.string().nullable(),
});

export const bdnsSearchPageSchema = z.object({
  content: z.array(bdnsSearchItemSchema),
  totalElements: z.number(),
  totalPages: z.number(),
  number: z.number(),
  last: z.boolean(),
});

const described = z.object({ descripcion: z.string().nullable() });

export const bdnsDetailSchema = z.object({
  id: z.number(),
  codigoBDNS: z.string(),
  descripcion: z.string(),
  organo: z.object({
    nivel1: z.string().nullable(),
    nivel2: z.string().nullable(),
    nivel3: z.string().nullable(),
  }),
  sedeElectronica: z.string().nullable(),
  fechaRecepcion: z.string(),
  tipoConvocatoria: z.string().nullable(),
  presupuestoTotal: z.number().nullable(),
  tiposBeneficiarios: z.array(described),
  regiones: z.array(described),
  descripcionFinalidad: z.string().nullable(),
  urlBasesReguladoras: z.string().nullable(),
  abierto: z.boolean().nullable(),
  fechaInicioSolicitud: z.string().nullable(),
  fechaFinSolicitud: z.string().nullable(),
  textInicio: z.string().nullable(),
  textFin: z.string().nullable(),
  documentos: z.array(
    z.object({
      id: z.number(),
      descripcion: z.string().nullable(),
      nombreFic: z.string().nullable(),
      long: z.number().nullable(),
    }),
  ),
  anuncios: z
    .array(
      z.object({
        titulo: z.string().nullable(),
        texto: z.string().nullable(),
        url: z.string().nullable(),
      }),
    )
    .default([]),
});

export type BdnsSearchItem = z.infer<typeof bdnsSearchItemSchema>;
export type BdnsSearchPage = z.infer<typeof bdnsSearchPageSchema>;
export type BdnsDetail = z.infer<typeof bdnsDetailSchema>;

/** BDNS beneficiary type: "PERSONAS FÍSICAS QUE NO DESARROLLAN ACTIVIDAD ECONÓMICA". */
export const BDNS_BENEFICIARY_INDIVIDUALS = 1;
