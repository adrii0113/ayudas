# Proyecto: Plataforma de matching de ayudas públicas para ciudadanos (nombre provisional: "TeToca")

> Documento de contexto para Claude Code. Léelo entero antes de escribir código.
> Idioma del producto: español (preparado para añadir catalán/inglés más adelante).
> Idioma del código, commits y comentarios: inglés.

---

## 1. Qué estamos construyendo

Una web que responde a una sola pregunta: **"Con mi situación, ¿qué ayudas públicas me corresponden y qué tengo que hacer para pedirlas?"**

El usuario responde a un cuestionario corto (situación familiar, edad, ingresos aproximados, vivienda, empleo, municipio…) y el sistema devuelve:

1. Las ayudas para las que **cumple los requisitos**, con importe orientativo, plazo y enlace oficial.
2. Las ayudas para las que **casi cumple** (le falta 1 requisito), indicando cuál.
3. Para cada ayuda: checklist de documentos, pasos para solicitarla y enlace a la sede electrónica.
4. Alertas opcionales por email cuando se abre una convocatoria nueva que encaja con su perfil.

### Contexto de negocio (para entender las decisiones)
- Fase 1 (este MVP): **web B2C gratuita** con SEO para validar demanda y uso real.
- Fase 2: vender el mismo motor como **B2B2C** (marca blanca / widget / API) a gestorías, ayuntamientos, fintech/bancos y plataformas de beneficios para empleados.
- Competencia en empresas/pymes ya cubierta (FANDIT, Euro-Funding). **Nuestro hueco: particulares y familias, con matching real** (no un catálogo).
- Criterio de éxito: tráfico orgánico y uso real en 2–3 meses; 2–3 pilotos B2B en ~6 meses. Si no, se pivota.

### Alcance del MVP (estricto)
- **Una comunidad autónoma**: Castilla y León (configurable para añadir otras sin tocar código).
- **Un segmento**: familias y hogares (natalidad/crianza, vivienda/alquiler, energía/bono social, ingresos mínimos, becas, dependencia básica, empleo joven).
- **Niveles administrativos**: estatal + autonómico. Municipal solo para Valladolid capital como prueba.
- Objetivo de catálogo inicial: **30–50 ayudas bien estructuradas y verificadas**. Calidad > cantidad.

### Fuera de alcance (no construir ahora)
- Presentar solicitudes en nombre del usuario.
- Login obligatorio, apps móviles nativas, pagos.
- Ayudas para empresas/autónomos.
- Chat libre con IA como interfaz principal.

---

## 2. Principios no negociables

1. **El LLM nunca decide la elegibilidad.** El LLM solo *extrae* requisitos de textos oficiales a un esquema estructurado. La elegibilidad la calcula un **motor de reglas determinista**, testeable y auditable.
2. **Toda ayuda tiene revisión humana antes de publicarse.** Las extracciones del LLM entran en estado `draft` y un administrador las aprueba (`published`).
3. **Trazabilidad**: cada requisito guarda la fuente (URL del boletín/bases, fecha, fragmento de texto del que sale).
4. **Resultado orientativo**: aviso legal visible en cada resultado ("información orientativa, consulta las bases oficiales") + enlace a la fuente oficial.
5. **Privacidad por diseño (RGPD)**: el cuestionario funciona **sin registro** y sin guardar datos personales en servidor. Solo se guarda email + perfil si el usuario pide alertas, con consentimiento explícito y borrado fácil. No pedir DNI, nombre ni datos de salud identificables; para discapacidad/dependencia usar preguntas genéricas tipo sí/no y grado aproximado.
6. **Datos versionados**: las ayudas cambian cada año. Nunca sobrescribir; crear nueva versión por convocatoria/ejercicio.

---

## 3. Stack técnico

Proyecto personal: elegir lo más apropiado, **no SPFx ni stack Microsoft por defecto**.

