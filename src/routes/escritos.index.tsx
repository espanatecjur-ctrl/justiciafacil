import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import {
  escritos,
  renderEscrito,
  valoresInicialesEscrito,
  type PlantillaEscrito,
} from "@/lib/escrito-templates";
import { listarPlantillasEscrito, eliminarPlantillaEscrito } from "@/lib/plantilla-escrito";
import {
  listarEscritos,
  actualizarEstadoEscrito,
  type EscritoGenerado,
} from "@/lib/escrito-generado";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, Plus, Loader2, LayoutGrid, Inbox, FileCheck2, Archive as ArchiveIcon,
  Eye, X, PenLine, Trash2, RotateCcw, Archive,
} from "lucide-react";

export const Route = createFileRoute("/escritos/")({
  head: () => ({ meta: [{ title: "Escritos — SIGA-DIIPA" }] }),
  component: EscritosIndex,
});

const estadoTono: Record<string, string> = {
  generado: "bg-emerald-100 text-emerald-900",
  archivado: "bg-slate-100 text-slate-800",
  papelera: "bg-red-100 text-red-900",
};

function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

type TabKey = "plantillas" | "solicitudes" | "generados" | "archivo";

const TABS: { key: TabKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: "plantillas", label: "Plantillas", icon: LayoutGrid },
  { key: "solicitudes", label: "Solicitudes", icon: Inbox },
  { key: "generados", label: "Generados", icon: FileCheck2 },
  { key: "archivo", label: "Archivo", icon: ArchiveIcon },
];

function EscritosIndex() {
  const [tab, setTab] = useState<TabKey>("plantillas");
  const [nGen, setNGen] = useState(0);
  const [nArch, setNArch] = useState(0);
  const [nPlant, setNPlant] = useState(escritos.length);

  useEffect(() => {
    listarEscritos("generado").then((l) => setNGen(l.length));
    listarPlantillasEscrito().then((c) => setNPlant(escritos.length + c.length));
    Promise.all([listarEscritos("archivado"), listarEscritos("papelera")])
      .then(([a, p]) => setNArch(a.length + p.length));
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Documentos"
        title="Escritos"
        description="Plantillas auto-llenables de demandas, promociones y contestaciones."
        actions={
          <div className="flex gap-2">
            <Link to="/escritos/nueva">
              <Button variant="outline"><LayoutGrid className="h-4 w-4 mr-1.5" /> Nueva plantilla</Button>
            </Link>
            <Link to="/escritos/editor">
              <Button className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
                <Plus className="h-4 w-4 mr-1.5" /> Nuevo escrito
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador n={String(nPlant)} l="Plantillas" activo={tab === "plantillas"} onClick={() => setTab("plantillas")} tono="text-[#0B1E3A]" />
        <Indicador n="0" l="Solicitudes pendientes" activo={tab === "solicitudes"} onClick={() => setTab("solicitudes")} tono="text-[#8A6E22]" />
        <Indicador n={String(nGen)} l="Escritos generados" activo={tab === "generados"} onClick={() => setTab("generados")} tono="text-emerald-600" />
        <Indicador n={String(nArch)} l="Archivados / papelera" activo={tab === "archivo"} onClick={() => setTab("archivo")} tono="text-slate-600" />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition ${on ? "border-[color:var(--teal)] font-semibold text-[color:var(--teal)]" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "plantillas" && <PanelPlantillas />}
      {tab === "solicitudes" && <PanelSolicitudes />}
      {tab === "generados" && <EscritosExistentes estados={["generado"]} vacio="Aún no hay escritos guardados. Genera uno en el Editor y pícale “Guardar”." />}
      {tab === "archivo" && <EscritosExistentes estados={["archivado", "papelera"]} vacio="No hay escritos archivados ni en papelera." />}
    </div>
  );
}

function Indicador({ n, l, activo, onClick, tono }: { n: string; l: string; activo: boolean; onClick: () => void; tono: string }) {
  return (
    <button onClick={onClick} className={`legal-card p-4 text-left transition hover:border-[color:var(--teal)] ${activo ? "border-[color:var(--teal)] ring-1 ring-[color:var(--teal)]/30" : ""}`}>
      <p className="text-xs text-muted-foreground">{l}</p>
      <p className={`mt-1 font-display text-2xl font-bold leading-none ${tono}`}>{n}</p>
    </button>
  );
}

function PanelPlantillas() {
  const navigate = useNavigate();
  const [customs, setCustoms] = useState<PlantillaEscrito[]>([]);
  const [preview, setPreview] = useState<PlantillaEscrito | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = () =>
    listarPlantillasEscrito().then(setCustoms).finally(() => setCargando(false));
  useEffect(() => { recargar(); }, []);

  const borrar = async (tipo: string) => {
    if (!window.confirm("¿Eliminar esta plantilla propia?")) return;
    await eliminarPlantillaEscrito(tipo);
    recargar();
  };

  const tarjeta = (p: PlantillaEscrito, esPropia: boolean) => (
    <div key={p.tipo} className="legal-card group relative p-4 transition hover:border-[color:var(--teal)] hover:shadow-md">
      <div className="absolute right-2 top-2 flex gap-0.5">
        <button onClick={() => setPreview(p)} title="Vista previa" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Eye className="h-4 w-4" /></button>
        {esPropia && (
          <button onClick={() => borrar(p.tipo)} title="Eliminar" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        )}
      </div>
      <button onClick={() => navigate({ to: "/escritos/editor", search: { tipo: p.tipo } })} className="block w-full text-left">
        <FileText className="mb-2 h-6 w-6 text-[color:var(--teal)]" />
        <p className="pr-12 font-display text-sm font-bold leading-tight group-hover:text-[color:var(--teal)]">{p.nombre}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.descripcion}</p>
        <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{p.materia}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 font-display text-sm font-semibold text-muted-foreground">Plantillas base</p>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">{escritos.map((p) => tarjeta(p, false))}</div>
      </div>

      <div>
        <p className="mb-2 font-display text-sm font-semibold text-muted-foreground">Mis plantillas</p>
        {cargando ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : customs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aún no tienes plantillas propias. Crea una con “Nueva plantilla”.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">{customs.map((p) => tarjeta(p, true))}</div>
        )}
      </div>

      {preview && (
        <PreviewPlantilla
          plantilla={preview}
          onCerrar={() => setPreview(null)}
          onElaborar={() => navigate({ to: "/escritos/editor", search: { tipo: preview.tipo } })}
        />
      )}
    </div>
  );
}

