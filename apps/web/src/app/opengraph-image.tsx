import { ImageResponse } from "next/og";

/** Default social preview (1200×630) in the brand style: cream, red, bold type. */
export const alt = "Ayudario · Descubre qué ayudas públicas te corresponden";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#d02e2e",
        color: "#fffae7",
        padding: "72px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 2 }}>AYUDARIO</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 92, fontWeight: 900, lineHeight: 1, textTransform: "uppercase" }}>
          ¿Qué ayudas te tocan?
        </div>
        <div style={{ fontSize: 36, fontStyle: "italic" }}>
          Gratis, sin registro y en unos minutos · Toda España
        </div>
      </div>
    </div>,
    size,
  );
}
