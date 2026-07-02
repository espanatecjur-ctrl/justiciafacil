// ============================================================
//  EditorWord · Edición libre del contrato, como en Word
// ------------------------------------------------------------
//  Toma el contrato ya llenado y lo abre en una hoja editable.
//  Barra de herramientas: tipo y tamaño de letra, negritas,
//  cursiva, subrayado, alinear, viñetas y numeración.
//  Exporta a Word (.doc, editable) e Imprimir / PDF.
//
//  Usa document.execCommand (lo trae el navegador) — no requiere
//  instalar librerías nuevas.
// ============================================================
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Download, Printer,
} from "lucide-react";

/** Convierte el texto plano del machote (con saltos de línea) a HTML editable. */
export function textoPlanoAHtml(texto: string) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return texto
    .split("\n")
    .map((l) => (l.trim() === "" ? "<div><br></div>" : `<div>${esc(l)}</div>`))
    .join("");
}

const FUENTES = ["Georgia", "Times New Roman", "Arial", "Calibri", "Verdana", "Courier New"];

function BtnHerramienta({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // no perder la selección de texto
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted text-foreground/80"
    >
      {children}
    </button>
  );
}

export function EditorWord({ initialHtml, titulo }: { initialHtml: string; titulo: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const cmd = (comando: string, valor?: string) => {
    document.execCommand(comando, false, valor);
    ref.current?.focus();
  };

  function exportarWord() {
    const contenido = ref.current?.innerHTML ?? "";
    const html =
      `<html xmlns:o='urn:schemas-microsoft-com:office:office' ` +
      `xmlns:w='urn:schemas-microsoft-com:office:word' ` +
      `xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'>` +
      `<title>${titulo}</title>` +
      `<style>@page{size:21.59cm 27.94cm;margin:2.5cm}` +
      `body{font-family:'Georgia',serif;font-size:12pt;line-height:1.5;color:#000}` +
      `ul{padding-left:1.5cm}ol{padding-left:1.5cm}</style></head><body>${contenido}</body></html>`;
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
    w.document.write(
      `<!doctype html><html><head><meta charset='utf-8'><title>${titulo}</title>` +
        `<style>@page{margin:2.5cm}body{font-family:Georgia,serif;font-size:12pt;line-height:1.6;max-width:800px;margin:0 auto}` +
        `ul{padding-left:1.5rem}ol{padding-left:1.5rem}</style></head><body>${contenido}` +
        `<script>window.onload=()=>window.print()<\/script></body></html>`,
    );
    w.document.close();
  }

  return (
    <div>
      <style>{`.doc-editable ul{list-style:disc;padding-left:1.5rem}.doc-editable ol{list-style:decimal;padding-left:1.5rem}.doc-editable:focus{outline:none}`}</style>

      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border pb-2 mb-3 sticky top-0 bg-background z-10">
        <select
          defaultValue="Georgia"
          onChange={(e) => cmd("fontName", e.target.value)}
          className="h-8 rounded border border-input bg-background px-1 text-xs"
          title="Tipo de letra"
        >
          {FUENTES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <select
          defaultValue="3"
          onChange={(e) => cmd("fontSize", e.target.value)}
          className="h-8 rounded border border-input bg-background px-1 text-xs"
          title="Tamaño de letra"
        >
          <option value="1">Muy pequeña</option>
          <option value="2">Pequeña</option>
          <option value="3">Normal</option>
          <option value="4">Mediana</option>
          <option value="5">Grande</option>
          <option value="6">Título</option>
          <option value="7">Muy grande</option>
        </select>

        <span className="mx-1 h-5 w-px bg-border" />

        <BtnHerramienta onClick={() => cmd("bold")} title="Negritas"><Bold className="h-4 w-4" /></BtnHerramienta>
        <BtnHerramienta onClick={() => cmd("italic")} title="Cursiva"><Italic className="h-4 w-4" /></BtnHerramienta>
        <BtnHerramienta onClick={() => cmd("underline")} title="Subrayado"><UnderlineIcon className="h-4 w-4" /></BtnHerramienta>

        <span className="mx-1 h-5 w-px bg-border" />

        <BtnHerramienta onClick={() => cmd("justifyLeft")} title="Alinear a la izquierda"><AlignLeft className="h-4 w-4" /></BtnHerramienta>
        <BtnHerramienta onClick={() => cmd("justifyCenter")} title="Centrar"><AlignCenter className="h-4 w-4" /></BtnHerramienta>
        <BtnHerramienta onClick={() => cmd("justifyRight")} title="Alinear a la derecha"><AlignRight className="h-4 w-4" /></BtnHerramienta>
        <BtnHerramienta onClick={() => cmd("justifyFull")} title="Justificar"><AlignJustify className="h-4 w-4" /></BtnHerramienta>

        <span className="mx-1 h-5 w-px bg-border" />

        <BtnHerramienta onClick={() => cmd("insertUnorderedList")} title="Viñetas"><List className="h-4 w-4" /></BtnHerramienta>
        <BtnHerramienta onClick={() => cmd("insertOrderedList")} title="Lista numerada"><ListOrdered className="h-4 w-4" /></BtnHerramienta>

        <span className="flex-1" />

        <Button variant="outline" size="sm" onClick={exportarWord} title="Descargar como Word editable">
          <Download className="h-4 w-4 mr-1.5" /> Word
        </Button>
        <Button
          size="sm"
          onClick={imprimir}
          className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white"
        >
          <Printer className="h-4 w-4 mr-1.5" /> Imprimir / PDF
        </Button>
      </div>

      {/* Hoja editable */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        className="doc-editable min-h-[62vh] max-h-[70vh] overflow-y-auto rounded-md border border-border bg-white px-8 py-6 text-[14px] text-black shadow-inner"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif", lineHeight: 1.7 }}
        dangerouslySetInnerHTML={{ __html: initialHtml }}
      />

      <p className="mt-2 text-[11px] text-muted-foreground">
        Escribe directamente sobre el documento. Selecciona texto y usa la barra para dar formato.
        Al final, descarga en Word (se sigue editando) o imprime en PDF.
      </p>
    </div>
  );
}