function PreviewPlantilla({ plantilla, onCerrar, onElaborar }: { plantilla: PlantillaEscrito; onCerrar: () => void; onElaborar: () => void }) {
  const texto = renderEscrito(plantilla, valoresInicialesEscrito(plantilla));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="font-display text-sm font-bold text-[#0B1E3A]">Vista previa · {plantilla.nombre}</p>
          <button onClick={onCerrar} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-5">
          <pre className="whitespace-pre-wrap font-serif text-[13px] leading-relaxed text-foreground/90">{texto}</pre>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" onClick={onCerrar}>Cerrar</Button>
          <Button size="sm" onClick={onElaborar} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white"><PenLine className="mr-1.5 h-4 w-4" /> Elaborar</Button>
        </div>
      </div>
    </div>
  );
}

function PanelSolicitudes() {
  return (
    <Card className="legal-card p-8 text-center">
      <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="font-display text-sm font-semibold">Sin solicitudes por ahora</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
        Aquí llegarán las solicitudes de escrito de otras áreas cuando conectemos ese flujo. Por ahora los escritos se elaboran directo en el Editor.
      </p>
    </Card>
  );
}

function EscritosExistentes({ estados, vacio }: { estados: string[]; vacio: string }) {
  const [lista, setLista] = useState<EscritoGenerado[]>([]);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  const recargar = () => {
    setCargando(true);
    Promise.all(estados.map((e) => listarEscritos(e)))
      .then((arrs) => setLista(arrs.flat().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))))
      .finally(() => setCargando(false));
  };
  useEffect(() => { recargar(); }, [estados.join(",")]); // eslint-disable-line

  const cambiar = async (id: string | undefined, estado: string) => {
    if (!id) return;
    await actualizarEstadoEscrito(id, estado);
    recargar();
  };

  const reelaborar = (c: EscritoGenerado) => {
    try {
      sessionStorage.setItem("reelaborar_escrito", JSON.stringify({ tipo: c.tipo, valores: c.valores }));
    } catch { /* nada */ }
    navigate({ to: "/escritos/editor", search: {} });
  };

  return (
    <Card className="legal-card overflow-hidden">
      {cargando ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : lista.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">{vacio}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Folio</th>
                <th className="text-left px-4 py-2.5">Escrito</th>
                <th className="text-left px-4 py-2.5">Promovente</th>
                <th className="text-left px-4 py-2.5">Posición</th>
                <th className="text-left px-4 py-2.5">Fecha</th>
                <th className="text-left px-4 py-2.5">Cuantía</th>
                <th className="text-left px-4 py-2.5">Estado</th>
                <th className="text-right px-4 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lista.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{c.folio || "—"}</td>
                  <td className="px-4 py-3">{c.nombre_documento || "—"}</td>
                  <td className="px-4 py-3">{c.nombre_promovente || "—"}</td>
                  <td className="px-4 py-3 text-xs">{c.posicion || "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-xs">{fmtFecha(c.fecha_generado || c.created_at)}</td>
                  <td className="px-4 py-3 tabular-nums">{c.cuantia ? `$ ${Number(c.cuantia).toLocaleString("es-MX")}` : "—"}</td>
                  <td className="px-4 py-3"><Badge className={`capitalize ${estadoTono[c.estado || "generado"] || ""}`}>{c.estado || "generado"}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => reelaborar(c)} title="Reelaborar" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-[color:var(--teal)]"><PenLine className="h-4 w-4" /></button>
                      {c.estado !== "archivado" && (
                        <button onClick={() => cambiar(c.id, "archivado")} title="Archivar" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Archive className="h-4 w-4" /></button>
                      )}
                      {c.estado !== "papelera" && (
                        <button onClick={() => cambiar(c.id, "papelera")} title="Mandar a papelera" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      )}
                      {(c.estado === "archivado" || c.estado === "papelera") && (
                        <button onClick={() => cambiar(c.id, "generado")} title="Restaurar" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-emerald-600"><RotateCcw className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
