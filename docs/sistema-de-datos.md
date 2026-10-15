# Sistema de datos de ayudas públicas (diseño v1)

> Estado: **propuesta, pendiente de aprobación**. No hay nada implementado de lo que describe
> este documento salvo lo marcado como «ya existe».
> Fecha: 15 de octubre de 2026.

## 0. Objetivo

Construir el registro más **completo, preciso, trazable y actualizado** de ayudas públicas para
personas y hogares en España, y que ese registro sea el producto: lo usa la web (B2C), y se
vende como API, widget o dataset (B2B).

«Muy bien hecho» significa cuatro propiedades medibles:

| Propiedad        | Qué significa                                        | Cómo se mide                                                                                          |
| ---------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Cobertura**    | Están todas las ayudas relevantes de cada territorio | % de candidatas detectadas que han sido clasificadas (publicadas o descartadas con motivo)            |
| **Precisión**    | Lo publicado coincide con las bases oficiales        | Tasa de error en auditorías ciegas por muestreo + errores reportados por cada 100 fichas              |
| **Frescura**     | Lo nuevo entra rápido y lo viejo caduca solo         | Días entre publicación oficial y publicación nuestra; % de fichas verificadas en los últimos 12 meses |
| **Trazabilidad** | Cada dato apunta a la frase oficial de la que sale   | % de requisitos con evidencia localizada (documento + posición + cita verificada)                     |

## 1. Lo que hemos medido (BDNS, 15/10/2025–14/10/2026)

Convocatorias con beneficiario «personas físicas», consultadas en la API oficial de la BDNS:

| Administración                                 | Convocatorias/año |
| ---------------------------------------------- | ----------------- |
| Estatal                                        | 304               |
| Autonómica                                     | 1.658             |
| Local (ayuntamientos, diputaciones, cabildos…) | 10.784            |
| Otros organismos                               | 1.879             |
| **Total**                                      | **14.625**        |

Una muestra de 75 títulos enseña tres cosas que condicionan todo el diseño:

1. **Hay mucho ruido.** Premios y concursos (pintura, fotografía, «mejor casa decorada»), ayudas a
   deportistas destacados, subvenciones a asociaciones, cooperación internacional, ayudas internas
   para empleados públicos. A ojo, **solo un 30–50 % son ayudas para hogares**. Hace falta un
   filtro (triaje) antes de gastar tiempo de revisión.
2. **El volumen está en lo municipal**: el 74 % son locales.
3. **Lo municipal se repite muchísimo.** Ayudas a la natalidad, transporte escolar, libros,
   alquiler o comedor tienen casi la misma forma en cientos de ayuntamientos. Si se modelan como
   **familias con plantilla**, revisar cada una cuesta minutos, no horas.

Y una cosa que la BDNS **no** cubre: las **prestaciones permanentes** (IMV, prestación por
nacimiento, CAPI, bono social, deducciones del IRPF estatales y autonómicas…). No son
convocatorias. Son pocas, pero son las más valiosas para el usuario, y hay que curarlas a mano
desde su norma.

## 2. Principios del sistema

Los seis principios del proyecto siguen intactos (el LLM nunca decide la elegibilidad, revisión
humana antes de publicar, trazabilidad, resultado orientativo, privacidad, versionado). Para
escalar a todo el país se añaden:

1. **Identidad estable.** Una ayuda («Bono Nacimiento de Castilla y León») vive años. Cada año
   es una _edición_, y cada corrección es una _revisión_ inmutable. Nunca se mezclan.
2. **Vocabulario cerrado.** Las reglas solo pueden usar conceptos de perfil definidos en un
   registro (con unidad y definición exacta). Si una ayuda necesita un concepto nuevo, se da de
   alta a propósito; el LLM no se lo puede inventar.
