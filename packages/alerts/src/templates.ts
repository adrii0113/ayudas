import type { BenefitMatch } from "@tetoca/core";
import type { Email } from "./mailer";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(body: string, deleteUrl?: string): string {
  const footer = deleteUrl
    ? `<p style="color:#4b5563;font-size:13px">Recibes este email porque activaste las alertas de TeToca. <a href="${escape(deleteUrl)}">Darme de baja y borrar mis datos</a>.</p>`
    : "";
  return `<!doctype html><html lang="es"><body style="font-family:system-ui,sans-serif;color:#1c2430;max-width:560px;margin:auto;padding:16px">${body}<p style="color:#4b5563;font-size:13px">Información orientativa: consulta siempre las bases oficiales.</p>${footer}</body></html>`;
}

export function confirmationEmail(to: string, confirmUrl: string): Email {
  return {
    to,
    subject: "Confirma tus alertas de ayudas",
    text: `Hola:\n\nPara activar las alertas de ayudas de TeToca, confirma tu email en este enlace:\n${confirmUrl}\n\nSi no lo has pedido tú, ignora este mensaje: no guardaremos nada más.`,
    html: layout(
      `<h1 style="font-size:20px">Confirma tus alertas</h1><p>Para activar las alertas de ayudas, confirma tu email:</p><p><a href="${escape(confirmUrl)}" style="background:#08664b;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Confirmar mis alertas</a></p><p>Si no lo has pedido tú, ignora este mensaje.</p>`,
    ),
  };
}

export function alertEmail(
  to: string,
  matches: BenefitMatch[],
  urls: { site: string; deleteUrl: string; oneClickUrl: string },
): Email {
  const lines = matches.map((m) => {
    const tag =
      m.status === "eligible"
        ? "Te corresponde"
        : `Casi: falta ${m.failed.map((f) => f.label).join(", ")}`;
    return { m, tag, url: `${urls.site}/ayudas/${m.benefit.slug}` };
  });
  const subject =
    matches.length === 1
      ? `Nueva ayuda para ti: ${matches[0]!.benefit.title}`
      : `${matches.length} ayudas nuevas que encajan contigo`;
  return {
    to,
    subject,
    headers: {
      "List-Unsubscribe": `<${urls.oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    text: [
      "Hay ayudas nuevas que encajan con tu situación:",
      "",
      ...lines.map(
        ({ m, tag, url }) => `• ${m.benefit.title} (${tag})\n  ${m.benefit.amount.text}\n  ${url}`,
      ),
      "",
      "Información orientativa: consulta siempre las bases oficiales.",
      `Darte de baja y borrar tus datos: ${urls.deleteUrl}`,
    ].join("\n"),
    html: layout(
      `<h1 style="font-size:20px">Ayudas nuevas para ti</h1><ul style="padding-left:18px">${lines
        .map(
          ({ m, tag, url }) =>
            `<li style="margin-bottom:12px"><a href="${escape(url)}"><strong>${escape(m.benefit.title)}</strong></a><br>${escape(tag)}<br><span style="color:#4b5563">${escape(m.benefit.amount.text)}</span></li>`,
        )
        .join("")}</ul>`,
      urls.deleteUrl,
    ),
  };
}
