import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Aviso legal" };

// TODO(owner): complete the owner's identification data (LSSI art. 10) before launch.
export default function LegalNoticePage() {
  return (
    <LegalPage title="Aviso legal">
      <h2>Titular</h2>
      <p>
        Este sitio web es un proyecto personal. Los datos identificativos del titular (nombre, NIF y
        contacto) se publicarán aquí antes del lanzamiento público.
      </p>
      <h2>Naturaleza de la información</h2>
      <p>
        TeToca no es una web oficial ni pertenece a ninguna Administración pública. No tramita
        solicitudes ni concede ayudas. La información se elabora a partir de las bases y páginas
        oficiales que se citan en cada ficha, y es <strong>orientativa</strong>: no sustituye a las
        bases oficiales ni garantiza la concesión de ninguna ayuda.
      </p>
      <p>
        Los requisitos se comprueban con un motor de reglas a partir de tus respuestas. Si alguna
        respuesta es aproximada, el resultado también lo será. Consulta siempre la fuente oficial
        antes de solicitar una ayuda.
      </p>
      <h2>Errores y actualizaciones</h2>
      <p>
        Las ayudas cambian a menudo. Cada ficha indica la fecha de su última revisión. Si detectas
        un error, te agradecemos que nos lo comuniques.
      </p>
    </LegalPage>
  );
}
