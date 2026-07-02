import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { plantillas, renderContrato, type PlantillaCampo } from "@/lib/contract-templates";
import type { ContratoTipo } from "@/lib/legal-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileText, Eye, PenLine, RefreshCw, Save, Check } from "lucide-react";
import { z } from "zod";
import { SelectorApoderado } from "@/components/selector-apoderado";
import { EditorWord, textoPlanoAHtml } from "@/components/editor-word";
import { valoresApoderado, cargarApoderados, APODERADO_KEYS, type Apoderado } from "@/lib/apoderados";
import { guardarContrato, listarCartasCambio, type ContratoGenerado } from "@/lib/contrato-generado";

const searchSchema = z.object({ tipo: z.string().optional() });

export const Route = createFileRoute("/contratos/editor")({
  head: () => ({ meta: [{ title: "Editor de Contratos — SIGA-DIIPA" }] }),
  validateSearch: searchSchema,
  component: EditorContratos,
});

function CampoControl({
  campo,
  valor,
  onChange,
}: {
  campo: PlantillaCampo;
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
    default:
      return <Input value={(valor as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

function EditorContratos() {
  const { tipo: tipoQuery } = Route.useSearch();
  const [tipo, setTipo] = useState<ContratoTipo>((tipoQuery as ContratoTipo) || "prestacion_servicios");
  const plantilla = useMemo(() => plantillas.find((p) => p.tipo === tipo) ?? plantillas[0], [tipo]);
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [apoderadoId, setApoderadoId] = useState<string>("");
  // Apoderados desde Supabase (con la lista de prueba como respaldo inicial).
  const [apoderados, setApoderados] = useState<Apoderado[]>([]);
  useEffect(() => { cargarApoderados().then(setApoderados); }, []);

  // Cartas de Cambio registradas, para auto-llenar el Contrato (Parte C).
  const [cartas, setCartas] = useState<ContratoGenerado[]>([]);
  useEffect(() => {
    if (tipo === "contrato_cambio") listarCartasCambio().then(setCartas);
  }, [tipo]);

  // Copia los datos de una Carta registrada al Contrato (mismo mapeo que el Paquete).
  function autollenarDesdeCarta(v: Record<string, unknown>) {
    setValores((cur) => {
      const nuevo = { ...cur };
      Object.values(APODERADO_KEYS).forEach((k) => { if (v[k] != null) nuevo[k] = v[k]; });
      if (v.nombreCliente) nuevo.nombreCliente = v.nombreCliente;
      if (v.folioContratoAnterior) nuevo.folioContratoAnterior = v.folioContratoAnterior;
      if (v.valorOperacion) nuevo.valorOperacion = v.valorOperacion;
      if (v.garantiaCambio) nuevo.garantiaNueva = v.garantiaCambio;
      return nuevo;
    });
  }
  const [modo, setModo] = useState<"preview" | "word">("preview");
  // "Semilla" = el contrato ya llenado que se carga al editor Word.
  // Se congela al entrar (o al Regenerar) para no borrar los cambios manuales.
  const [semillaWord, setSemillaWord] = useState<string>("");
  const [claveWord, setClaveWord] = useState(0);

  // Al escoger un apoderado, se copian sus datos a `valores` (auto-llenado).
  // Al quitarlo, se borran esas mismas llaves.
  // Pasa los datos de la Carta de Cambio al Contrato de Cambio (Paquete de Cambio).
  // Conserva el apoderado y mapea los campos que comparten.
  function llenarContrato() {
    setValores((v) => {
      const nuevo: Record<string, unknown> = {};
      Object.values(APODERADO_KEYS).forEach((k) => { if (v[k] != null) nuevo[k] = v[k]; });
      if (v.nombreCliente) nuevo.nombreCliente = v.nombreCliente;
      if (v.folioContratoAnterior) nuevo.folioContratoAnterior = v.folioContratoAnterior;
      if (v.valorOperacion) nuevo.valorOperacion = v.valorOperacion;
      if (v.garantiaCambio) nuevo.garantiaNueva = v.garantiaCambio; // la garantía del cambio
      return nuevo;
    });
    setTipo("contrato_cambio");
    setModo("preview");
    setFolioGuardado(null);
  }

  function seleccionarApoderado(a: Apoderado | null) {
    setApoderadoId(a?.id ?? "");
    setValores((s) => {
      const limpio = { ...s };
      Object.values(APODERADO_KEYS).forEach((k) => delete limpio[k]);
      return a ? { ...limpio, ...valoresApoderado(a) } : limpio;
    });
  }

  const camposVisibles = plantilla.campos.filter((c) => {
    if (!c.dependeDe) return true;
    return valores[c.dependeDe.campo] === c.dependeDe.valor;
  });

  const cuerpo = renderContrato(plantilla, valores);

  // Guardar el documento con folio real (Parte A).
  const [guardando, setGuardando] = useState(false);
  const [folioGuardado, setFolioGuardado] = useState<string | null>(null);
  async function guardar() {
    setGuardando(true);
    setFolioGuardado(null);
    const apo = apoderados.find((a) => a.id === apoderadoId);
    const cuantiaNum = parseFloat(String(valores.valorOperacion ?? "").replace(/[^0-9.]/g, "")) || null;
    const folioDoc = String(valores.folioCarta ?? valores.numeroOficio ?? "").trim();
    const r = await guardarContrato({
      tipo,
      nombre_documento: plantilla.nombre,
      titulo: plantilla.nombre + (folioDoc ? ` — ${folioDoc}` : ""),
      nombre_cliente: String(valores.nombreCliente ?? ""),
      apoderado: apo?.nombre ?? "",
      valores: valores as Record<string, unknown>,
      cuerpo,
      cuantia: cuantiaNum,
      estado: "generado",
      fecha_generado: new Date().toISOString(),
    });
    setGuardando(false);
    if (r.ok) setFolioGuardado(r.folio ?? "");
    else window.alert("No se pudo guardar. ¿Corriste el SQL de contrato_generado en el proyecto correcto?");
  }

  // Entrar al editor: congela el contrato actual como punto de partida.
  function entrarWord() {
    setSemillaWord(textoPlanoAHtml(cuerpo));
    setClaveWord((k) => k + 1);
    setModo("word");
  }
  // Regenerar: vuelve a cargar desde los datos (descarta cambios manuales).
  function regenerarWord() {
    if (!window.confirm("Esto vuelve a armar el documento desde los datos y se perderán los cambios que hiciste a mano. ¿Continuar?")) return;
    setSemillaWord(textoPlanoAHtml(cuerpo));
    setClaveWord((k) => k + 1);
  }

  function exportarTxt() {
    const blob = new Blob([cuerpo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plantilla.nombre.replace(/\s+/g, "_")}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportarHtml() {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${plantilla.nombre}</title>
<style>body{font-family:'Libre Baskerville',Georgia,serif;max-width:780px;margin:40px auto;padding:0 40px;line-height:1.7;color:#1a1a1a}
h1{font-size:18px;text-align:center;text-transform:uppercase;letter-spacing:.08em}
pre{white-space:pre-wrap;font-family:inherit;font-size:14px}</style></head>
<body><h1>${plantilla.nombre}</h1><pre>${cuerpo.replace(/</g, "&lt;")}</pre></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plantilla.nombre.replace(/\s+/g, "_")}_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function imprimir() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${plantilla.nombre}</title>
<style>body{font-family:'Libre Baskerville',Georgia,serif;max-width:780px;margin:40px auto;padding:0 40px;line-height:1.7}
h1{font-size:16px;text-align:center;text-transform:uppercase;letter-spacing:.08em}
pre{white-space:pre-wrap;font-family:inherit;font-size:13px}</style></head>
<body><h1>${plantilla.nombre}</h1><pre>${cuerpo.replace(/</g, "&lt;")}</pre>
<script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documentos"
        title="Editor de Contratos"
        description="Selecciona una plantilla, llena los datos y exporta el documento listo para revisión o firma."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {folioGuardado && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                <Check className="h-3.5 w-3.5" /> Guardado · {folioGuardado}
              </span>
            )}
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
            setTipo(e.target.value as ContratoTipo);
            const a = apoderados.find((x) => x.id === apoderadoId);
            setValores(a ? { ...valoresApoderado(a) } : {});
          }}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {plantillas.map((p) => <option key={p.tipo} value={p.tipo}>{p.nombre}</option>)}
        </select>
        <p className="mt-2 text-xs text-muted-foreground">{plantilla.descripcion}</p>
      </Card>

      <SelectorApoderado
        apoderados={apoderados}
        value={apoderadoId}
        onSelect={seleccionarApoderado}
      />

      {tipo === "contrato_cambio" && (
        <div className="rounded-lg border border-[color:var(--gold,#C2A24C)]/40 bg-amber-50/60 px-4 py-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Auto-llenar desde una Carta de Cambio registrada
          </label>
          <select
            defaultValue=""
            onChange={(e) => {
              const c = cartas.find((x) => x.id === e.target.value);
              if (c?.valores) autollenarDesdeCarta(c.valores as Record<string, unknown>);
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">
              {cartas.length ? "— Escoge una carta registrada —" : "No hay cartas guardadas todavía"}
            </option>
            {cartas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.folio || "s/folio"} · {c.nombre_cliente || "sin cliente"}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-amber-800/80">
            Jala cliente, folio anterior, garantía y valor de la carta que escojas. Lo demás lo completas abajo.
          </p>
        </div>
      )}

      {tipo === "carta_cambio" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 px-4 py-3">
          <p className="text-sm text-foreground/80">
            <span className="font-semibold">Paquete de Cambio:</span> al terminar la Carta, pasa sus datos al Contrato de Cambio (cliente, folio anterior, garantía y valor).
          </p>
          <Button onClick={llenarContrato} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
            <FileText className="h-4 w-4 mr-1.5" /> Llenar Contrato de Cambio →
          </Button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Card className="legal-card">
          <CardContent className="p-5 max-h-[70vh] overflow-y-auto">
            <p className="font-display font-bold text-base mb-4">Datos del contrato</p>
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
                <div className="mt-10 grid grid-cols-2 gap-8 text-center text-xs text-muted-foreground">
                  <div><div className="border-t border-foreground/50 pt-1">Parte A</div></div>
                  <div><div className="border-t border-foreground/50 pt-1">Parte B</div></div>
                </div>
              </>
            ) : (
              <EditorWord key={claveWord} initialHtml={semillaWord} titulo={plantilla.nombre} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
