import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Cookies" };

export default function CookiesPage() {
  return (
    <LegalPage title="Política de cookies">
      <p>
        Esta web no usa cookies de publicidad ni de seguimiento. La analítica que usamos funciona
        sin cookies.
      </p>
      <p>
        Las respuestas del cuestionario se guardan en el almacenamiento de sesión de tu navegador
        (no es una cookie y no se envía al servidor) y se borran al cerrar la pestaña.
      </p>
      <p>
        El panel de administración usa una cookie técnica de sesión, solo para las personas que lo
        gestionan.
      </p>
    </LegalPage>
  );
}