- **Lenguaje**: TypeScript en todo el proyecto (monorepo).
- **Web**: Next.js (App Router) + React + Tailwind CSS + shadcn/ui. SSR/SSG para SEO.
- **Base de datos**: PostgreSQL (Supabase o Neon) + **Drizzle ORM**. `pgvector` opcional para búsqueda semántica en fase 2.
- **Jobs en segundo plano**: `pg-boss` (cola sobre Postgres) para ingesta y extracción. Sin Redis en el MVP.
- **LLM**: Claude vía API de Anthropic (SDK `@anthropic-ai/sdk`), con **salida estructurada validada con Zod**. Encapsular en un módulo `llm/` para poder cambiar de proveedor.
- **Motor de reglas**: propio, sobre JSON (ver §5). Alternativa aceptable: `json-logic-js`, pero preferimos un DSL tipado propio y legible.
- **Parseo de PDFs**: `pdf-parse` o `unpdf`; si un PDF es escaneado, marcarlo para revisión manual (sin OCR en el MVP).
- **Email**: Resend (alertas).
- **Tests**: Vitest (unidad, sobre todo el motor de reglas) + Playwright (e2e del cuestionario).
- **Deploy**: Vercel (web) + Supabase/Neon (BD). Jobs programados con Vercel Cron o GitHub Actions.
- **Calidad**: ESLint, Prettier, `tsc --noEmit` en CI (GitHub Actions).

### Estructura del monorepo (pnpm workspaces)
```
/apps
  /web            -> Next.js (público + panel admin en /admin)
/packages
  /core           -> tipos de dominio, esquemas Zod, motor de reglas (sin dependencias de infra)
  /db             -> esquema Drizzle, migraciones, seeds
  /ingestion      -> conectores de fuentes (BDNS, boletines, catálogo manual)
  /extraction     -> pipeline LLM: texto -> requisitos estructurados
  /llm            -> cliente Anthropic encapsulado, prompts versionados
/data
  /seed           -> ayudas curadas a mano en YAML (fuente de verdad del MVP)
```

---

## 4. Fuentes de datos

**Importante**: no todas las ayudas a ciudadanos son "convocatorias". Hay dos tipos:

1. **Prestaciones permanentes** (no salen como convocatoria anual): Ingreso Mínimo Vital, prestación por nacimiento y cuidado de menor, bono social eléctrico/térmico, deducciones IRPF por familia, etc. → **catálogo curado a mano** en `/data/seed/*.yaml`, revisado periódicamente.
2. **Convocatorias** (se publican con plazo): ayudas al alquiler, becas, ayudas autonómicas a natalidad, eficiencia energética… → ingesta automática.

Fuentes de convocatorias:
- **BDNS / Sistema Nacional de Publicidad de Subvenciones (SNPSAP)**: tiene API REST pública con JSON. **Antes de implementar, localiza y lee la documentación oficial actual de la API en infosubvenciones.es** y verifica endpoints, parámetros y límites; no asumas URLs. Filtrar por beneficiario tipo "personas físicas" y por región.
- **Boletín autonómico (BOCYL)** y sede de la Junta de Castilla y León: para enlazar bases completas y detectar ayudas que la BDNS no detalle.
- **Ayuntamiento de Valladolid**: sede electrónica (solo fase de prueba).

Reglas de ingesta:
- Respetar `robots.txt`, términos de uso y límites de peticiones. Nada de scraping agresivo.
- Guardar el documento original (texto + hash + URL + fecha) para trazabilidad.
- Deduplicar por identificador BDNS y por hash del documento.

---

## 5. Modelo de dominio

### Perfil del usuario (`HouseholdProfile`, no se persiste salvo alertas)
```ts
type HouseholdProfile = {
  region: "CL";                 // código CCAA
  municipality?: string;        // código INE
  applicantAge: number;
  householdSize: number;
  children: { age: number; disabilityPercent?: number }[];
  annualHouseholdIncome: number; // aproximado, en tramos permitido
  employmentStatus: "employed" | "unemployed" | "self_employed" | "student" | "retired" | "other";
  housing: "renting" | "owner_mortgage" | "owner_no_mortgage" | "other";
  monthlyRent?: number;
  isLargeFamily?: boolean;       // familia numerosa
  isSingleParent?: boolean;      // familia monoparental
  hasDependentPerson?: boolean;
  applicantDisabilityPercent?: number;
  yearsRegisteredInRegion?: number; // empadronamiento
};
```
El cuestionario debe ser **adaptativo**: solo preguntar lo que afecte a alguna ayuda activa del catálogo.

### Ayuda (`Benefit`) — versionada
```ts
type Benefit = {
  id: string;
  slug: string;                 // para la URL SEO
  title: string;
  summary: string;              // lenguaje llano, máx. 2 frases
  level: "state" | "regional" | "municipal";
  region?: string;
  municipality?: string;
  category: "birth" | "housing" | "energy" | "income" | "education" | "dependency" | "employment";
  kind: "permanent" | "call";   // prestación permanente o convocatoria
  amount: { type: "fixed" | "range" | "percent" | "variable"; min?: number; max?: number; text: string };
  window?: { opensAt?: string; closesAt?: string }; // ISO
  eligibility: RuleGroup;       // ver abajo
  documents: string[];
  steps: string[];
  officialUrl: string;
  sources: { url: string; retrievedAt: string; excerpt?: string }[];
  status: "draft" | "published" | "archived";
  version: number;
  reviewedBy?: string;
  reviewedAt?: string;
};
```

