// ============================================================
//  EditorWord · Edición libre del contrato, con formato
// ------------------------------------------------------------
//  Toma el contrato ya llenado y lo abre en una hoja editable
//  YA FORMATEADA (título centrado, encabezados y cláusulas en
//  negritas, texto justificado), tal como el documento original.
//
//  Barra: tipo y tamaño de letra, negritas, cursiva, subrayado,
//  color de letra, alinear, viñetas, numeración e insertar imagen.
//  Exporta a Word (.doc, editable, con el formato) e Imprimir / PDF.
//  Usa document.execCommand (lo trae el navegador) — sin librerías.
// ============================================================
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Download, Printer, ImagePlus,
} from "lucide-react";

const FUENTES = ["Georgia", "Times New Roman", "Arial", "Calibri", "Verdana", "Courier New"];
const COLORES = [
  { c: "#000000", n: "Negro" },
  { c: "#0B1E3A", n: "Azul marino" },
  { c: "#C2A24C", n: "Dorado" },
  { c: "#B91C1C", n: "Rojo" },
  { c: "#1D4ED8", n: "Azul" },
  { c: "#15803D", n: "Verde" },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function esEncabezado(linea: string) {
  const letras = linea.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  if (letras.length < 3 || linea.length > 90) return false;
  const mayus = linea.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length;
  return mayus / letras.length >= 0.85;
}

const RE_CLAUSULA = /^((?:PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|SÉPTIMA|OCTAVA|NOVENA|DÉCIMA|VIGÉSIMA|TRIGÉSIMA)(?:\s+(?:PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|SÉPTIMA|OCTAVA|NOVENA))?\.)\s/;
const RE_ROMANO = /^([IVXLC]{1,5}\.)\s/;

/** Convierte el machote (texto plano) a HTML CON FORMATO (título, negritas, justificado). */
export function textoPlanoAHtml(texto: string) {
  const lineas = texto.split("\n");
  let enTitulo = true; // bloque superior (título) hasta la primera línea vacía
  let primera = true;
  const out: string[] = [];
  for (const raw of lineas) {
    const linea = raw.replace(/\s+$/, "");
    if (linea.trim() === "") { out.push('<p style="margin:0"><br></p>'); enTitulo = false; continue; }
    const t = esc(linea);
    if (enTitulo) {
      const size = primera ? "font-size:15pt" : "font-size:12pt";
      out.push(`<p style="margin:0 0 4px;text-align:center;font-weight:bold;${size}">${t}</p>`);
      primera = false; continue;
    }
    if (/^_{5,}/.test(linea)) { out.push(`<p style="margin:18px 0 0">${t}</p>`); continue; }
    if (/^={5,}/.test(linea)) { out.push('<hr style="border:none;border-top:1px solid #999;margin:14px 0"/>'); continue; }
    if (linea.startsWith("•")) { out.push(`<p style="margin:2px 0;text-align:justify">${t}</p>`); continue; }
    if (esEncabezado(linea)) { out.push(`<p style="margin:12px 0 4px;font-weight:bold">${t}</p>`); continue; }
    const mc = linea.match(RE_CLAUSULA);
    if (mc) {
      out.push(`<p style="margin:8px 0 6px;text-align:justify"><b>${esc(mc[1])}</b>${esc(linea.slice(mc[1].length))}</p>`);
      continue;
    }
    const mr = linea.match(RE_ROMANO);
    if (mr) {
      out.push(`<p style="margin:6px 0 4px;text-align:justify"><b>${esc(mr[1])}</b>${esc(linea.slice(mr[1].length))}</p>`);
      continue;
    }
    out.push(`<p style="margin:0 0 6px;text-align:justify">${t}</p>`);
  }
  return out.join("");
}

function BtnHerramienta({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // no perder la selección
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted text-foreground/80"
    >
      {children}
    </button>
  );
}

/** Lo que el padre (Editor de Contratos) puede pedirle a este editor desde afuera. */
export interface EditorWordHandle {
  /** El HTML tal como está AHORA MISMO en pantalla (ediciones a mano, imágenes, todo). */
  obtenerHtml: () => string;
}

export const EditorWord = forwardRef<EditorWordHandle, { initialHtml: string; titulo: string; folio?: string | null }>(
  function EditorWord({ initialHtml, titulo, folio }, refExterno) {
  const ref = useRef<HTMLDivElement>(null);
  const folioLinea = folio ? `Folio: ${folio}` : "BORRADOR — documento sin folio registrado";
  const folioHtml = `<p style="text-align:right;font-size:9pt;color:#555;border-bottom:1px solid #ddd;padding-bottom:4px;margin:0 0 10px">${folioLinea}</p>`;
  const rangoRef = useRef<Range | null>(null);
  const inputImgRef = useRef<HTMLInputElement>(null);
  const [pie, setPie] = useState("");     // pie de página
  const [marca, setMarca] = useState(""); // marca de agua

  // El padre puede pedir el HTML actual cuando lo necesite (al descargar o
  // enviar), sin que este editor tenga que avisar en cada tecleo — así no se
  // re-renderiza toda la pantalla mientras escribes (eso era lo que hacía
  // que a veces "no dejara editar").
  useImperativeHandle(refExterno, () => ({
    obtenerHtml: () => ref.current?.innerHTML ?? "",
  }), []);

  const cmd = (comando: string, valor?: string) => {
    document.execCommand(comando, false, valor);
    ref.current?.focus();
  };

  // Guarda dónde está el cursor para poder insertar la imagen ahí.
  const guardarRango = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) {
      rangoRef.current = sel.getRangeAt(0).cloneRange();
    }
  };
  const restaurarRango = () => {
    const sel = window.getSelection();
    if (rangoRef.current && sel) { sel.removeAllRanges(); sel.addRange(rangoRef.current); }
  };

  const onImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      ref.current?.focus();
      restaurarRango();
      document.execCommand("insertImage", false, String(reader.result));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const estilosDoc =
    `body{font-family:'Georgia',serif;font-size:12pt;line-height:1.5;color:#000}` +
    `p{margin:0 0 6px}ul{padding-left:1.5cm}ol{padding-left:1.5cm}img{max-width:100%}`;

  // Marca de agua para Word (WordArt diagonal, se repite en todas las páginas).
  function vmlMarca(texto: string) {
    return (
      `<v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" ` +
      `path="m@7,l@8,m@5,21600l@11,21600e"><v:formulas><v:f eqn="sum #0 0 10800"/>` +
      `<v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/>` +
      `<v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @1"/>` +
      `<v:f eqn="if @0 0 @2"/><v:f eqn="if @0 @4 21600"/><v:f eqn="mid @5 @6"/>` +
      `<v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/><v:f eqn="mid @6 @7"/>` +
      `<v:f eqn="sum @6 0 @5"/></v:formulas><v:path textpathok="t" o:connecttype="custom"/>` +
      `<v:textpath on="t" fitshape="t"/></v:shapetype>` +
      `<v:shape id="marcaAgua" type="#_x0000_t136" ` +
      `style='position:absolute;margin-left:0;margin-top:0;width:468pt;height:117pt;rotation:315;z-index:-1;` +
      `mso-position-horizontal:center;mso-position-horizontal-relative:margin;` +
      `mso-position-vertical:center;mso-position-vertical-relative:margin' fillcolor="silver" stroked="f">` +
      `<v:fill opacity=".45"/><v:textpath style='font-family:"Calibri";font-size:1pt' string="${esc(texto)}"/></v:shape>`
    );
  }

  function exportarWord() {
    const contenido = ref.current?.innerHTML ?? "";
    const tienePie = pie.trim() !== "";
    const tieneMarca = marca.trim() !== "";
    const usaSeccion = tienePie || tieneMarca;

    const footerDiv = tienePie
      ? `<div style='mso-element:footer' id='f1'><p class=MsoFooter style='text-align:center;font-size:9pt;color:#555'>${esc(pie)}</p></div>`
      : "";
    const headerDiv = tieneMarca
      ? `<div style='mso-element:header' id='h1'><p class=MsoHeader><span style='mso-no-proof:yes'>${vmlMarca(marca)}</span></p></div>`
      : "";
    const pageRule = usaSeccion
      ? `@page Sec1{size:21.59cm 27.94cm;margin:2.5cm;${tienePie ? "mso-footer:f1;" : ""}${tieneMarca ? "mso-header:h1;" : ""}} div.Sec1{page:Sec1}`
      : `@page{size:21.59cm 27.94cm;margin:2.5cm}`;
    const cuerpoHtml = usaSeccion
      ? `<div class="Sec1">${folioHtml}${contenido}${headerDiv}${footerDiv}</div>`
      : `${folioHtml}${contenido}`;

    const html =
      `<html xmlns:v='urn:schemas-microsoft-com:vml' ` +
      `xmlns:o='urn:schemas-microsoft-com:office:office' ` +
      `xmlns:w='urn:schemas-microsoft-com:office:word' ` +
      `xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${titulo}</title>` +
      `<style>v\\:* {behavior:url(#default#VML)} o\\:* {behavior:url(#default#VML)} ${pageRule} ${estilosDoc}</style></head>` +
      `<body>${cuerpoHtml}</body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titulo.replace(/\s+/g, "_")}_${Date.now()}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function imprimir() {
    const contenido = ref.current?.innerHTML ?? "";
    const w = window.open("", "_blank");
    if (!w) return;
    const marcaCss = marca.trim()
      ? `.wm{position:fixed;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:72pt;font-weight:700;color:rgba(0,0,0,.08);z-index:-1;white-space:nowrap}`
      : "";
    const pieCss = pie.trim()
      ? `.pie{position:fixed;bottom:1cm;left:0;right:0;text-align:center;font-size:9pt;color:#555}`
      : "";
    const wmDiv = marca.trim() ? `<div class="wm">${esc(marca)}</div>` : "";
    const pieDiv = pie.trim() ? `<div class="pie">${esc(pie)}</div>` : "";
    // Barra "Volver" fija arriba: no sale en el PDF/impresión (@media print la
    // esconde), solo sirve en pantalla para cerrar esta pestaña y regresar
    // a donde se estaba editando.
    const barraVolverCss =
      `.barra-volver{position:sticky;top:0;z-index:99;display:flex;align-items:center;gap:8px;` +
      `background:#0B1E3A;color:#fff;padding:8px 14px;font-family:Arial,sans-serif;font-size:13px}` +
      `.barra-volver button{background:#fff;color:#0B1E3A;border:none;border-radius:6px;padding:6px 12px;` +
      `font-size:13px;font-weight:600;cursor:pointer}` +
      `@media print{.barra-volver{display:none}}`;
    const barraVolverHtml =
      `<div class="barra-volver"><button onclick="window.close()">← Volver a editar</button>` +
      `<span>Si el navegador no deja cerrar la pestaña, ciérrala a mano o regresa a la otra pestaña.</span></div>`;
    w.document.write(
      `<!doctype html><html><head><meta charset='utf-8'><title>${titulo}</title>` +
        `<style>@page{margin:2.5cm}${estilosDoc}body{max-width:800px;margin:0 auto}${marcaCss}${pieCss}${barraVolverCss}</style></head>` +
        `<body>${barraVolverHtml}${wmDiv}${folioHtml}${contenido}${pieDiv}<script>window.onload=()=>window.print()<\/script></body></html>`,
    );
    w.document.close();
  }

  return (
    <div>
      <style>{`.doc-editable ul{list-style:disc;padding-left:1.5rem}.doc-editable ol{list-style:decimal;padding-left:1.5rem}.doc-editable img{max-width:100%}.doc-editable:focus{outline:none}`}</style>

      {/* Barra de herramientas — se acomoda sola en teléfono, tablet o cualquier pantalla */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 border-b border-border pb-2 mb-3 sticky top-0 bg-background z-10">
        <select defaultValue="Georgia" onChange={(e) => cmd("fontName", e.target.value)}
          className="h-8 max-w-[7.5rem] shrink-0 rounded border border-input bg-background px-1 text-xs" title="Tipo de letra">
          {FUENTES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select defaultValue="3" onChange={(e) => cmd("fontSize", e.target.value)}
          className="h-8 shrink-0 rounded border border-input bg-background px-1 text-xs" title="Tamaño de letra">
          <option value="1">Muy pequeña</option>
          <option value="2">Pequeña</option>
          <option value="3">Normal</option>
          <option value="4">Mediana</option>
          <option value="5">Grande</option>
          <option value="6">Título</option>
          <option value="7">Muy grande</option>
        </select>

        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <BtnHerramienta onClick={() => cmd("bold")} title="Negritas"><Bold className="h-4 w-4" /></BtnHerramienta>
        <BtnHerramienta onClick={() => cmd("italic")} title="Cursiva"><Italic className="h-4 w-4" /></BtnHerramienta>
        <BtnHerramienta onClick={() => cmd("underline")} title="Subrayado"><UnderlineIcon className="h-4 w-4" /></BtnHerramienta>

        {/* Color de letra */}
        <span className="ml-1 flex items-center gap-0.5" title="Color de letra">
          {COLORES.map((col) => (
            <button key={col.c} type="button" title={col.n}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => cmd("foreColor", col.c)}
              className="h-5 w-5 rounded-full border border-black/20"
              style={{ backgroundColor: col.c }} />
          ))}
        </span>

        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <BtnHerramienta onClick={() => cmd("justifyLeft")} title="Alinear a la izquierda"><AlignLeft className="h-4 w-4" /></BtnHerramienta>
        <BtnHerramienta onClick={() => cmd("justifyCenter")} title="Centrar"><AlignCenter className="h-4 w-4" /></BtnHerramienta>
        <BtnHerramienta onClick={() => cmd("justifyRight")} title="Alinear a la derecha"><AlignRight className="h-4 w-4" /></BtnHerramienta>
        <BtnHerramienta onClick={() => cmd("justifyFull")} title="Justificar"><AlignJustify className="h-4 w-4" /></BtnHerramienta>

        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <BtnHerramienta onClick={() => cmd("insertUnorderedList")} title="Viñetas"><List className="h-4 w-4" /></BtnHerramienta>
        <BtnHerramienta onClick={() => cmd("insertOrderedList")} title="Lista numerada"><ListOrdered className="h-4 w-4" /></BtnHerramienta>
        <BtnHerramienta onClick={() => inputImgRef.current?.click()} title="Insertar imagen"><ImagePlus className="h-4 w-4" /></BtnHerramienta>
        <input ref={inputImgRef} type="file" accept="image/*" className="hidden" onChange={onImagen} />

        {/* Acciones: ocupan su propio renglón en teléfono; a la derecha en pantallas grandes */}
        <div className="flex w-full items-center gap-2 pt-1.5 sm:ml-auto sm:w-auto sm:pt-0">
          <Button variant="outline" size="sm" onClick={exportarWord} title="Descargar como Word editable"
            className="flex-1 sm:flex-none">
            <Download className="h-4 w-4 mr-1.5" /> Word
          </Button>
          <Button size="sm" onClick={imprimir}
            className="flex-1 bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white sm:flex-none">
            <Printer className="h-4 w-4 mr-1.5" /> Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* Pie de página y marca de agua */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={pie}
          onChange={(e) => setPie(e.target.value)}
          placeholder="Pie de página (opcional)"
          className="h-8 w-full rounded border border-input bg-background px-2 text-xs sm:w-auto sm:flex-1 sm:min-w-[180px]"
          title="Texto que aparece al pie de cada página"
        />
        <input
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          placeholder="Marca de agua (opcional)"
          className="h-8 w-full rounded border border-input bg-background px-2 text-xs sm:w-auto sm:flex-1 sm:min-w-[180px]"
          title="Texto en diagonal, tenue, detrás del documento"
        />
      </div>

      {/* Hoja editable (con marca de agua detrás y pie abajo) */}
      <p className={`mb-1 text-right text-[11px] ${folio ? "text-muted-foreground" : "text-amber-700"}`}>{folioLinea}</p>
      <div className="relative rounded-md border border-border bg-white shadow-inner overflow-hidden">
        {marca.trim() && (
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
            <span
              className="select-none whitespace-nowrap font-bold"
              style={{ transform: "rotate(-30deg)", fontSize: "64px", color: "rgba(0,0,0,0.06)" }}
            >
              {marca}
            </span>
          </div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onKeyUp={guardarRango}
          onMouseUp={guardarRango}
          onBlur={guardarRango}
          className="doc-editable relative z-10 min-h-[58vh] max-h-[66vh] overflow-y-auto bg-transparent px-4 py-5 text-[14px] text-black sm:px-8 sm:py-6"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{ __html: initialHtml }}
        />
        {pie.trim() && (
          <div className="relative z-10 border-t border-dashed border-border px-8 py-2 text-center text-[10px] text-muted-foreground">
            {pie}
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Escribe directamente sobre el documento. Selecciona texto y usa la barra para dar formato o color.
        Al final, descarga en Word (se sigue editando, con el formato) o imprime en PDF.
      </p>
    </div>
  );
});