3. **Parámetros, no números sueltos.** IPREM, SMI, base del IMV… viven en un registro con fecha
   de vigencia y fuente. Las reglas los referencian. Cuando cambia el IPREM, el sistema sabe qué
   ayudas hay que revisar.
4. **Evidencia localizada.** Cada requisito apunta a un documento guardado, con la posición exacta
   de la cita, y la cita se comprueba automáticamente contra el texto.
5. **Revisar diferencias, no fichas enteras.** Una renovación anual se revisa como cambio
   respecto al año anterior.
6. **Prioridad por impacto.** Se revisa antes lo que más gente puede cobrar y lo que antes cierra.
7. **La calidad se mide y se publica.** Cada ficha lleva su fecha de verificación y su nivel de
   revisión, visibles para usuarios y clientes.

## 3. Modelo de datos

```
Territorio ─┐
Organismo ──┼── Programa ──< Edición ──< Revisión ──< Requisito ──> Evidencia ──> Documento fuente
Familia ────┘       │                        │
                    └── Relaciones           └── usa ──> Parámetro (IPREM 2026…)
                        (incompatible,                 └> Concepto de perfil (vocabulario)
                         sustituye a…)
```

### 3.1 Territorio

Códigos oficiales del INE: comunidad (2 dígitos), provincia (2) y municipio (5). Se carga entero
desde el INE (unos 8.100 municipios) y se mapea a los identificadores de región de la BDNS.
Marca `foral` para País Vasco y Navarra (IRPF propio). Sustituye a `packages/core/src/regions.ts`.

### 3.2 Organismo

Quién convoca y gestiona. Se identifica con el código **DIR3** (Directorio Común de unidades de
las administraciones) cuando exista. `TODO(verify)`: cómo descargar DIR3 como dato abierto.
Sirve para deduplicar, para enlazar ediciones de un mismo programa y para filtrar en la API.

### 3.3 Programa (la ayuda como tal, estable)

| Campo                     | Notas                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `slug`              | Estables para siempre (URLs SEO y API)                                                                                                                      |
| `title`, `summary`        | Lenguaje llano                                                                                                                                              |
| `type`                    | `social_security_benefit` · `tax_deduction` · `grant_call` · `social_tariff` (bono social…) · `service_or_exemption`                                        |
| `category`, `subcategory` | Taxonomía de 2 niveles (ver 3.10)                                                                                                                           |
| `scope`                   | Territorio donde aplica + nivel administrativo                                                                                                              |
| `organismId`              |                                                                                                                                                             |
| `familyId`                | Si sigue una plantilla (ver 3.9)                                                                                                                            |
| `recurrence`              | `permanent` · `annual` · `one_off` · `irregular`, y mes habitual de apertura. Permite avisar de que «suele abrir en marzo» y detectar una edición que falta |
| `lifecycle`               | `active` · `discontinued` (con fecha y motivo)                                                                                                              |
| `quality`                 | Nivel de revisión, `lastVerifiedAt`, `nextReviewDue`, incidencias abiertas                                                                                  |

### 3.4 Edición (cada convocatoria o ejercicio)

`programId`, `period` (p. ej. 2026 o curso 2026/27), códigos BDNS, referencia del boletín
(BOE/BOCYL…, fecha y número), plazo, estado (`announced`, `open`, `closed`, `resolved`), importe,
presupuesto total (lo da la BDNS) y documentos asociados (bases reguladoras, convocatoria,
extracto, corrección de errores).

Las prestaciones permanentes también tienen ediciones: una por ejercicio en el que cambian sus
importes o requisitos.

### 3.5 Revisión (instantánea inmutable y publicable)

Es lo que hoy es `benefits.version`. Contiene el contenido completo de la edición (requisitos,
documentos, pasos, importes), más:

- `contentHash`, autor, revisor o revisores, `reviewLevel` (`single`, `double`, `diff_only`);
- nota de cambio legible («Sube el umbral de renta de 2 a 2,5 × IPREM»);
- `supersedes`. Nunca se edita una revisión publicada: se crea otra.

