// ============================================================
// JusticiaFácil · Portada de la carpeta física
// ------------------------------------------------------------
// Genera el PDF tamaño carta que se imprime y se pega en el lomo de
// la carpeta de papel.
//
// QUÉ CAMBIÓ
// 1. El folio grande ahora es el CF (CF-JCMX-26-0042), no el viejo CARP-.
// 2. Se imprimen los tres identificadores del negocio: número de crédito,
//    garantía y folio del contrato. Si falta alguno, sale "PENDIENTE" en
//    rojo — para que se vea desde la carpeta cerrada qué está incompleto.
// 3. El QR ya NO abre la ficha genérica de documentos: abre el LIBRO de
//    esta carpeta en específico, y de paso pregunta qué vas a hacer con
//    ella (consultarla, llevártela, devolverla).
//
// jsPDF se carga desde CDN al momento (mismo patrón que predictamen-pdf.ts).
// El QR se genera con la librería `qrcode` (npm, ya instalada).
// ============================================================

import QRCode from "qrcode";
import type { CarpetaFisica } from "@/lib/carpetas-fisicas";

const NAVY: [number, number, number] = [4, 44, 83];   // #042C53
const ROJO: [number, number, number] = [163, 45, 45]; // #A32D2D — para lo que falta

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

/**
 * Arma la liga que va dentro del QR.
 *
 * Apunta a la ruta /libro con el folio CF. Se usa el FOLIO y no el id
 * interno de la base a propósito: si alguien teclea la liga a mano desde
 * el papel, el folio se lee y se escribe fácil; un uuid no.
 */
export function ligaDelLibro(folioCf: string): string {
  return `${window.location.origin}/libro?cf=${encodeURIComponent(folioCf)}`;
}

export interface DatosPortada {
  carpeta: CarpetaFisica;
  unidad: string;
  /** Nombre del responsable de la sucursal — quien tiene el resguardo del estante. */
  resguardo: string | null;
}

export async function descargarPortadaCarpeta(d: DatosPortada): Promise<void> {
  const folioCf = d.carpeta.folioCf || d.carpeta.folio;

  const mod: any = await import(/* @vite-ignore */ "https://esm.sh/jspdf@2.5.1");
  const jsPDF = mod.jsPDF || mod.default;
  const doc = new jsPDF({ unit: "mm", format: "letter" }); // carta: 215.9 x 279.4 mm
  const W = 215.9, H = 279.4, M = 24;

  const [logoBase64, qrBase64] = await Promise.all([
    urlABase64("/justiciafacil-logo.png"),
    QRCode.toDataURL(ligaDelLibro(folioCf), {
      margin: 1,
      width: 300,
      color: { dark: "#042C53", light: "#FFFFFF" },
    }),
  ]);

  // ---- Encabezado ----
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

  // ---- Folio grande ----
  y += 16;
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("CARPETA FÍSICA", M, y);
  y += 11;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold"); doc.setFontSize(26);
  doc.text(folioCf, M, y);
  y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text(`${d.carpeta.sucursal} · ${d.unidad}`, M, y);

  // ---- Tabla de datos ----
  // Los tres identificadores van primero porque son los que se usan para
  // buscar la carpeta en el estante sin abrir el sistema.
  y += 14;
  const PENDIENTE = "PENDIENTE";
  const filas: [string, string][] = [
    ["No. de crédito", d.carpeta.noCredito || PENDIENTE],
    ["No. de garantía", d.carpeta.garId || PENDIENTE],
    ["Folio de contrato", d.carpeta.folioContrato || PENDIENTE],
    ["Cliente", d.carpeta.clienteNombre || PENDIENTE],
    ["Dirección", d.carpeta.direccion || "—"],
    ["Resguardo", d.resguardo || "—"],
    ["Aperturada", d.carpeta.abiertaEn
      ? new Date(d.carpeta.abiertaEn).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
      : "—"],
  ];

  doc.setFontSize(10.5);
  for (const [label, valor] of filas) {
    doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
    y += 7;
    doc.setFont("helvetica", "normal"); doc.setTextColor(140, 140, 140);
    doc.text(label, M, y);

    // Lo que falta se imprime en rojo, para que se note de lejos.
    const falta = valor === PENDIENTE;
    doc.setFont("helvetica", "bold");
    if (falta) doc.setTextColor(...ROJO);
    else doc.setTextColor(30, 30, 30);

    const valorPartido = doc.splitTextToSize(valor, W - M - M - 55);
    doc.text(valorPartido, M + 45, y);
    y += (valorPartido.length - 1) * 5.5;
    y += 3;
  }
  doc.setDrawColor(225, 225, 225); doc.setLineWidth(0.2);
  doc.line(M, y, W - M, y);

  // ---- QR abajo ----
  const qrTam = 42;
  const qrX = (W - qrTam) / 2;
  const qrY = H - M - qrTam - 18;
  doc.setFillColor(...NAVY);
  doc.rect(qrX - 4, qrY - 4, qrTam + 8, qrTam + 8, "F");
  doc.addImage(qrBase64, "PNG", qrX, qrY, qrTam, qrTam);

  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
  doc.setTextColor(...NAVY);
  doc.text("Escanea para abrir el libro de esta carpeta", W / 2, qrY + qrTam + 12, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text("Al escanear se registra quién la consultó o se la llevó", W / 2, qrY + qrTam + 17, { align: "center" });

  doc.save(`Portada ${folioCf}.pdf`);
}
