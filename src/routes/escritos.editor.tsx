import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import {
  escritos,
  renderEscrito,
  valoresInicialesEscrito,
  type EscritoCampo,
  type PlantillaEscrito,
} from "@/lib/escrito-templates";
import { listarPlantillasEscrito } from "@/lib/plantilla-escrito";
import { guardarEscrito, siguienteFolioEscrito } from "@/lib/escrito-generado";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileText, Eye, PenLine, RefreshCw, Save, Check } from "lucide-react";
import { z } from "zod";
import { EditorWord, textoPlanoAHtml } from "@/components/editor-word";

const searchSchema = z.object({ tipo: z.string().optional() });

export const Route = createFileRoute("/escritos/editor")({
  head: () => ({ meta: [{ title: "Editor de Escritos — SIGA-DIIPA" }] }),
  validateSearch: searchSchema,
  component: EditorEscritos,
});

// ── Control de cada campo (idéntico al de Contratos, con soporte de listas) ──
function CampoControl({
  campo,
  valor,
  onChange,
}: {
  campo: EscritoCampo;
  valor: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (campo.tipo) {
    case "textarea":
      return <Textarea value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />;
    case "select":
      return (
        <select
          value={(valor as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {campo.opciones?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox checked={!!valor} onCheckedChange={(v) => onChange(!!v)} id={campo.id} />
          <Label htmlFor={campo.id} className="text-sm font-normal">Sí</Label>
        </div>
      );
    case "number":
      return <Input type="number" value={(valor as number) ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")} />;
    case "date":
      return <Input type="date" value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "lista": {
      const filas = Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
      const sub = campo.subcampos ?? [];
      const setFilas = (nuevo: Record<string, unknown>[]) => onChange(nuevo);
      return (
        <div className="space-y-2">
          {filas.map((fila, i) => (
            <div key={i} className="rounded-md border border-border bg-muted/20 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground">#{i + 1}</span>
                <button
                  type="button"
                  onClick={() => setFilas(filas.filter((_, j) => j !== i))}
                  className="text-[11px] font-medium text-red-600 hover:underline"
                >
                  Quitar
                </button>
              </div>
              <div className="space-y-1.5">
                {sub.map((sc) => (
                  <div key={sc.id}>
                    <label className="text-[11px] text-muted-foreground">{sc.label}</label>
                    <CampoControl
                      campo={sc}
                      valor={fila[sc.id]}
                      onChange={(v) => {
                        const copia = filas.map((f) => ({ ...f }));
                        copia[i] = { ...copia[i], [sc.id]: v };
                        setFilas(copia);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFilas([...filas, {}])}
            className="rounded-md border border-dashed border-input px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-muted"
          >
            + Agregar {campo.label.toLowerCase()}
          </button>
        </div>
      );
    }
    default:
      return <Input value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

function EditorEscritos() {
  const { tipo: tipoQuery } = Route.useSearch();
  const [tipo, setTipo] = useState<string>(tipoQuery || "demanda_mercantil");

  // Plantillas propias (creadas desde la app) + las base.
  const [customList, setCustomList] = useState<PlantillaEscrito[]>([]);
  useEffect(() => { listarPlantillasEscrito().then(setCustomList); }, []);
  const todas = useMemo(() => [...escritos, ...customList], [customList]);
  const plantilla = useMemo(
    () => todas.find((p) => p.tipo === tipo) ?? todas[0] ?? escritos[0],
    [tipo, todas],
  );

  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [modo, setModo] = useState<"preview" | "word">("preview");
  const [semillaWord, setSemillaWord] = useState<string>("");
  const [claveWord, setClaveWord] = useState(0);

  // Campos visibles según dependencias.
  const camposVisibles = plantilla.campos.filter((c) => {
    if (!c.dependeDe) return true;
    return valores[c.dependeDe.campo] === c.dependeDe.valor;
  });

  // Siembra valores por defecto sin pisar lo ya escrito.
  useEffect(() => {
    const defs = valoresInicialesEscrito(plantilla);
    setValores((v) => {
      const merged = { ...v };
      for (const k in defs) if (merged[k] === undefined) merged[k] = defs[k];
      return merged;
    });
  }, [plantilla]);

  const cuerpo = renderEscrito(plantilla, valores);

  // ── Folio y guardado ───────────────────────────────────────────────
  const [guardando, setGuardando] = useState(false);
  const [folioGuardado, setFolioGuardado] = useState<string | null>(null);
  const [folioPreview, setFolioPreview] = useState<string>("");
  const [fechaGenerado, setFechaGenerado] = useState<string | null>(null);

  const [solicitadoPor, setSolicitadoPor] = useState("");
  const [aNombreDe, setANombreDe] = useState("");

  useEffect(() => {
    let vivo = true;
    siguienteFolioEscrito(tipo).then((f) => { if (vivo) setFolioPreview(f); });
    return () => { vivo = false; };
  }, [tipo, folioGuardado]);

  const fmtFechaHora = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : null;

  function nombrePromovente(): string {
    return String(valores.nombreActor ?? valores.nombreDemandado ?? valores.nombrePromovente ?? "");
  }

  async function obtenerFolio(): Promise<string | null> {
    if (folioGuardado) return folioGuardado;
    setGuardando(true);
    const expediente = String(valores.numeroExpediente ?? "").trim();
    const cuantiaNum = parseFloat(String(valores.cuantia ?? "").replace(/[^0-9.]/g, "")) || null;
    const ahoraIso = new Date().toISOString();
    const r = await guardarEscrito({
      tipo,
      nombre_documento: plantilla.nombre,
      titulo: plantilla.nombre + (expediente ? ` — Exp. ${expediente}` : ""),
      nombre_promovente: nombrePromovente(),
      posicion: String(valores.posicionProcesal ?? ""),
      apoderado: String(valores.nombreApoderado ?? ""),
      valores: { ...valores, solicitadoPor, aNombreDe } as Record<string, unknown>,
      cuerpo,
      cuantia: cuantiaNum,
      estado: "generado",
      fecha_generado: ahoraIso,
    });
    setGuardando(false);
    if (r.ok && r.folio) { setFolioGuardado(r.folio); setFechaGenerado(ahoraIso); return r.folio; }
    return null;
  }

  async function guardar() {
    const folio = await obtenerFolio();
    if (!folio) window.alert("No se pudo guardar. ¿Corriste el SQL de escrito_generado en el proyecto correcto?");
  }

  function encabezadoFolio(folio: string | null) {
    if (!folio) return "BORRADOR — escrito sin folio registrado";
    const elab = fmtFechaHora(fechaGenerado) ?? new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
    return `Folio: ${folio}    ·    Elaborado: ${elab}`;
  }

  // Reelaborar desde la tabla de Generados (Parte 3).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("reelaborar_escrito");
      if (raw) {
        const d = JSON.parse(raw);
        if (d.tipo) setTipo(d.tipo as string);
        if (d.valores) setValores(d.valores as Record<string, unknown>);
        setFolioGuardado(null);
        sessionStorage.removeItem("reelaborar_escrito");
      }
    } catch { /* nada */ }
  }, []);

  // ── Editor Word ────────────────────────────────────────────────────
  async function entrarWord() {
    await obtenerFolio();
    setSemillaWord(textoPlanoAHtml(cuerpo));
    setClaveWord((k) => k + 1);
    setModo("word");
  }
  function regenerarWord() {
    if (!window.confirm("Esto vuelve a armar el escrito desde los datos y se perderán los cambios que hiciste a mano. ¿Continuar?")) return;
    setSemillaWord(textoPlanoAHtml(cuerpo));
    setClaveWord((k) => k + 1);
  }

  // ── Exportar ───────────────────────────────────────────────────────
  async function exportarTxt() {
    const folio = await obtenerFolio();
    const texto = `${encabezadoFolio(folio)}\n\n${cuerpo}`;
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(folio ?? plantilla.nombre).replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportarHtml() {
    const folio = await obtenerFolio();
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${plantilla.nombre}</title>
<style>body{font-family:'Libre Baskerville',Georgia,serif;max-width:780px;margin:40px auto;padding:0 40px;line-height:1.7;color:#1a1a1a}
h1{font-size:18px;text-align:center;text-transform:uppercase;letter-spacing:.08em}
.folio{text-align:right;font-size:11px;color:#555;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:14px}
pre{white-space:pre-wrap;font-family:inherit;font-size:14px}</style></head>
<body><div class="folio">${encabezadoFolio(folio)}</div><h1>${plantilla.nombre}</h1><pre>${cuerpo.replace(/</g, "&lt;")}</pre></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(folio ?? plantilla.nombre).replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function imprimir() {
    const folio = await obtenerFolio();
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${plantilla.nombre}</title>
<style>body{font-family:'Libre Baskerville',Georgia,serif;max-width:780px;margin:40px auto;padding:0 40px;line-height:1.7}
h1{font-size:16px;text-align:center;text-transform:uppercase;letter-spacing:.08em}
.folio{text-align:right;font-size:10px;color:#555;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:12px}
pre{white-space:pre-wrap;font-family:inherit;font-size:13px}</style></head>
<body><div class="folio">${encabezadoFolio(folio)}</div><h1>${plantilla.nombre}</h1><pre>${cuerpo.replace(/</g, "&lt;")}</pre>
<script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documentos"
        title="Editor de Escritos"
        description="Selecciona una plantilla, llena los datos y exporta el escrito listo para presentar."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {folioGuardado ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                <Check className="h-3.5 w-3.5" /> Guardado · {folioGuardado}
              </span>
            ) : folioPreview ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900" title="Número tentativo; se fija al generar">
                Se asignará · {folioPreview}
              </span>
            ) : null}
            <Button onClick={guardar} disabled={guardando} className="bg-[#0B1E3A] hover:bg-[#0B1E3A]/90 text-white">
              <Save className="h-4 w-4 mr-1.5" /> {guardando ? "Guardando…" : "Guardar"}
            </Button>
            <Button variant="outline" onClick={exportarTxt}><Download className="h-4 w-4 mr-1.5" /> TXT</Button>
            <Button variant="outline" onClick={exportarHtml}><Download className="h-4 w-4 mr-1.5" /> HTML</Button>
            <Button onClick={imprimir} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
              <FileText className="h-4 w-4 mr-1.5" /> Imprimir / PDF
            </Button>
          </div>
        }
      />

      <Card className="legal-card p-4">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Plantilla</Label>
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value);
            setValores({});
            setFolioGuardado(null);
            setFechaGenerado(null);
            setModo("preview");
          }}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <optgroup label="Plantillas base">
            {escritos.map((p) => <option key={p.tipo} value={p.tipo}>{p.nombre}</option>)}
          </optgroup>
          {customList.length > 0 && (
            <optgroup label="Mis plantillas">
              {customList.map((p) => <option key={p.tipo} value={p.tipo}>{p.nombre}</option>)}
            </optgroup>
          )}
        </select>
        <p className="mt-2 text-xs text-muted-foreground">{plantilla.descripcion}</p>
      </Card>

      <Card className="legal-card p-4">
        <p className="font-display font-bold text-sm mb-3">
          Encabezado del escrito{" "}
          <span className="text-[11px] font-normal text-muted-foreground">(uso interno — no se imprime)</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs font-medium">Folio</Label>
            <div className="mt-1 flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 font-mono text-sm">
              {folioGuardado ? folioGuardado : folioPreview ? `Se asignará: ${folioPreview}` : "…"}
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium">Solicitado por</Label>
            <Input className="mt-1" value={solicitadoPor} onChange={(e) => setSolicitadoPor(e.target.value)} placeholder="Quién pide el escrito" />
          </div>
          <div>
            <Label className="text-xs font-medium">A nombre de / para quién</Label>
            <Input className="mt-1" value={aNombreDe} onChange={(e) => setANombreDe(e.target.value)} placeholder="Nombre (texto libre)" />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          <b>Elaborado</b> se registra solo al generar.
          {fechaGenerado && ` · Elaborado: ${fmtFechaHora(fechaGenerado)}`}
        </p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card className="legal-card">
          <CardContent className="p-5 max-h-[70vh] overflow-y-auto">
            <p className="font-display font-bold text-base mb-4">Datos del escrito</p>
            <div className="space-y-3">
              {camposVisibles.map((c) => (
                <div key={c.id}>
                  <Label className="text-xs font-medium">
                    {c.label}{c.requerido && <span className="text-[color:var(--legal)] ml-0.5">*</span>}
                  </Label>
                  <div className="mt-1">
                    <CampoControl campo={c} valor={valores[c.id]} onChange={(v) => setValores((s) => ({ ...s, [c.id]: v }))} />
                  </div>
                  {c.ayuda && <p className="mt-0.5 text-[11px] text-muted-foreground">{c.ayuda}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="legal-card bg-[oklch(0.99_0.005_85)]">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="inline-flex rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => setModo("preview")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${modo === "preview" ? "bg-[color:var(--teal)] text-white" : "bg-background text-foreground/70 hover:bg-muted"}`}
                >
                  <Eye className="h-3.5 w-3.5" /> Vista previa
                </button>
                <button
                  onClick={entrarWord}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${modo === "word" ? "bg-[color:var(--teal)] text-white" : "bg-background text-foreground/70 hover:bg-muted"}`}
                >
                  <PenLine className="h-3.5 w-3.5" /> Editar
                </button>
              </div>
              {modo === "word" && (
                <Button variant="outline" size="sm" onClick={regenerarWord} title="Volver a armar desde los datos">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerar
                </Button>
              )}
            </div>

            {modo === "preview" ? (
              <>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-1">Vista previa</p>
                <h2 className="font-display text-base font-bold uppercase tracking-wide text-center mb-6">{plantilla.nombre}</h2>
                <pre className="whitespace-pre-wrap font-display text-[13px] leading-relaxed text-foreground">{cuerpo}</pre>
                <div className="mt-10 text-center text-xs text-muted-foreground">
                  <div className="mx-auto w-64 border-t border-foreground/50 pt-1">Firma del promovente</div>
                </div>
              </>
            ) : (
              <EditorWord key={claveWord} initialHtml={semillaWord} titulo={plantilla.nombre} folio={folioGuardado} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