### 3.6 Requisito y evidencia

Cada regla del DSL (ya existe en `packages/core/src/rules`) gana:

- `evidenceIds[]`: una o varias citas que la justifican;
- `fidelity`: `exact` si el cuestionario captura exactamente lo que piden las bases, o
  `approximate` si no. Ejemplo: las bases piden «renta de la unidad familiar del ejercicio
  anterior» y nosotros preguntamos «ingresos aproximados del hogar». Un requisito aproximado no
  puede dar «te corresponde» en firme: como mucho «probablemente», con explicación;
- `parameterRefs`: p. ej. `iprem.annual14@2026`.

**Evidencia**: `documentId`, `locator` (página, desplazamiento inicial y final en el texto),
`quote` y `quoteVerified`. Esto último se comprueba automáticamente: la cita existe literalmente
en el documento. Hoy ya verificamos las citas del LLM (`packages/extraction`); el cambio es
guardarlas con su posición y ligarlas a cada regla.

### 3.7 Documento fuente (ya existe; se amplía)

`source_documents` ya guarda texto, hash, URL y fecha. Se añade:

- `docType`: `regulatory_bases`, `call`, `extract`, `correction`, `official_page`, `tax_manual`,
  `law`;
- un historial de capturas, para detectar cambios en una página oficial;
- estado del enlace (vivo, roto o redirigido).

### 3.8 Registro de parámetros

Hoy: `packages/core/src/config/constants.2026.ts`. Pasa a ser una tabla y un paquete versionado:

| key             | valor  | vigencia     | fuente                |
| --------------- | ------ | ------------ | --------------------- |
| `iprem.monthly` | 600    | 2026-01-01 → | Guía PNC IMSERSO 2026 |
| `smi.annual`    | 17.094 | 2026-01-01 → | RD 126/2026           |

Cada regla referencia parámetros por clave. Cuando entra un valor nuevo (p. ej. IPREM 2027),
una tarea marca para revisión todas las revisiones publicadas que lo usan.

### 3.9 Familias (plantillas de ayudas parecidas)

Una familia define el esqueleto común. Por ejemplo, «Ayuda municipal por nacimiento»:

- requisitos típicos: empadronamiento de X años, nacimiento en el año Y, renta máxima opcional
  y convivencia con el menor;
- documentos típicos y rangos de importe esperables, que sirven para detectar errores.

La extracción rellena los parámetros de la plantilla, y el revisor comprueba solo esos
parámetros y lo que se sale de ella. Es la palanca principal para cubrir lo municipal.

### 3.10 Vocabulario de perfil y taxonomía

- **Conceptos de perfil**: cada campo que puede usar una regla (`applicantAge`,
  `householdIncome.annualApprox`, `yearsRegisteredInMunicipality`…) tiene id, tipo, unidad,
  definición exacta y la pregunta que lo obtiene. Lleva versión, y el cuestionario adaptativo se
  genera a partir de él (eso ya funciona así).
- **Taxonomía**: las 7 categorías actuales pasan a tener 2 niveles (p. ej. `housing` →
  `rent`, `purchase`, `renovation`, `energy_efficiency`) y etiquetas de colectivo
  (`young`, `single_parent`, `large_family`, `disability`, `elderly`, `victims_gbv`…).

### 3.11 Relaciones entre programas

`incompatible_with`, `compatible_with`, `requires` (p. ej. ser beneficiario del IMV da acceso
a…), `replaces` (programa que sustituye a otro) y `complements`. El motor podrá decir «si pides
A no puedes pedir B».

### 3.12 Incidencias

Errores reportados por usuarios o clientes, enlaces rotos, cambios detectados en la fuente y
ediciones esperadas que no aparecen. Todo va a una única cola con prioridad.

## 4. Proceso: de la fuente a la ficha publicada

