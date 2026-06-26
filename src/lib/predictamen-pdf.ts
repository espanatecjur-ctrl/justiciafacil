// ============================================================
// URRJ · Generador de PDF del pre-dictamen
// Carga jsPDF desde internet (CDN) al momento, no necesita
// instalar nada. Arma un documento profesional con el dictamen,
// riesgos, intereses, anotaciones y las dos firmas (con dibujo).
// ============================================================
import type { ResultadoMotor, Semaforo } from "@/lib/urrj-motores";
import type { DatosFirma } from "@/components/firma-parte";

const NAVY: [number, number, number] = [11, 30, 58];
const TEAL: [number, number, number] = [12, 92, 70];
const GOLD: [number, number, number] = [194, 162, 76];

function colorSem(s: Semaforo): [number, number, number] {
  switch (s) {
    case "verde": return [12, 92, 70];
    case "amarillo": return [194, 162, 76];
    case "naranja": return [217, 119, 6];
    case "rojo": return [220, 38, 38];
    default: return [156, 163, 175];
  }
}

export interface DatosPDF {
  expediente: string; juzgado: string; estado: string; tipoJuicio: string; posicion: string;
  ubicacion: string; deudor: string; quienCede: string; queCede: string;
  dictamen: string;
  riesgos: { nombre: string; r: ResultadoMotor }[];
  intereses: { ordinarios: number; moratorios: number; iva: number; total: number; udis?: number; usura: boolean };
  admin?: { valorComercial: number; costos: number; precioCesion: number; viab: ResultadoMotor } | null;
  anotaciones: string;
  firmaElabora: DatosFirma | null;
  firmaValida: DatosFirma | null;
  decision: string;
  noValido?: boolean;
  cambios?: { campos: { campo: string; antes: string; ahora: string }[]; nota?: string } | null;
}

