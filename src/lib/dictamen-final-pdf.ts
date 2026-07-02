// ============================================================
// UCP · PDF del Dictamen Final
// ------------------------------------------------------------
// Reúsa el mismo enfoque del PDF de URRJ (jsPDF por CDN) y el
// componente de firmas. Arma el documento de cierre: datos de la
// garantía, veredictos (jurídico, registral, final), los 10 hitos,
// la relación contable, el ANTECEDENTE (firmas del pre-dictamen)
// y las 6 firmas nuevas del dictamen final.
// ============================================================
import type { DatosFirma } from "@/components/firma-parte";

const NAVY: [number, number, number] = [11, 30, 58];
const TEAL: [number, number, number] = [12, 92, 70];
const GOLD: [number, number, number] = [194, 162, 76];

function colorSem(s?: string): [number, number, number] {
  switch (s) {
    case "verde": return [12, 92, 70];
    case "amarillo": return [194, 162, 76];
    case "naranja": return [217, 119, 6];
    case "rojo": return [220, 38, 38];
    default: return [156, 163, 175];
  }
}
function colorVer(v?: string): [number, number, number] {
  switch (v) {
    case "POSITIVO": return [12, 92, 70];
    case "CONDICIONADO": return [194, 162, 76];
    case "NEGATIVO": return [220, 38, 38];
    default: return [120, 120, 120];
  }
}
const mxn = (v?: number) => (v ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export interface FirmaConTitulo { titulo: string; firma: DatosFirma | null; }

export interface DictamenFinalPDF {
  expediente?: string;
  juzgado?: string;
  garantia?: string;
  cliente?: string;
  entidad?: string;
  veredictoJuridico?: string;
  veredictoRegistral?: string;
  veredictoFinal?: string;
  hitos?: { num: number; label: string; semaforo?: string; etiqueta?: string; nota?: string }[];
  contable?: { gastos?: number; cobros?: number; valorActual?: number; nota?: string; validada?: boolean } | null;
  antecedente?: { elabora?: DatosFirma | null; valida?: DatosFirma | null } | null;
  firmas?: FirmaConTitulo[];
}

export async function descargarDictamenFinalPDF(d: DictamenFinalPDF, modo: "descargar" | "ver" = "descargar") {
  const mod: any = await import(/* @vite-ignore */ "https://esm.sh/jspdf@2.5.1");
  const jsPDF = mod.jsPDF || mod.default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 16;
  let y = 0;

  const salto = (alto: number) => { if (y + alto > 282) { doc.addPage(); y = 18; } };

  // ---- encabezado ----
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 26, "F");
  doc.setFillColor(...GOLD); doc.rect(0, 26, W, 1.4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("DICTAMEN FINAL UCP", M, 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Unidad de Consolidación Patrimonial · JusticiaFácil DIIPA", M, 18);
  doc.setFontSize(8);
  doc.text(new Date().toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }), W - M, 18, { align: "right" });
  y = 34;

  // ---- datos de la garantía ----
  doc.setTextColor(60, 60, 60); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Garantía", M, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
  const fila = (k: string, v?: string) => { doc.setTextColor(120, 120, 120); doc.text(k, M, y); doc.setTextColor(40, 40, 40); doc.text(v || "—", M + 36, y); y += 5; };
  fila("Expediente:", d.expediente);
  fila("Juzgado:", d.juzgado);
  fila("Garantía:", d.garantia);
  fila("Cliente:", d.cliente);
  if (d.entidad) fila("Entidad:", d.entidad);
  y += 2;

  // ---- veredictos ----
  const chip = (label: string, ver?: string, x = M) => {
    const c = colorVer(ver);
    doc.setFillColor(c[0], c[1], c[2]); doc.roundedRect(x, y, 58, 12, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text(label, x + 3, y + 5); doc.setFontSize(10); doc.text(ver || "PENDIENTE", x + 3, y + 9.5);
  };
  salto(16);
  chip("Jurídico", d.veredictoJuridico, M);
  chip("Registral", d.veredictoRegistral, M + 62);
  chip("FINAL", d.veredictoFinal, M + 124);
  y += 18;

  // ---- hitos ----
  if (d.hitos && d.hitos.length) {
    salto(10);
    doc.setTextColor(60, 60, 60); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Los 10 hitos", M, y); y += 5;
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    for (const h of d.hitos) {
      salto(7);
      const c = colorSem(h.semaforo);
      doc.setFillColor(c[0], c[1], c[2]); doc.circle(M + 1.5, y - 1.5, 1.4, "F");
      doc.setTextColor(40, 40, 40);
      doc.text(`${h.num}. ${h.label}`, M + 5, y);
      doc.setTextColor(120, 120, 120);
      doc.text(h.etiqueta || "", M + 70, y);
      if (h.nota) { doc.text(doc.splitTextToSize(h.nota, 90), M + 110, y); }
      y += 5.5;
    }
    y += 2;
  }

  // ---- relación contable ----
  if (d.contable) {
    salto(24);
    doc.setTextColor(60, 60, 60); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Relación contable (GAD)", M, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    fila("Gastos:", mxn(d.contable.gastos));
    fila("Cobros:", mxn(d.contable.cobros));
    fila("Valor actual:", mxn(d.contable.valorActual));
    if (d.contable.nota) { doc.setTextColor(90, 90, 90); doc.text(doc.splitTextToSize(d.contable.nota, W - 2 * M), M, y); y += 6; }
    doc.setTextColor(d.contable.validada ? 12 : 180, d.contable.validada ? 92 : 60, 70);
    doc.text(d.contable.validada ? "Validada por GAD" : "Pendiente de validación", M, y); y += 6;
  }

  // ---- antecedente (firmas del pre-dictamen) ----
  salto(20);
  doc.setTextColor(60, 60, 60); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Antecedente · firmas del pre-dictamen URRJ", M, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
  const ant = (f: DatosFirma | null | undefined, t: string) => {
    const txt = f?.nombre ? `${t}: ${f.nombre}${f.cargo ? " (" + f.cargo + ")" : ""}${f.fecha ? " · " + new Date(f.fecha).toLocaleDateString("es-MX") : ""}` : `${t}: sin firma registrada`;
    doc.text(txt, M, y); y += 4.5;
  };
  ant(d.antecedente?.elabora, "Elabora");
  ant(d.antecedente?.valida, "Valida");
  y += 4;

  // ---- 6 firmas nuevas ----
  const firmas = d.firmas || [];
  const colW = (W - 2 * M) / 3;
  const firmaBox = (item: FirmaConTitulo, x: number, yy0: number) => {
    let yy = yy0 + 2;
    doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.3);
    doc.roundedRect(x, yy, colW - 4, 34, 1.5, 1.5, "S");
    yy += 5;
    doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); doc.setFont("helvetica", "normal");
    doc.text(item.titulo, x + 3, yy); yy += 4;
    const f = item.firma;
    if (f?.dibujo) { try { doc.addImage(f.dibujo, "PNG", x + 3, yy, 38, 13); } catch { /* */ } yy += 15; }
    else { doc.setDrawColor(180, 180, 180); doc.line(x + 3, yy + 11, x + colW - 8, yy + 11); yy += 15; }
    doc.setTextColor(...TEAL); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(f?.nombre || "_______________", x + 3, yy); yy += 4;
    doc.setTextColor(90, 90, 90); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    if (f?.cargo) { doc.text(f.cargo, x + 3, yy); yy += 3.2; }
    if (f?.fecha) doc.text("Firmado: " + new Date(f.fecha).toLocaleDateString("es-MX"), x + 3, yy);
  };

  doc.setTextColor(60, 60, 60); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  salto(10); doc.text("Firmas del dictamen final", M, y); y += 4;

  for (let i = 0; i < firmas.length; i += 3) {
    salto(40);
    const fila3 = firmas.slice(i, i + 3);
    fila3.forEach((it, j) => firmaBox(it, M + j * colW, y));
    y += 40;
  }

  // ---- pie ----
  doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
  doc.text("Documento generado por JusticiaFácil DIIPA · el sistema calcula y avisa; las personas firman y deciden.", M, 290);

  const nombre = `dictamen-final-${(d.expediente || "garantia").replace(/[^\w.-]+/g, "_")}.pdf`;
  if (modo === "ver") {
    // abre el PDF en una pestaña nueva (ojo de vista)
    const url = doc.output("bloburl");
    window.open(url as any, "_blank");
  } else {
    doc.save(nombre);
  }
}
