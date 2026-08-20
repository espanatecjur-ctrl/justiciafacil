// JusticiaFácil · Portada de carpeta física — genera un PDF tamaño carta con
// el logo, los datos de la carpeta y un código QR que abre directo la ficha
// de documentos del asunto en el sistema.
//
// jsPDF se carga desde CDN al momento (mismo patrón que predictamen-pdf.ts),
// y el QR se genera con la librería `qrcode` (npm, ya instalada).

import QRCode from "qrcode";
import type { CarpetaFisica } from "@/lib/carpetas-fisicas";

const NAVY: [number, number, number] = [4, 44, 83]; // #042C53
const AZUL_CLARO = [230, 241, 251]; // #E6F1FB

async function urlABase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface DatosPortada {
  carpeta: CarpetaFisica;
  unidad: string;
  folioSistema: string | null;
  resguardo: string | null; // nombre del responsable de la sucursal
  urlFicha: string; // a dónde apunta el QR
}

export async function descargarPortadaCarpeta(d: DatosPortada): Promise<void> {
  const mod: any = await import(/* @vite-ignore */ "https://esm.sh/jspdf@2.5.1");
  const jsPDF = mod.jsPDF || mod.default;
  const doc = new jsPDF({ unit: "mm", format: "letter" }); // carta: 215.9 x 279.4 mm
  const W = 215.9, H = 279.4, M = 24;

  const [logoBase64, qrBase64] = await Promise.all([
    urlABase64("/justiciafacil-logo.png"),
    QRCode.toDataURL(d.urlFicha, { margin: 1, width: 300, color: { dark: "#042C53", light: "#E6F1FB" } }),
  ]);

  // ---- Encabezado: logo + nombre ----
  let y = M;
  if (logoBase64) {
    try { doc.addImage(logoBase64, "PNG", M, y - 4, 12, 12); } catch {}
  }
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("JusticiaFácil", M + (logoBase64 ? 16 : 0), y + 1);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("DIIPA Desarrollos, S.A. de C.V.", M + (logoBase64 ? 16 : 0), y + 6);

  y += 14;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);

  // ---- Folio de la carpeta, grande ----
  y += 16;
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("CARPETA FÍSICA", M, y);
  y += 10;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold"); doc.setFontSize(24);
  doc.text(d.carpeta.folio, M, y);
  y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text(d.carpeta.sucursal, M, y);

  // ---- Tabla de datos ----
  y += 14;
  const filas: [string, string][] = [
    ["Cliente", d.carpeta.clienteNombre || "—"],
    ["Dirección", d.carpeta.direccion || "—"],
    ["Unidad", `${d.unidad}${d.folioSistema ? ` · Folio ${d.folioSistema}` : ""}`],
    ["Resguardo", d.resguardo || "—"],
    ["Creada", new Date(d.carpeta.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })],
  ];
  doc.setFontSize(10.5);
  for (const [label, valor] of filas) {
    doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
    y += 7;
    doc.setFont("helvetica", "normal"); doc.setTextColor(140, 140, 140);
    doc.text(label, M, y);
    doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30);
    const valorPartido = doc.splitTextToSize(valor, W - M - M - 55);
    doc.text(valorPartido, M + 45, y);
    y += (valorPartido.length - 1) * 5.5;
    y += 3;
  }

  // ---- QR centrado, abajo ----
  const qrTam = 42;
  const qrX = (W - qrTam) / 2;
  const qrY = H - M - qrTam - 14;
  doc.setFillColor(...NAVY);
  doc.rect(qrX - 4, qrY - 4, qrTam + 8, qrTam + 8, "F");
  doc.addImage(qrBase64, "PNG", qrX, qrY, qrTam, qrTam);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text("Escanea para entrar directo a esta ficha", W / 2, qrY + qrTam + 12, { align: "center" });

  doc.save(`Portada ${d.carpeta.folio}.pdf`);
}