const mxn = (v: number) => v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export async function descargarPredictamenPDF(d: DatosPDF) {
  const mod: any = await import(/* @vite-ignore */ "https://esm.sh/jspdf@2.5.1");
  const jsPDF = mod.jsPDF || mod.default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 16;
  let y = 0;

  const nuevaPaginaSiHace = (alto: number) => { if (y + alto > 282) { doc.addPage(); y = 18; } };

  // ---- Encabezado ----
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 26, "F");
  doc.setFillColor(...GOLD); doc.rect(0, 26, W, 1.4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("PRE-DICTAMEN URRJ", M, 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Unidad de Resolución Jurídica · JusticiaFácil DIIPA", M, 18);
  doc.setFontSize(8);
  doc.text(new Date().toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }), W - M, 18, { align: "right" });
  y = 34;

  // ---- Datos del caso ----
  doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Datos del caso", M, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40);
  const fila = (k: string, v: string) => {
    nuevaPaginaSiHace(6);
    doc.setFont("helvetica", "bold"); doc.text(k, M, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(v || "—", W - M - 50);
    doc.text(lines, M + 46, y);
    y += Math.max(5.5, lines.length * 5);
  };
  fila("Expediente:", d.expediente);
  fila("Juzgado:", d.juzgado);
  fila("Estado / tipo / posición:", `${d.estado} · ${d.tipoJuicio} · ${d.posicion}`);
  fila("Inmueble:", d.ubicacion);
  fila("Deudor:", d.deudor);
  fila("Cede / qué cede:", `${d.quienCede || "—"} · ${d.queCede}`);
  y += 3;

  // ---- Dictamen ----
  nuevaPaginaSiHace(16);
  const dc: [number, number, number] = d.dictamen === "POSITIVO" ? TEAL : d.dictamen === "NEGATIVO" ? [220, 38, 38] : [194, 162, 76];
  doc.setFillColor(...dc); doc.roundedRect(M, y, W - 2 * M, 11, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(`Pre-dictamen del sistema: ${d.dictamen}`, M + 4, y + 7);
  y += 16;

  // ---- Riesgos ----
  nuevaPaginaSiHace(10);
  doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Auditores legales (riesgos)", M, y); y += 6;
  doc.setFontSize(9);
  for (const { nombre, r } of d.riesgos) {
    nuevaPaginaSiHace(12);
    const c = colorSem(r.semaforo);
    doc.setFillColor(...c); doc.circle(M + 1.5, y - 1.4, 1.5, "F");
    doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold");
    doc.text(`${nombre}: ${r.etiqueta}${r.dato ? ` (${r.dato})` : ""}`, M + 5, y);
    y += 4.5;
    doc.setTextColor(70, 70, 70); doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(r.detalle, W - 2 * M - 5);
    doc.text(lines, M + 5, y); y += lines.length * 4.2 + 2;
  }
  y += 2;

  // ---- Intereses ----
  nuevaPaginaSiHace(28);
  doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Cálculo de intereses", M, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40);
  const linea = (k: string, v: string) => { nuevaPaginaSiHace(5); doc.text(`${k}  ${v}`, M, y); y += 5; };
  linea("Intereses ordinarios:", mxn(d.intereses.ordinarios));
  linea("Intereses moratorios:", mxn(d.intereses.moratorios));
  if (d.intereses.iva > 0) linea("IVA:", mxn(d.intereses.iva));
  doc.setFont("helvetica", "bold"); linea("Total de la deuda:", mxn(d.intereses.total) + (d.intereses.udis ? ` · ${Math.round(d.intereses.udis).toLocaleString("es-MX")} UDIs` : "")); doc.setFont("helvetica", "normal");
  if (d.intereses.usura) { doc.setTextColor(220, 38, 38); linea("Alerta:", "posible usura (tasa moratoria alta)"); doc.setTextColor(40, 40, 40); }
  y += 2;

  // ---- Administración (solo si viene) ----
  if (d.admin) {
    nuevaPaginaSiHace(24);
    doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("Administración · valuación y precio", M, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40);
    linea("Valor comercial:", mxn(d.admin.valorComercial));
    linea("Costos:", mxn(d.admin.costos));
    linea("Precio de la cesión:", mxn(d.admin.precioCesion));
    linea("Viabilidad:", `${d.admin.viab.etiqueta} (${d.admin.viab.dato || ""})`);
    y += 2;
  }

  // ---- Anotaciones ----
  if (d.anotaciones?.trim()) {
    nuevaPaginaSiHace(14);
    doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("Anotaciones del abogado", M, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(d.anotaciones, W - 2 * M);
    nuevaPaginaSiHace(lines.length * 4.5);
    doc.text(lines, M, y); y += lines.length * 4.5 + 4;
  }

  // ---- Decisión ----
  nuevaPaginaSiHace(10);
  doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(`Decisión humana: ${d.decision || "—"}`, M, y); y += 8;

  // ---- Firmas ----
  nuevaPaginaSiHace(40);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...NAVY);
  doc.text("Firmas", M, y); y += 4;
  const colW = (W - 2 * M) / 2;
  const firmaBox = (f: DatosFirma | null, titulo: string, x: number) => {
    let yy = y + 2;
    doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.3);
    doc.roundedRect(x, yy, colW - 4, 34, 1.5, 1.5, "S");
    yy += 5;
    doc.setFontSize(8); doc.setTextColor(120, 120, 120); doc.setFont("helvetica", "normal");
    doc.text(titulo, x + 3, yy); yy += 4;
    if (f?.dibujo) { try { doc.addImage(f.dibujo, "PNG", x + 3, yy, 40, 14); } catch {} yy += 16; }
    else { doc.setDrawColor(180, 180, 180); doc.line(x + 3, yy + 12, x + colW - 8, yy + 12); yy += 16; }
    doc.setTextColor(...TEAL); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
    doc.text(f?.nombre || "_______________", x + 3, yy); yy += 4;
    doc.setTextColor(90, 90, 90); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    if (f?.cargo) { doc.text(f.cargo, x + 3, yy); yy += 3.5; }
    if (f?.fecha) doc.text("Firmado: " + new Date(f.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" }), x + 3, yy);
  };
  firmaBox(d.firmaElabora, "Elabora · abogado URRJ", M);
  firmaBox(d.firmaValida, "Valida · Director Legal", M + colW);
  y += 40;

  // ---- Hoja de cambios (solo si es una versión nueva) ----
  if (d.cambios && (d.cambios.campos.length || d.cambios.nota)) {
    doc.addPage(); y = 18;
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 24, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("Hoja de cambios de esta versión", M, 15);
    y = 34;
    doc.setTextColor(90, 90, 90); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("Comparación automática contra la versión anterior (antecedente).", M, y); y += 8;

    if (d.cambios.campos.length) {
      doc.setTextColor(...TEAL); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text("Campos que cambiaron:", M, y); y += 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
      for (const c of d.cambios.campos) {
        nuevaPaginaSiHace(10);
        doc.setFont("helvetica", "bold"); doc.text(`• ${c.campo}:`, M, y);
        doc.setFont("helvetica", "normal");
        const antes = (c.antes || "(vacío)").toString().slice(0, 60);
        const ahora = (c.ahora || "(vacío)").toString().slice(0, 60);
        doc.setTextColor(180, 60, 60); doc.text(antes, M + 50, y);
        doc.setTextColor(120, 120, 120); doc.text("→", M + 110, y);
        doc.setTextColor(20, 120, 70); doc.text(ahora, M + 118, y);
        doc.setTextColor(40, 40, 40); y += 6;
      }
      y += 4;
    } else {
      doc.text("No se detectaron cambios automáticos en los campos.", M, y); y += 8;
    }

    if (d.cambios.nota) {
      nuevaPaginaSiHace(20);
      doc.setTextColor(...TEAL); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text("Nota del abogado:", M, y); y += 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(40, 40, 40);
      const lineas = doc.splitTextToSize(d.cambios.nota, W - 2 * M);
      doc.text(lineas, M, y);
    }
  }

  // ---- Marca de agua si es antecedente (no válido) ----
  if (d.noValido) {
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setTextColor(235, 170, 170); doc.setFont("helvetica", "bold"); doc.setFontSize(34);
      doc.text("PRE-DICTAMEN NO VÁLIDO", 105, 150, { align: "center", angle: 35 } as any);
      doc.setFontSize(15);
      doc.text("existe una versión nueva", 105, 165, { align: "center", angle: 35 } as any);
    }
  }

  // ---- Pie ----
  doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
  doc.text("Documento generado por JusticiaFácil DIIPA · el sistema calcula y avisa; las personas firman y deciden.", M, 290);

  const nombre = `predictamen-${(d.expediente || "caso").replace(/[^\w-]/g, "_")}.pdf`;
  doc.save(nombre);
}
