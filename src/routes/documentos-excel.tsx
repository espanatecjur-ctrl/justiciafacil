import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Upload, Check, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { listarAsuntosConDocs, type AsuntoConDocs } from "@/lib/documentos-tabla";
import { sbSelect, type CasoJuridico } from "@/lib/supabase";
import { subirDocumento } from "@/lib/drive";
import { rolActual } from "@/lib/archivo-general";
import { permiteVerAsunto } from "@/lib/permisos-regional";

export const Route = createFileRoute("/documentos-excel")({
  head: () => ({ meta: [{ title: "Documentos por asunto — JusticiaFácil" }] }),
  component: DocumentosExcelPage,
});

const PAGE = 20;

function DocumentosExcelPage() {
  const navigate = useNavigate();
  const [asuntos, setAsuntos] = useState<AsuntoConDocs[]>([]);
  const [cargando, setCargando] = useState(true);
  const [rol, setRol] = useState<string | null>(null);
  const [filtroUnidad, setFiltroUnidad] = useState<"todas" | "UCM" | "UCP">("todas");
  const [pagina, setPagina] = useState(0);
  const [subiendoId, setSubiendoId] = useState<string | null>(null);
  const [subidoIds, setSubidoIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    rolActual().then(setRol);
    listarAsuntosConDocs().then(setAsuntos).finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() => {
    return asuntos.filter((a) => {
      if (!permiteVerAsunto(rol, a.ubicacion)) return false; // ABG_MZT: solo Mazatlán/Culiacán
      if (filtroUnidad !== "todas" && a.unidad !== filtroUnidad) return false;
      return true;
    });
  }, [asuntos, filtroUnidad, rol]);

  const totalPag = Math.max(1, Math.ceil(filtrados.length / PAGE));
  const pag = Math.min(pagina, totalPag - 1);
  const visibles = filtrados.slice(pag * PAGE, pag * PAGE + PAGE);

  async function subirRapido(a: AsuntoConDocs, file: File) {
    setSubiendoId(a.id);
    try {
      const c = await sbSelect<CasoJuridico>("caso_juridico", `select=*&id=eq.${a.id}`);
      const caso = c[0];
      if (!caso) { alert("No se encontró el expediente."); return; }
      const r = await subirDocumento(a.unidad, caso, file, "evidencia");
      if (!r.ok) { alert(r.error || "No se pudo subir."); return; }
      setSubidoIds((p) => new Set(p).add(a.id));
      setAsuntos((p) => p.map((x) => (x.id === a.id ? { ...x, numDigitales: x.numDigitales + 1 } : x)));
    } finally {
      setSubiendoId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Núcleo procesal"
        title="Documentos por asunto"
        description="Vista rápida tipo hoja de cálculo — todos los asuntos de UCM y UCP, con cuántos documentos tienen y subida rápida sin salir de aquí."
      />

      <Card className="legal-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Unidad:</span>
            {(["todas", "UCM", "UCP"] as const).map((u) => (
              <button
                key={u}
                onClick={() => { setFiltroUnidad(u); setPagina(0); }}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${filtroUnidad === u ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 text-[color:var(--teal)]" : "border-input text-muted-foreground"}`}
              >
                {u === "todas" ? "Todas" : u}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {filtrados.length === 0 ? "0 resultados" : `${pag * PAGE + 1}–${Math.min((pag + 1) * PAGE, filtrados.length)} de ${filtrados.length}`}
          </span>
        </div>
      </Card>

      <Card className="legal-card overflow-hidden p-0">
        {cargando ? (
          <p className="flex items-center gap-1.5 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Sin asuntos para mostrar.</p>
        ) : (
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="w-[32%] px-3 py-2 font-medium">Cliente</th>
                <th className="w-[10%] px-3 py-2 font-medium">Unidad</th>
                <th className="w-[20%] px-3 py-2 font-medium">Expediente</th>
                <th className="w-[18%] px-3 py-2 font-medium">Documentos</th>
                <th className="w-[20%] px-3 py-2 font-medium">Subir rápido</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td
                    className="cursor-pointer truncate px-3 py-2 font-medium text-[color:var(--teal)] hover:underline"
                    onClick={() => navigate({ to: "/documentos-asunto", search: { unidad: a.unidad, id: a.id } as any })}
                  >
                    {a.cliente || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{a.unidad}</td>
                  <td className="truncate px-3 py-2 text-xs text-muted-foreground">{a.expediente || a.folio || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{a.numDigitales} dig · {a.numFisicos} fís</td>
                  <td className="px-3 py-2">
                    {subidoIds.has(a.id) ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-700"><Check className="h-3.5 w-3.5" /> Subido</span>
                    ) : subiendoId === a.id ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo…</span>
                    ) : (
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
                        <Upload className="h-3 w-3" /> Subir
                        <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirRapido(a, f); }} />
                      </label>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {totalPag > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={pag === 0} className="rounded-md border border-input p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-xs text-muted-foreground">Página {pag + 1} de {totalPag}</span>
          <button onClick={() => setPagina((p) => Math.min(totalPag - 1, p + 1))} disabled={pag >= totalPag - 1} className="rounded-md border border-input p-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