```
Descubrir → Triar → Enlazar → Extraer → Validar → Revisar → Publicar → Vigilar
                                                                   ↑         │
                                                                   └─────────┘
```

| Paso             | Qué hace                                                                                                                                                                                                                                                                           | Automático o humano                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **1. Descubrir** | Cada fuente tiene un conector con su frecuencia y sus condiciones de uso. Ver §5                                                                                                                                                                                                   | Automático                                                     |
| **2. Triar**     | ¿Es una ayuda para hogares? Primero reglas baratas (descarta «premio», «concurso», «asociaciones», «deportistas», cooperación internacional…) y después una clasificación con LLM que da motivo. Sale `in_scope`, `out_of_scope` (con motivo) o `uncertain`. Se audita una muestra | Automático + muestreo humano                                   |
| **3. Enlazar**   | ¿Es una edición nueva de un programa que ya tenemos (mismo organismo, título parecido, año siguiente, misma línea BDNS) o un programa nuevo? ¿Pertenece a una familia?                                                                                                             | Automático, se confirma en la revisión                         |
| **4. Extraer**   | LLM con salida estructurada (ya existe). Si hay edición anterior o familia, se extrae **contra la plantilla** y se genera un diff                                                                                                                                                  | Automático                                                     |
| **5. Validar**   | Esquema, citas verificadas, solo conceptos y parámetros registrados, territorio coherente, fechas posibles, importes dentro del rango de la familia y perfiles de prueba ejecutados                                                                                                | Automático; si algo falla, va a revisión con el fallo señalado |
| **6. Revisar**   | Cola ordenada por impacto (población potencial × importe × urgencia del plazo). Tres niveles: `diff_only` para renovaciones sin cambios de fondo, `single` y `double` para estatales y autonómicas grandes                                                                         | Humano                                                         |
| **7. Publicar**  | Revisión inmutable, evento en el feed de cambios y regeneración de páginas                                                                                                                                                                                                         | Automático                                                     |
| **8. Vigilar**   | Ver tabla siguiente                                                                                                                                                                                                                                                                | Automático y genera incidencias                                |

Lo que vigila el paso 8:

- plazos cerrados, que se archivan solos;
- enlaces rotos;
- cambios en la página oficial (por hash);
- parámetros nuevos;
- ediciones esperadas que no han salido;
- fichas que llevan más de 12 meses sin verificar.

## 5. Fuentes

| Fuente                                                    | Qué aporta                                                                                           | Frecuencia                  | Estado                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------- |
| **BDNS / SNPSAP (API)**                                   | Todas las convocatorias de subvenciones de todas las administraciones                                | Diaria                      | Conector ya existe (solo CyL). Ampliar a todo el país     |
| **BOE**                                                   | Normas estatales y extractos de convocatorias. Bases de prestaciones                                 | Diaria                      | `TODO(verify)`: API de datos abiertos del sumario         |
| **17 boletines autonómicos + Ceuta y Melilla**            | Bases completas, correcciones y ayudas que la BDNS detalla poco                                      | Diaria/semanal              | `TODO(verify)` caso por caso (RSS, datos abiertos o nada) |
| **Manual práctico de Renta (AEAT)**                       | Todas las deducciones autonómicas del IRPF de las CCAA de régimen común, en un único documento anual | Anual (primavera)           | Pendiente. Fuente muy rentable                            |
| **Haciendas forales** (Álava, Bizkaia, Gipuzkoa, Navarra) | IRPF propio                                                                                          | Anual                       | Pendiente, fase tardía                                    |
| **Seguridad Social, SEPE, IMSERSO, ministerios**          | Prestaciones permanentes                                                                             | Vigilancia de cambios + BOE | Manual (ya hay fichas)                                    |
| **Sedes municipales**                                     | Páginas de trámite y formularios                                                                     | Vigilancia de cambios       | Solo municipios priorizados                               |

