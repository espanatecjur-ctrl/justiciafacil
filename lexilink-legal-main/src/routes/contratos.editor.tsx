import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { plantillas, renderContrato, type PlantillaCampo } from "@/lib/contract-templates";
import type { ContratoTipo } from "@/lib/legal-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileText } from "lucide-react";
import { z } from "zod";

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

  const camposVisibles = plantilla.campos.filter((c) => {
    if (!c.dependeDe) return true;
    return valores[c.dependeDe.campo] === c.dependeDe.valor;
  });

  const cuerpo = renderContrato(plantilla, valores);

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
          <div className="flex gap-2">
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
          onChange={(e) => { setTipo(e.target.value as ContratoTipo); setValores({}); }}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {plantillas.map((p) => <option key={p.tipo} value={p.tipo}>{p.nombre}</option>)}
        </select>
        <p className="mt-2 text-xs text-muted-foreground">{plantilla.descripcion}</p>
      </Card>

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
          <CardContent className="p-8">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-1">Vista previa</p>
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-center mb-6">{plantilla.nombre}</h2>
            <pre className="whitespace-pre-wrap font-display text-[13px] leading-relaxed text-foreground">{cuerpo}</pre>
            <div className="mt-10 grid grid-cols-2 gap-8 text-center text-xs text-muted-foreground">
              <div><div className="border-t border-foreground/50 pt-1">Parte A</div></div>
              <div><div className="border-t border-foreground/50 pt-1">Parte B</div></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
