import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Política de privacidad" };

// TODO(owner): add the data controller's identity and contact before launch.
export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad">
      <h2>El cuestionario no guarda tus datos</h2>
      <p>
        Las respuestas del cuestionario se guardan solo en tu navegador (almacenamiento de sesión) y
        se borran al cerrar la pestaña. El cálculo de las ayudas se hace en tu propio dispositivo:
        tus respuestas no se envían a nuestros servidores.
      </p>
      <p>
        No pedimos nombre, DNI, dirección ni datos de salud identificables. Sobre discapacidad o
        dependencia solo preguntamos de forma genérica (sí/no o grado aproximado).
      </p>
      <h2>Alertas por email (opcional)</h2>
      <p>
        Solo si te suscribes a las alertas guardamos tu email y un perfil con tus respuestas,
        cifrados, con tu consentimiento expreso. La finalidad es avisarte cuando haya una ayuda
        nueva que encaje con tu perfil (máximo un email por semana). Base jurídica: tu
        consentimiento (art. 6.1.a RGPD).
      </p>
      <ul>
        <li>Confirmamos la suscripción con un email (doble verificación).</li>
        <li>
          Cada email incluye un enlace para darte de baja y borrar tus datos al momento y de forma
          definitiva.
        </li>
        <li>Los emails se envían a través de un proveedor de envío (Resend).</li>
        <li>
          Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y
          portabilidad, y reclamar ante la Agencia Española de Protección de Datos (aepd.es).
        </li>
      </ul>
      <h2>Estadísticas de uso</h2>
      <p>
        Usamos analítica sin cookies que no identifica a las personas. Solo contamos eventos
        agregados (por ejemplo, cuántas personas completan el cuestionario o hacen clic en un enlace
        oficial), nunca tus respuestas.
      </p>
    </LegalPage>
  );
}