En cada fuente se respetan robots.txt, las condiciones de uso y un límite de peticiones (ya lo
hace el cliente de la BDNS). `TODO(verify)`: el aviso legal de reutilización de la BDNS antes
de redistribuir datos derivados (§8).

## 6. Estrategia de cobertura

No se cubre todo a la vez. Se avanza por niveles de impacto. Cada nivel tiene un criterio
de «completo» que se puede comprobar:

| Nivel                                         | Qué incluye                                                                                                                                                          | Criterio de completo                                                                                              |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **N1 Estatal**                                | Prestaciones de la Seguridad Social y del SEPE, IMV, CAPI, bonos sociales, deducciones IRPF estatales, becas MEC, ayudas estatales de vivienda… Del orden de decenas | 100 % con revisión doble y verificación anual                                                                     |
| **N2 Autonómico (17 CCAA + Ceuta y Melilla)** | Deducciones IRPF autonómicas (desde el manual de la AEAT) y programas autonómicos principales por categoría                                                          | Todas las deducciones del manual del año + todas las convocatorias autonómicas `in_scope` de la BDNS clasificadas |
| **N3 Municipios grandes**                     | Capitales de provincia y municipios de más de 50.000 habitantes (unos 150; `TODO(verify)` con INE)                                                                   | Todas sus convocatorias `in_scope` clasificadas                                                                   |
| **N4 Resto de municipios**                    | Mediante familias y plantillas                                                                                                                                       | Por familia: natalidad, libros y transporte escolar, alquiler…                                                    |

Una decisión de producto pendiente (§10): qué hacer mientras tanto con lo detectado pero no
revisado de N4.

## 7. Calidad

### 7.1 Indicadores

Visibles en `/admin/calidad` y en la API:

- **Frescura**: mediana de días entre publicación oficial y publicación nuestra, por nivel.
  Objetivo inicial: N1–N2 ≤ 3 días hábiles.
- **Cobertura**: candidatas `in_scope` publicadas o descartadas con motivo ÷ total detectadas.
- **Precisión**: cada mes, otro revisor rehace a ciegas un 5 % de fichas publicadas al azar
  y se mide la tasa de discrepancia. A eso se suman los errores reportados por cada 100 fichas.
- **Caducidad**: % de fichas sin verificar en 12 meses.
- **Trazabilidad**: % de requisitos con evidencia verificada.

### 7.2 Señales de calidad en cada ficha

Se publican tres datos: «Verificada el 12/03/2026», el nivel de revisión y las citas con su
fuente. Esto es también un argumento de venta B2B.

### 7.3 Carga de trabajo (estimación a validar)

Supuesto: unas 14.600 candidatas al año, de las que entre el 30 % y el 50 % están en alcance,
es decir, entre 4.400 y 7.300 fichas al año.

- **Con una media de 10 min por ficha** (renovaciones y familias a ~5 min, fichas nuevas
  complejas a ~30 min): entre 730 y 1.200 horas al año, unas **0,4–0,7 personas a jornada
  completa**.
- **Sin familias ni revisión por diferencias:** el coste se multiplica.

Medirlo de verdad es el objetivo de la fase 2.

## 8. Distribución (el producto B2B)

- **API v1**: `GET /v1/programs`, `/v1/programs/{id}` (con ediciones, revisión vigente y
  evidencias), `POST /v1/evaluate` (la función pura `evaluate()` que ya existe) y
  `GET /v1/changes?since=` (feed de cambios). Lleva claves por cliente, ETag y paginación por
  cursor.
- **Webhooks**: avisos de edición nueva, cambio de revisión y apertura o cierre de plazo.
- **Instantáneas**: volcado diario versionado (JSON/Parquet) para clientes de datos.
- **Licencias**: separar los datos públicos de origen (con atribución y condiciones de
  reutilización `TODO(verify)`) de nuestro valor añadido, que es la estructuración, las reglas,
  las evidencias y la revisión. Hace falta un contrato que deje claro que la información es
  orientativa y que la fuente oficial va siempre adjunta.

