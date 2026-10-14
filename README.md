# TeToca

Web que responde a una pregunta: **«Con mi situación, ¿qué ayudas públicas me corresponden y qué
tengo que hacer para pedirlas?»**. MVP para familias y hogares de Castilla y León (ayudas
estatales + autonómicas; Valladolid como prueba municipal).

La especificación completa está en [`CLAUDE.md`](./CLAUDE.md).

> **Antes de publicar:** las 30 fichas del catálogo se han redactado a partir de fuentes oficiales
> pero **ninguna ha pasado aún la revisión humana** (`reviewedBy: "claude-code (requiere revisión
humana)"`). Revisa cada una (ver [Revisión del catálogo](#revisión-del-catálogo)) y construye en
> producción con `REQUIRE_HUMAN_REVIEW=1` para que la validación falle si queda alguna pendiente.

## Estado por hitos

| Hito                                                                | Estado                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1. Base: monorepo, CI, esquema BD, tipos, motor de reglas con tests | ✅                                                                              |
| 2. Catálogo manual + seed + página `/ayudas/[slug]`                 | ✅                                                                              |
| 3. Cuestionario y resultados contra el catálogo                     | ✅ (listo para primer deploy)                                                   |
| 4. Ingesta BDNS para Castilla y León (personas físicas)             | ✅                                                                              |
| 5. Extracción con LLM + panel de revisión `/admin`                  | ✅ (sin probar contra la API real: falta `ANTHROPIC_API_KEY`)                   |
| 6. 30–50 ayudas, índices SEO, sitemap                               | ✅ 30 publicadas + 1 borrador                                                   |
| 7. Alertas por email                                                | ✅ (envío real pendiente de `RESEND_API_KEY` y dominio)                         |
| 8. Métricas                                                         | ✅ eventos sin cookies (Plausible) cableados; falta crear el sitio en Plausible |

Calidad: `tsc` sin errores, ESLint y Prettier limpios, 159 tests unitarios y de integración (motor de
reglas con ~99 % de cobertura de líneas) y 16 tests e2e con Playwright (móvil + escritorio,
incluido análisis de accesibilidad WCAG 2.1 AA con axe).

## Arquitectura

```
apps/web            Next.js 15 (App Router) + Tailwind 4 + next-intl. Web pública y /admin
packages/core       Dominio puro: esquemas Zod, motor de reglas, cuestionario, constantes oficiales
packages/db         Drizzle (Postgres), migraciones, repositorios, catálogo YAML, cifrado de alertas
packages/ingestion  Conector BDNS, extracción de texto de PDF, worker de colas (pg-boss)
packages/llm        Proveedor LLM (Claude vía @anthropic-ai/sdk) y prompts versionados
packages/extraction Texto oficial → borrador estructurado (validado, trazable, nunca publicado solo)
packages/alerts     Plantillas, envío (Resend) y job de alertas
data/seed           Catálogo curado a mano: una ayuda por fichero YAML (fuente de verdad del MVP)
```

Principios aplicados (ver `CLAUDE.md` §2):

- **El LLM nunca decide la elegibilidad.** La calcula `evaluate(profile, benefits)` en
  `packages/core`, una función pura con lógica de tres valores: si falta un dato, el requisito es
  `unknown`, nunca se supone.
- **Revisión humana obligatoria.** Las extracciones entran como `draft`; solo un admin publica.
  Publicar con `TODO(verify)` está bloqueado.
- **Trazabilidad.** Cada requisito guarda el fragmento literal de la fuente (`source.excerpt`); la
  extracción comprueba que la cita aparece de verdad en el texto.
- **Privacidad.** El cuestionario se evalúa en el navegador; las respuestas viven en
  `sessionStorage` y nunca llegan al servidor. Solo las alertas guardan email + perfil, cifrados
  (AES-256-GCM), con doble opt-in y borrado con un clic.
- **Versionado.** Editar una ayuda publicada crea una versión nueva en borrador; al aprobarla se
  archiva la anterior.

### Motor de reglas

DSL JSON tipado (`packages/core/src/rules`):

```yaml
eligibility:
  all:
    - field: applicantAge # campo del perfil o derivado (numMinors, youngestChildAge…)
      op: lt # eq | neq | lt | lte | gt | gte | in | exists
      value: 36
      label: Tener menos de 36 años
      source: { excerpt: "Que el contribuyente tenga menos de 36 años…" }
    - field: annualHouseholdIncome
      op: lte
      value: { mul: [3, { ref: iprem14 }] } # expresiones: ref / add / mul / min
      label: Ingresos de hasta 3 veces el IPREM
      hard: true # si falla, nunca se muestra como «casi»
  any: [...] # basta con cumplir uno; cuenta como un solo requisito
```

Resultado por ayuda: `eligible | almost | not_eligible | unknown` con requisitos cumplidos,
fallidos y desconocidos. `almost` = falla exactamente un requisito no excluyente (configurable).
Las constantes (IPREM, SMI, IMV, PNC) están en `packages/core/src/config/constants.2026.ts` con su
fuente citada.

### Cuestionario adaptativo

Solo pregunta lo que usa alguna ayuda activa, y se salta las preguntas de opción cuya respuesta no
cambiaría ningún resultado con lo ya respondido. Con el catálogo actual, un hogar responde entre
11 y 13 preguntas (hay un test que lo vigila).

## Puesta en marcha

Requisitos: Node 22 (`.nvmrc`) y pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev                     # http://localhost:3000 (sin base de datos: lee el catálogo YAML)
```

Sin `DATABASE_URL` la web pública funciona entera con el catálogo YAML compilado a JSON en el
build. La base de datos hace falta para `/admin`, la ingesta, la extracción y las alertas.

### Base de datos local sin Docker

```bash
pnpm --filter @tetoca/db db:local          # Postgres compatible (PGlite) en :5432, datos en .pglite/
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres
export DATABASE_POOL_MAX=1                 # PGlite atiende una consulta cada vez
pnpm --filter @tetoca/db db:migrate
pnpm --filter @tetoca/db db:seed           # carga data/seed (no sobrescribe versiones existentes)
```

Con Docker o un Postgres real (Neon/Supabase) basta con su `DATABASE_URL`.

### Comandos útiles

| Comando                                                                                | Qué hace                                                        |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `pnpm test` / `pnpm test:coverage`                                                     | Tests de todos los paquetes / cobertura del motor (umbral 90 %) |
| `pnpm --filter @tetoca/web test:e2e`                                                   | Playwright (requiere `pnpm --filter @tetoca/web build`)         |
| `pnpm typecheck`, `pnpm lint`, `pnpm format`                                           | Calidad                                                         |
| `pnpm catalog:validate`                                                                | Valida todos los YAML (esquema, tipos de reglas, slugs, TODOs)  |
| `pnpm --filter @tetoca/ingestion ingest:bdns --since 2026-09-01 --limit 20 [--memory]` | Ingesta BDNS (`--memory` la prueba sin BD)                      |
| `pnpm --filter @tetoca/extraction extract --limit 10`                                  | Extrae borradores con Claude de documentos pendientes           |
| `pnpm --filter @tetoca/alerts send`                                                    | Job de alertas                                                  |
| `pnpm --filter @tetoca/ingestion worker`                                               | Worker pg-boss (ingesta diaria, extracción y alertas)           |
| `pnpm --filter @tetoca/db db:generate`                                                 | Genera una migración tras cambiar `schema.ts`                   |

### Variables de entorno

Ver [`.env.example`](./.env.example). Resumen:

| Variable                                               | Para qué                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| `DATABASE_URL`, `DATABASE_POOL_MAX`                    | Postgres (opcional para la web pública)                              |
| `ANTHROPIC_API_KEY`                                    | Extracción con Claude (`claude-opus-5-5`)                            |
| `RESEND_API_KEY`, `EMAIL_FROM`                         | Envío de emails; sin clave se imprimen por consola                   |
| `ALERTS_ENCRYPTION_KEY`                                | Clave AES-256 para datos de suscriptores (`openssl rand -base64 32`) |
| `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | Acceso a `/admin` (secreto ≥ 32 caracteres)                          |
| `NEXT_PUBLIC_SITE_URL`                                 | URLs canónicas, sitemap y enlaces de los emails                      |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`                         | Analítica sin cookies (vacío = desactivada)                          |
| `REQUIRE_HUMAN_REVIEW=1`                               | Hace fallar `catalog:validate` si hay fichas sin revisión humana     |

## Flujo de datos

1. **Catálogo manual** (`data/seed/*.yaml`): prestaciones permanentes y convocatorias curadas.
   `db:seed` las inserta; si cambias el contenido de una ficha ya cargada, sube `version`.
2. **Ingesta** (`ingest:bdns`): busca en la API pública de la BDNS
   ([especificación oficial](https://www.infosubvenciones.es/bdnstrans/estaticos/doc/snpsap-api.json))
   convocatorias para personas físicas en Castilla y León, descarta las de empresas, premios y
   concesiones directas, y las locales fuera de los municipios configurados. Guarda texto, hash,
   URL y metadatos. Un PDF sin capa de texto se marca para revisión manual (sin OCR en el MVP).
   1 petición por segundo como máximo.
3. **Extracción** (`extract`): Claude devuelve la ayuda en el DSL con salida estructurada (Zod),
   cita literal por requisito y lista de dudas. Se valida; si falla, se reintenta una vez con los
   errores; si vuelve a fallar, queda para revisión manual. Caché por hash del documento + versión
   del prompt (`packages/llm/prompts`). Se activa el _fallback_ del servidor ante rechazos del
   modelo (`fallbacks: "default"`).
4. **Revisión** (`/admin`): texto fuente con las citas resaltadas, formulario editable,
   «Probar con perfiles de ejemplo», aprobar/archivar. Avisos: plazo vencido, revisión de hace más
   de 12 meses, pendiente de revisión humana.
5. **Publicación**: con `DATABASE_URL`, la web lee las ayudas publicadas de la BD (ISR cada hora);
   sin ella, del YAML.
6. **Alertas**: job diario; solo ayudas nuevas o reabiertas que encajen (`eligible`/`almost`),
   nunca repetidas, máximo un email por semana.

## Revisión del catálogo

Para cada fichero de `data/seed` (o desde `/admin` si usas la BD):

1. Abre las URLs de `sources` y comprueba importes, requisitos, plazos y enlaces.
2. Corrige lo necesario. Las reglas que no se pueden modelar con los datos del cuestionario van en
   `otherRequirements`.
3. Cambia `reviewedBy` por tu nombre y `reviewedAt` por la fecha.
4. `pnpm catalog:validate && pnpm --filter @tetoca/db test` (los tests de `catalog.test.ts`
   comprueban casos reales por ayuda).

Notas de la curación (lo que conviene mirar con más atención):

- **Límites de renta aproximados.** El cuestionario pide ingresos anuales del hogar. Algunas
  ayudas usan otra magnitud (base imponible menos mínimos, renta del año anterior, ingresos
  personales…). Se ha elegido siempre la comparación menos excluyente y se explica en
  `otherRequirements`.
- **Requisitos no modelados** (patrimonio, PVPC, matrícula concreta, etc.) aparecen como «También
  se exige».
- `prestaciones-apoyo-familias-valladolid` sigue en **borrador**: no se encontraron las bases 2026
  (cuantías, plazo, requisitos) en fuentes oficiales.
- El IPREM 2026 (600 €/mes, 7.200 €/año en 12 pagas, 8.400 € en 14) está confirmado en la guía
  oficial de pensiones no contributivas 2026 del IMSERSO; el SMI 2026 procede del RD 126/2026.
  Cada enero hay que añadir `constants.<año>.ts`.

## Despliegue

- **Web**: Vercel con _Root Directory_ `apps/web`, _Install Command_ `pnpm install`, _Build
  Command_ `pnpm build` (genera el catálogo antes de compilar). Variables de entorno según la tabla.
- **BD**: Neon o Supabase. Ejecuta `pnpm --filter @tetoca/db db:migrate` y `db:seed`. En funciones
  serverless usa la URL del _pooler_ y `DATABASE_POOL_MAX=1`.
- **Jobs**: `.github/workflows/ingest.yml` (ingesta + extracción diarias) y `alerts.yml`
  (alertas). Se activan con las _variables_ de repositorio `INGESTION_ENABLED=true` y
  `ALERTS_ENABLED=true` y los _secrets_ correspondientes. Alternativa: el worker de pg-boss en un
  servidor siempre encendido.
- **CI**: `.github/workflows/ci.yml` (formato, lint, tipos, tests con cobertura, validación del
  catálogo, build y e2e).

## Decisiones tomadas en ausencia del propietario

- **Next.js 15** (no 16) por estabilidad del ecosistema; **Node 22**.
- **Componentes estilo shadcn/ui escritos a mano** (Button, Card, Badge) para no depender del CLI.
- **Catálogo evaluado en el cliente** para que las respuestas no salgan del navegador.
- **Ingresos como cifra aproximada** (mensual o anual), no en tramos: los tramos harían que muchos
  límites quedasen «sin saber». Se puede revisar (pregunta abierta del §13).
- **Preguntas fusionadas** (hijos + discapacidad de cada hijo; monoparental + numerosa) para
  mantener el cuestionario en ~12 pasos.
- **`hard` para requisitos de composición familiar y de rentas mínimas**: decirle a alguien que
  «casi» cumple porque no tiene hijos, o porque gana el triple del límite del IMV, no aporta nada.
- **PGlite** para tests de BD (sin Docker) y como Postgres local opcional.
- **Admin único** con credenciales en variables de entorno y cookie firmada (HMAC); sin
  dependencia de Supabase Auth.
- Enlaces de baja **derivados por HMAC** (siguen funcionando en emails antiguos) y endpoint de baja
  en un clic según RFC 8058.

## Pendiente / siguiente pasos sugeridos

- Revisión humana de las 30 fichas (ver arriba) y completar los datos del titular en
  `/aviso-legal` y `/privacidad` (marcados con `TODO(owner)`).
- Probar la extracción contra la API real con una muestra pequeña de documentos (coste bajo, pero
  requiere tu clave) y ajustar el prompt `extract-benefit@1` si hace falta.
- Nombre y dominio definitivos; configurar Resend (dominio verificado) y Plausible.
- Limitar la tasa de peticiones en `/admin/login` y `/alertas` (hoy: honeypot en el formulario de
  alertas y comparación de credenciales en tiempo constante).
- Segunda comunidad autónoma: añadirla en `packages/core/src/regions.ts` y su catálogo en
  `data/seed`.
- Fase 2 (B2B): `evaluate()` ya es una función pura independiente de Next.js y las tablas de
  configuración tienen `tenant_id` opcional.
