import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Upload, Check, Loader2, ChevronLeft, ChevronRight, Search, LayoutGrid, Table2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listarAsuntosConDocs, type AsuntoConDocs } from "@/lib/documentos-tabla";
import { sbSelect, type CasoJuridico } from "@/lib/supabase";
import { subirDocumento } from "@/lib/drive";
import { rolActual } from "@/lib/archivo-general";
import { permiteVerAsunto } from "@/lib/permisos-regional";
import { estadosDisponibles, ciudadesDeEstado } from "@/lib/ciudad-judicial";
import { EstanteCarpetas } from "@/components/estante-carpetas";
import { cargarCarpetasUcmUcp, agruparPorEstado, agruparPorCategoria, type CarpetaConDistintivo } from "@/lib/estante-datos";

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
  const [q, setQ] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [filtroCiudad, setFiltroCiudad] = useState("todas");
  const ciudadesDelEstado = useMemo(() => (filtroEstado === "todas" ? [] : ciudadesDeEstado(filtroEstado)), [filtroEstado]);
  const [pagina, setPagina] = useState(0);
  const [subiendoId, setSubiendoId] = useState<string | null>(null);
  const [subidoIds, setSubidoIds] = useState<Set<string>>(new Set());

  // ===== Vista tipo estante =====
  const [vista, setVista] = useState<"tabla" | "estante">("tabla");
  const [tabEstante, setTabEstante] = useState<"estado" | "UCM" | "UCP" | "UDP" | "devoluciones" | "personal" | "institucional">("estado");
  const [carpetas, setCarpetas] = useState<CarpetaConDistintivo[]>([]);
  const [cargandoEstante, setCargandoEstante] = useState(false);

  useEffect(() => {
    if (vista !== "estante" || carpetas.length > 0) return;
    setCargandoEstante(true);
    cargarCarpetasUcmUcp().then(setCarpetas).finally(() => setCargandoEstante(false));
  }, [vista]);

  const carpetasVisibles = useMemo(() => carpetas.filter((c) => permiteVerAsunto(rol, c.ubicacion)), [carpetas, rol]);
  const grupoEstante = useMemo(() => {
    if (tabEstante === "estado") return agruparPorEstado(carpetasVisibles);
    if (tabEstante === "UCM") return agruparPorCategoria(carpetasVisibles, "UCM");
    if (tabEstante === "UCP") return agruparPorCategoria(carpetasVisibles, "UCP");
    return {};
  }, [carpetasVisibles, tabEstante]);

  const TABS_ESTANTE: { id: typeof tabEstante; label: string; listo: boolean }[] = [
    { id: "estado", label: "Por Estado", listo: true },
    { id: "UCM", label: "UCM", listo: true },
    { id: "UCP", label: "UCP", listo: true },
    { id: "UDP", label: "UDP", listo: false },
    { id: "devoluciones", label: "Devoluciones", listo: false },
    { id: "personal", label: "Personal", listo: false },
    { id: "institucional", label: "Documentos institucionales", listo: false },
  ];

  useEffect(() => {
    rolActual().then(setRol);
    listarAsuntosConDocs().then(setAsuntos).finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return asuntos.filter((a) => {
      if (!permiteVerAsunto(rol, a.ubicacion)) return false; // ABG_MZT: solo Mazatlán/Culiacán
      if (filtroUnidad !== "todas" && a.unidad !== filtroUnidad) return false;
      if (filtroEstado !== "todas") {
        if (!a.ubicacion || a.ubicacion.estado !== filtroEstado) return false;
        if (filtroCiudad !== "todas" && a.ubicacion.ciudad !== filtroCiudad) return false;
      }
      if (!t) return true;
      const blob = `${a.cliente || ""} ${a.expediente || ""} ${a.folio || ""} ${a.gar_id || ""} ${a.no_credito || ""} ${a.direccion || ""}`.toLowerCase();
      return blob.includes(t);
    });
  }, [asuntos, filtroUnidad, rol, q, filtroEstado, filtroCiudad]);

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
        actions={
          <div className="flex gap-1 rounded-md border border-input p-0.5">
            <button onClick={() => setVista("tabla")} className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium ${vista === "tabla" ? "bg-[color:var(--teal)] text-white" : "text-muted-foreground"}`}>
              <Table2 className="h-3.5 w-3.5" /> Tabla
            </button>
            <button onClick={() => setVista("estante")} className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium ${vista === "estante" ? "bg-[color:var(--teal)] text-white" : "text-muted-foreground"}`}>
              <LayoutGrid className="h-3.5 w-3.5" /> Estante de carpetas
            </button>
          </div>
        }
      />

      {vista === "estante" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {TABS_ESTANTE.map((t) => (
              <button
                key={t.id}
                onClick={() => setTabEstante(t.id)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${tabEstante === t.id ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 text-[color:var(--teal)]" : "border-input text-muted-foreground"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {TABS_ESTANTE.find((t) => t.id === tabEstante)?.listo ? (
            <EstanteCarpetas
              grupos={grupoEstante}
              cargando={cargandoEstante}
              onClickCarpeta={(item) =>
                navigate({ to: "/documentos-asunto", search: { unidad: item.unidad, id: item.asuntoId } as any })
              }
            />
          ) : (
            <Card className="legal-card p-8 text-center text-sm text-muted-foreground">
              Esta pestaña todavía no está conectada — la construimos en la siguiente parte.
            </Card>
          )}
        </>
      ) : (
      <>
      <Card className="legal-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPagina(0); }} placeholder="Folio, GAR-id, crédito, expediente, dirección o cliente…" className="pl-8" />
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtrados.length === 0 ? "0 resultados" : `${pag * PAGE + 1}–${Math.min((pag + 1) * PAGE, filtrados.length)} de ${filtrados.length}`}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
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
          <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setFiltroCiudad("todas"); setPagina(0); }} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs">
            <option value="todas">Todos los estados</option>
            {estadosDisponibles().map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filtroCiudad} onChange={(e) => { setFiltroCiudad(e.target.value); setPagina(0); }} disabled={filtroEstado === "todas"} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs disabled:opacity-50">
            <option value="todas">{filtroEstado === "todas" ? "Elige un estado primero" : "Todas las ciudades"}</option>
            {ciudadesDelEstado.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
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
                <th className="w-[18%] px-3 py-2 font-medium">Cliente</th>
                <th className="w-[7%] px-3 py-2 font-medium">Unidad</th>
                <th className="w-[13%] px-3 py-2 font-medium">Expediente</th>
                <th className="w-[13%] px-3 py-2 font-medium">Núm. garantía</th>
                <th className="w-[19%] px-3 py-2 font-medium">Dirección</th>
                <th className="w-[15%] px-3 py-2 font-medium">Documentos</th>
                <th className="w-[15%] px-3 py-2 font-medium">Subir rápido</th>
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
                  <td className="truncate px-3 py-2 text-xs text-muted-foreground" title={a.gar_id || ""}>{a.gar_id || "—"}</td>
                  <td className="truncate px-3 py-2 text-xs text-muted-foreground" title={a.direccion || ""}>{a.direccion || "—"}</td>
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
      </>
      )}
    </div>
  );
}