## 9. Qué cambia respecto a lo que ya existe

| Hoy                                          | Pasa a                                                                                                                                                                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `benefits` (slug + version + contenido JSON) | `programs` + `editions` + `revisions`. Migración automática de las 30 fichas                                                                                                                                                                                  |
| `sources[].excerpt` dentro del JSON          | Tabla `evidence` con posición y verificación, enlazada a cada regla                                                                                                                                                                                           |
| `constants.2026.ts`                          | Registro de parámetros con vigencias. El fichero se genera a partir de él para los tests                                                                                                                                                                      |
| `regions.ts` (solo CyL)                      | Tabla de territorios del INE completa + mapeo BDNS                                                                                                                                                                                                            |
| YAML en `data/seed` como fuente de verdad    | **Propuesta**: la base de datos pasa a ser la fuente de verdad, con historial completo de revisiones, y se exporta a YAML/JSON en Git a diario (copia legible, auditable y con diffs). Las fichas de N1 podrían seguir editándose como código si lo prefieres |
| Ingesta BDNS de CyL                          | Ingesta BDNS de toda España + triaje + enlace a programas                                                                                                                                                                                                     |
| Panel de revisión por ficha                  | Cola priorizada, revisión por diferencias, doble revisión y panel de calidad                                                                                                                                                                                  |

Lo que **no** cambia: el motor de reglas, `evaluate()`, el DSL, la extracción con verificación
de citas, el cuestionario adaptativo y los principios de privacidad.

## 10. Decisiones que necesito del propietario

1. **Fuente de verdad**: ¿base de datos con exportación a Git (recomendado para escalar) o
   seguir con YAML para todo?
2. **Lo detectado pero no revisado** (sobre todo N4): ¿no mostrarlo (recomendado al principio)
   o mostrarlo como «convocatoria detectada, sin verificar», solo con enlace oficial y sin
   evaluar requisitos?
3. **Territorios forales**: ¿al final (recomendado) o a la vez que N2?
4. **Quién revisa** y cuántas horas a la semana. Esto marca el ritmo real de cobertura.
5. **Orden de las CCAA en N2**: ¿todas a la vez solo con deducciones IRPF y después por
   categorías (recomendado), o comunidad por comunidad?

## 11. Fases

| Fase                                 | Entregable                                                                                                                                                | Criterio de salida                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **F1. Modelo**                       | Programa/edición/revisión, evidencia localizada, registro de parámetros, territorios INE, vocabulario de perfil con fidelidad. Migración de las 30 fichas | Tests en verde; las 30 fichas migradas y con todas sus reglas enlazadas a evidencia; la web funciona igual |
| **F2. Radar nacional**               | BDNS de toda España, triaje y enlace a programas, panel de cobertura. **No se publica nada nuevo**                                                        | Números reales: volumen en alcance por territorio y categoría, precisión del triaje medida con muestra     |
| **F3. N1 estatal completo**          | Todas las prestaciones y ayudas estatales para hogares                                                                                                    | Lista cerrada revisada dos veces                                                                           |
| **F4. Deducciones IRPF autonómicas** | Desde el manual de la AEAT                                                                                                                                | Todas las del manual del ejercicio                                                                         |
| **F5. N2 programas autonómicos**     | Por categoría, con familias                                                                                                                               | Cobertura N2 ≥ 90 %                                                                                        |
| **F6. N3 + familias municipales**    | Municipios grandes y plantillas                                                                                                                           | Cobertura N3 ≥ 90 %                                                                                        |
| **F7. API y feed de cambios**        | Producto B2B                                                                                                                                              | Primer cliente piloto integrado                                                                            |

La web pública podrá ampliarse a otras comunidades a partir de F4. Añadir una región ya es solo
configuración.