### Motor de reglas (`packages/core/rules`)
DSL JSON tipado y legible:
```ts
type Rule =
  | { field: keyof HouseholdProfile | string; op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in"; value: unknown; label: string }
  | { op: "exists"; field: string; label: string };

type RuleGroup = { all?: (Rule | RuleGroup)[]; any?: (Rule | RuleGroup)[] };
```
- `label` es el texto humano del requisito ("Ingresos del hogar inferiores a 3 veces el IPREM").
- Soportar valores derivados calculados en código, no en el LLM: `iprem` (valor anual vigente en config), `incomePerCapita`, `youngestChildAge`, `numChildren`.
- El evaluador devuelve, por ayuda: `eligible | almost | not_eligible | unknown` + lista de requisitos cumplidos, fallados y desconocidos (si falta un dato del perfil → `unknown`, nunca asumir).
- `almost` = falla exactamente 1 requisito no excluyente (configurable).
- **Cobertura de tests del motor ≥ 90%**, con casos reales por ayuda (fixtures de perfiles).

Constantes oficiales (IPREM, SMI, umbrales…) en `packages/core/config/constants.<year>.ts`, con la fuente citada en comentario. **Verificar valores vigentes al implementar; no confiar en valores de memoria.**

---

## 6. Pipeline de extracción con LLM

1. `ingestion` guarda el texto de la convocatoria/bases.
2. `extraction` envía a Claude el texto + el esquema Zod de `Benefit` (sin `status`/`version`) y pide:
   - campos estructurados,
   - `eligibility` en el DSL,
   - para cada regla, el **fragmento literal** del texto que la justifica (`excerpt`),
   - lista `uncertainties` con lo que no ha podido determinar.
3. Validar con Zod. Si falla, reintentar 1 vez con el error; si vuelve a fallar, marcar para revisión manual.
4. Guardar como `draft`. Nunca publicar automáticamente.
5. Prompts versionados en `packages/llm/prompts/` (con número de versión guardado junto a cada extracción).
6. Controlar coste: cachear por hash del documento; no reprocesar si no cambió.

---

## 7. Panel de administración (`/admin`)

Protegido (Supabase Auth o auth simple con un único admin en el MVP).
- Lista de ayudas por estado (`draft`, `published`, `archived`) y por fecha de cierre.
- Vista de revisión: a la izquierda el texto fuente con los fragmentos resaltados; a la derecha el formulario editable de la ayuda y sus reglas.
- Botón "Probar con perfil": ejecutar el motor contra perfiles de ejemplo.
- Aprobar → `published` (guarda `reviewedBy`, `reviewedAt`).
- Avisos: ayudas cuya `window.closesAt` ya pasó → proponer archivar; ayudas sin revisar hace más de 12 meses → marcar.

---

## 8. Web pública

### Páginas
- `/` — propuesta de valor + botón "Descubre tus ayudas" (sin registro).
- `/cuestionario` — cuestionario adaptativo, 1 pregunta por pantalla en móvil, barra de progreso, máx. ~12 preguntas. Estado en el cliente.
- `/resultados` — agrupado en "Te corresponden", "Casi" (con el requisito que falta) y "Revisa" (desconocidos). Cada tarjeta: importe, plazo, por qué cumple, documentos, botón a la fuente oficial.
- `/ayudas/[slug]` — página SEO estática por ayuda (qué es, requisitos en lenguaje llano, importe, plazos, cómo pedirla, fuente oficial, fecha de última revisión). Datos estructurados schema.org (`GovernmentService`, `FAQPage`).
- `/ayudas/[categoria]/[region]` — páginas índice SEO.
- `/alertas` — suscripción con email + doble opt-in; enlace de baja y borrado en cada email.
- `/aviso-legal`, `/privacidad`, `/cookies`.

### Requisitos de UX
- Mobile-first, accesible (WCAG 2.1 AA): etiquetas, contraste, navegación por teclado.
- Lenguaje llano, sin jerga administrativa; explicar términos como IPREM con un tooltip.
- Aviso orientativo visible en resultados.
- Analítica respetuosa sin cookies (Plausible o Umami).

---

## 9. Alertas

- Job diario: para cada suscriptor, evaluar ayudas `published` nuevas o reabiertas desde el último envío.
- Enviar solo si hay coincidencias `eligible` o `almost`. Máx. 1 email por semana por usuario.
- Perfil de alertas guardado cifrado en reposo y borrable con un clic.

---

## 10. Preparado para B2B (fase 2, no implementar ya, pero no bloquearlo)

- Mantener el motor de reglas y el catálogo en `packages/core` independientes de Next.js.
- Diseñar el evaluador como función pura `evaluate(profile, benefits) -> results` para exponerla luego como API REST y widget embebible con marca blanca.
- Columna `tenantId` opcional en tablas de configuración (sin lógica multi-tenant aún).

---

## 11. Hitos

1. **Base**: monorepo, CI, esquema BD, tipos de dominio, motor de reglas con tests.
2. **Catálogo manual**: 15 ayudas curadas en YAML + seed + página `/ayudas/[slug]`.
3. **Cuestionario y resultados** funcionando contra el catálogo manual. → *Primer deploy público.*
4. **Ingesta BDNS** para Castilla y León (personas físicas) + guardado de documentos.
5. **Extracción LLM** + panel admin de revisión.
6. **Ampliar a 30–50 ayudas**, páginas índice SEO, sitemap.
7. **Alertas por email**.
8. Métricas: completar cuestionario, nº de ayudas mostradas, clics a fuente oficial, suscripciones.

En cada hito: tests en verde, `tsc` sin errores y un README actualizado.

---

## 12. Convenciones para Claude Code

- Antes de cambios grandes, proponer un plan breve y esperar confirmación.
- Commits pequeños y descriptivos (Conventional Commits).
- No inventar datos oficiales (importes, umbrales, URLs, endpoints): si no se puede verificar, dejar `TODO(verify)` y avisar.
- Secretos solo en `.env` (`ANTHROPIC_API_KEY`, `DATABASE_URL`, `RESEND_API_KEY`); mantener `.env.example`.
- Lógica de negocio en `packages/core`, nunca en componentes React.
- Todo texto visible al usuario centralizado (preparado para i18n con `next-intl`).

---

## 13. Preguntas abiertas (decidir con el propietario)

- Nombre definitivo y dominio.
- ¿Castilla y León o Cataluña como primera comunidad? (por defecto CL).
- ¿Ofrecer resultados en tramos de ingresos en vez de cifra exacta para reducir fricción?
- Frecuencia de revisión del catálogo manual (propuesta: trimestral + al inicio de cada año por cambios de IPREM/presupuestos).

---

## 14. Decisiones del propietario posteriores al MVP (15/10/2026)

Prevalecen sobre lo anterior donde haya conflicto. Diseño completo en `docs/sistema-de-datos.md`.

- **El producto principal son los datos**: registro de *todas* las ayudas de cualquier
  administración española (estatal, autonómica, provincial, municipal, otros organismos) y para
  *cualquier* beneficiario (personas, autónomos, empresas, entidades). «Ayudas a empresas» deja
  de estar fuera de alcance **en la base de datos**; la web B2C sigue centrada en hogares mediante filtros.
- **Toda España**, incluidos los territorios forales (País Vasco y Navarra).
- **La base de datos es la fuente de verdad**, con exportación diaria a Git. Los YAML de
  `data/seed` quedan como semilla y fixtures.
- **Niveles de confianza** `detected` → `extracted` → `agent_verified` → `human_verified`. Lo no
  revisado por personas se puede mostrar, siempre etiquetado y con enlace oficial.
- **Agentes de verificación** comprueban la veracidad contra las fuentes oficiales y dejan
  registro auditable. No deciden la elegibilidad de los usuarios (el principio 1 sigue igual).
- **Sin revisión humana obligatoria (decisión del 15/10/2026)**: el propietario no revisará fichas.
  Sustituye al principio 2: una ficha entra en el cuestionario si **pasa la verificación automática**
  contra la fuente oficial (como mínimo: cada requisito con cita literal encontrada en el documento
  oficial, enlaces vivos y plazo no vencido), y la web lo indica con una etiqueta visible
  («comprobada automáticamente contra la fuente oficial el …»). Lo que no pase no se evalúa.
- **Prioridad del MVP nacional**: cubrir todas las comunidades con las ayudas más solicitadas
  (renta mínima autonómica, deducciones autonómicas del IRPF más usadas, alquiler) más la lista de
  convocatorias abiertas de la BDNS de cada comunidad, etiquetada «sin verificar».
