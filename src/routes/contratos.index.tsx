import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { plantillas, renderContrato, valoresIniciales } from "@/lib/contract-templates";
import { listarEstadosPlantilla, setEstadoPlantilla } from "@/lib/plantilla-estado";
import { listarPlantillasCustom } from "@/lib/plantilla-custom";
import { listarGrupos, crearGrupo, eliminarGrupo, listarAsignaciones, asignarPlantillaGrupo, type Grupo } from "@/lib/plantilla-grupo";
import type { PlantillaContrato } from "@/lib/contract-templates";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Loader2, MoreVertical, PenLine, Archive, Trash2, LayoutGrid, Inbox, FileCheck2, Archive as ArchiveIcon, Eye, X, RotateCcw, FolderPlus, FolderInput, Layers } from "lucide-react";
import { SolicitudesContratoTabla } from "@/components/solicitudes-contrato-tabla";
import { listarContratos, actualizarEstadoContrato, type ContratoGenerado } from "@/lib/contrato-generado";
import { listarEnvios, type EnvioRegistro } from "@/lib/enviar-correo";
import { contarContratosPendientes } from "@/lib/resumen-inicio";

export const Route = createFileRoute("/contratos/")({
  head: () => ({ meta: [{ title: "Contratos — SIGA-DIIPA" }] }),
  component: ContratosIndex,
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

function ContratosIndex() {
  const [tab, setTab] = useState<TabKey>("plantillas");
  const [solPend, setSolPend] = useState(0);
  const [nGen, setNGen] = useState(0);
  const [nArch, setNArch] = useState(0);
  const [nPlant, setNPlant] = useState(plantillas.length);

  useEffect(() => {
    contarContratosPendientes().then(setSolPend);
    listarContratos("generado").then((l) => setNGen(l.length));
    listarPlantillasCustom().then((c) => setNPlant(plantillas.length + c.length));
    Promise.all([listarContratos("archivado"), listarContratos("papelera")])
      .then(([a, p]) => setNArch(a.length + p.length));
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Documentos"
        title="Contratos"
        description="Plantillas auto-llenables, solicitudes y contratos generados."
        actions={
          <div className="flex gap-2">
            <Link to="/contratos/nueva">
              <Button variant="outline"><LayoutGrid className="h-4 w-4 mr-1.5" /> Nueva plantilla</Button>
            </Link>
            <Link to="/contratos/editor">
              <Button className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
                <Plus className="h-4 w-4 mr-1.5" /> Nuevo contrato
              </Button>
            </Link>
          </div>
        }
      />

      {/* Indicadores que llevan a su pestaña */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador n={String(nPlant)} l="Plantillas" activo={tab === "plantillas"} onClick={() => setTab("plantillas")} tono="text-[#0B1E3A]" />
        <Indicador n={String(solPend)} l="Solicitudes pendientes" activo={tab === "solicitudes"} onClick={() => setTab("solicitudes")} tono="text-[#8A6E22]" />
        <Indicador n={String(nGen)} l="Contratos generados" activo={tab === "generados"} onClick={() => setTab("generados")} tono="text-emerald-600" />
        <Indicador n={String(nArch)} l="Archivados / papelera" activo={tab === "archivo"} onClick={() => setTab("archivo")} tono="text-slate-600" />
      </div>

      {/* Pestañas */}
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
      {tab === "solicitudes" && <SolicitudesContratoTabla />}
      {tab === "generados" && <ContratosExistentes estados={["generado"]} vacio="Aún no hay contratos guardados. Genera uno en el Editor y pícale “Guardar”." />}
      {tab === "archivo" && <ContratosExistentes estados={["archivado", "papelera"]} vacio="No hay contratos archivados ni en papelera." />}
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
  const [estados, setEstados] = useState<Record<string, string>>({});
  const [customs, setCustoms] = useState<PlantillaContrato[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [asig, setAsig] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [nuevoPaq, setNuevoPaq] = useState(false);

  const recargar = () => {
    listarEstadosPlantilla().then(setEstados);
    listarGrupos().then(setGrupos);
    listarAsignaciones().then(setAsig);
  };
  useEffect(() => { recargar(); listarPlantillasCustom().then(setCustoms); }, []);

  const cambiar = async (tipo: string, estado: string) => { await setEstadoPlantilla(tipo, estado); recargar(); };
  const mover = async (tipo: string, grupoId: string | null) => { await asignarPlantillaGrupo(tipo, grupoId); recargar(); };
  const borrarGrupo = async (id: string) => { if (window.confirm("¿Eliminar este paquete? Las plantillas quedan como individuales.")) { await eliminarGrupo(id); recargar(); } };

  const todas = [...plantillas, ...customs];
  const activas = todas.filter((p) => (estados[p.tipo] || "activa") === "activa");
  const plantillaPreview = todas.find((p) => p.tipo === preview) || null;

  const tarjeta = (p: PlantillaContrato) => (
    <div key={p.tipo} className="legal-card group relative p-4 transition hover:border-[color:var(--teal)] hover:shadow-md">
      <div className="absolute right-2 top-2 flex gap-0.5">
        <button onClick={() => setPreview(p.tipo)} title="Vista previa" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Eye className="h-4 w-4" /></button>
        <MenuPlantilla
          grupos={grupos}
          grupoActual={asig[p.tipo] || null}
          onElaborar={() => navigate({ to: "/contratos/editor", search: { tipo: p.tipo } })}
          onMover={(g) => mover(p.tipo, g)}
          onArchivar={() => cambiar(p.tipo, "archivada")}
          onPapelera={() => cambiar(p.tipo, "papelera")}
        />
      </div>
      <button onClick={() => navigate({ to: "/contratos/editor", search: { tipo: p.tipo } })} className="block w-full text-left">
        <FileText className="mb-2 h-6 w-6 text-[color:var(--teal)]" />
        <p className="pr-12 font-display text-sm font-bold leading-tight group-hover:text-[color:var(--teal)]">{p.nombre}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.descripcion}</p>
      </button>
    </div>
  );

  const individuales = activas.filter((p) => !asig[p.tipo] || !grupos.some((g) => g.id === asig[p.tipo]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Contratos agrupados en paquetes por fase. El ojo muestra la vista previa.</p>
        <Button variant="outline" size="sm" onClick={() => setNuevoPaq(true)}><FolderPlus className="h-4 w-4 mr-1.5" /> Nuevo paquete</Button>
      </div>

      {/* Paquetes */}
      {grupos.map((g) => {
        const items = activas.filter((p) => asig[p.tipo] === g.id);
        return (
          <div key={g.id} className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[color:var(--teal)]" />
                  <span className="font-display text-base font-semibold">{g.nombre || "Paquete"}</span>
                  {g.fase && <span className="rounded-full bg-[color:var(--teal)]/15 px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--teal)]">Fase · {g.fase}</span>}
                </div>
                {g.descripcion && <p className="mt-0.5 text-xs text-muted-foreground">{g.descripcion}</p>}
              </div>
              <button onClick={() => borrarGrupo(g.id)} className="text-xs text-red-600 hover:underline">Eliminar paquete</button>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin plantillas. Usa el ⋮ de una tarjeta → “Mover a paquete”.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">{items.map(tarjeta)}</div>
            )}
          </div>
        );
      })}

      {/* Individuales */}
      <div>
        <p className="mb-2 font-display text-sm font-semibold text-muted-foreground">{grupos.length ? "Individuales (sin paquete)" : "Plantillas"}</p>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">{individuales.map(tarjeta)}</div>
      </div>

      {plantillaPreview && <PreviewPlantilla plantilla={plantillaPreview} onCerrar={() => setPreview(null)} onElaborar={() => navigate({ to: "/contratos/editor", search: { tipo: plantillaPreview.tipo } })} />}

      {nuevoPaq && <ModalNuevoPaquete onCerrar={() => setNuevoPaq(false)} onCreado={() => { setNuevoPaq(false); recargar(); }} />}

      {(() => {
        const ocultas = todas.filter((p) => ["archivada", "papelera"].includes(estados[p.tipo] || ""));
        if (!ocultas.length) return null;
        return (
          <div className="mt-2 rounded-lg border border-dashed border-border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Plantillas ocultas (archivadas / en papelera)</p>
            <div className="flex flex-wrap gap-2">
              {ocultas.map((p) => (
                <span key={p.tipo} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
                  {p.nombre} <span className="text-[10px] uppercase text-muted-foreground">{estados[p.tipo]}</span>
                  <button onClick={() => cambiar(p.tipo, "activa")} title="Restaurar" className="text-[color:var(--teal)] hover:opacity-70"><RotateCcw className="h-3.5 w-3.5" /></button>
                </span>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ModalNuevoPaquete({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: () => void }) {
  const [nombre, setNombre] = useState("");
  const [fase, setFase] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const guardar = async () => {
    if (!nombre.trim()) return;
    setOcupado(true);
    await crearGrupo(nombre.trim(), fase.trim(), descripcion.trim());
    setOcupado(false);
    onCreado();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-base font-bold text-[#0B1E3A]">Nuevo paquete</p>
          <button onClick={onCerrar} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Nombre del paquete</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Paquete de Cambio" className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" autoFocus />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Fase / etapa</label>
            <input value={fase} onChange={(e) => setFase(e.target.value)} placeholder="Ej. Cambio · Compra · Cierre" className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">¿Para qué son? (breve)</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className="mt-0.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={onCerrar}>Cancelar</Button>
          <Button size="sm" disabled={ocupado || !nombre.trim()} onClick={guardar} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">{ocupado ? "Guardando…" : "Crear paquete"}</Button>
        </div>
      </div>
    </div>
  );
}

function MenuPlantilla({ grupos, grupoActual, onElaborar, onMover, onArchivar, onPapelera }: { grupos: Grupo[]; grupoActual: string | null; onElaborar: () => void; onMover: (g: string | null) => void; onArchivar: () => void; onPapelera: () => void }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="relative inline-block text-left">
      <button onClick={() => setAbierto((v) => !v)} title="Acciones" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
        <MoreVertical className="h-4 w-4" />
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-20 mt-1 max-h-72 w-56 overflow-auto rounded-md border border-border bg-white py-1 shadow-lg">
            <button onClick={() => { setAbierto(false); onElaborar(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><PenLine className="h-3.5 w-3.5" /> Elaborar para un cliente</button>
            {grupos.length > 0 && (
              <>
                <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase text-muted-foreground"><FolderInput className="h-3 w-3" /> Mover a paquete</p>
                {grupos.map((g) => (
                  <button key={g.id} onClick={() => { setAbierto(false); onMover(g.id); }} className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted ${grupoActual === g.id ? "font-semibold text-[color:var(--teal)]" : ""}`}>
                    <Layers className="h-3.5 w-3.5" /> {g.nombre}
                  </button>
                ))}
                {grupoActual && <button onClick={() => { setAbierto(false); onMover(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"><X className="h-3.5 w-3.5" /> Quitar de paquete</button>}
              </>
            )}
            <div className="my-1 border-t border-border" />
            <button onClick={() => { setAbierto(false); onArchivar(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"><Archive className="h-3.5 w-3.5" /> Archivar</button>
            <button onClick={() => { setAbierto(false); onPapelera(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Mover a papelera</button>
          </div>
        </>
      )}
    </div>
  );
}

function PreviewPlantilla({ plantilla, onCerrar, onElaborar }: { plantilla: typeof plantillas[number]; onCerrar: () => void; onElaborar: () => void }) {
  const texto = renderContrato(plantilla, valoresIniciales(plantilla));
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

function ContratosExistentes({ estados, vacio }: { estados: string[]; vacio: string }) {
  const [lista, setLista] = useState<ContratoGenerado[]>([]);
  const [envios, setEnvios] = useState<Record<string, EnvioRegistro>>({});
  const [cargando, setCargando] = useState(true);

  const recargar = () => {
    setCargando(true);
    Promise.all(estados.map((e) => listarContratos(e)))
      .then((arrs) => setLista(arrs.flat().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))))
      .finally(() => setCargando(false));
    listarEnvios().then((arr) => {
      const mapa: Record<string, EnvioRegistro> = {};
      for (const e of arr) if (e.folio && !mapa[e.folio]) mapa[e.folio] = e;
      setEnvios(mapa);
    });
  };
  useEffect(() => { recargar(); }, [estados.join(",")]); // eslint-disable-line

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
                <th className="text-left px-4 py-2.5">Documento</th>
                <th className="text-left px-4 py-2.5">Cliente</th>
                <th className="text-left px-4 py-2.5">Firma (apoderado)</th>
                <th className="text-left px-4 py-2.5">Fecha</th>
                <th className="text-left px-4 py-2.5">Cuantía</th>
                <th className="text-left px-4 py-2.5">Estado</th>
                <th className="text-left px-4 py-2.5">Correo</th>
                <th className="text-right px-4 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lista.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{c.folio || "—"}</td>
                  <td className="px-4 py-3">{c.nombre_documento || "—"}</td>
                  <td className="px-4 py-3">{c.nombre_cliente || "—"}</td>
                  <td className="px-4 py-3 text-xs">{c.apoderado || "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-xs">{fmtFecha(c.fecha_generado || c.created_at)}</td>
                  <td className="px-4 py-3 tabular-nums">{c.cuantia ? `$ ${Number(c.cuantia).toLocaleString("es-MX")}` : "—"}</td>
                  <td className="px-4 py-3"><Badge className={`capitalize ${estadoTono[c.estado || "generado"] || ""}`}>{c.estado || "generado"}</Badge></td>
                  <td className="px-4 py-3">
                    {(() => {
                      const e = c.folio ? envios[c.folio] : undefined;
                      if (!e) return <span className="text-xs text-muted-foreground">—</span>;
                      if (e.estado === "abierto") {
                        const t = e.abierto_at ? new Date(e.abierto_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
                        return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800" title={`Abierto ${t}`}>Abierto ✓</span>;
                      }
                      return <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">Enviado</span>;
                    })()}
                    {c.fecha_enviado && (
                      <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">Enviado: {fmtFecha(c.fecha_enviado)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right"><MenuAcciones c={c} onCambio={recargar} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function MenuAcciones({ c, onCambio }: { c: ContratoGenerado; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();

  const reelaborar = () => {
    sessionStorage.setItem("reelaborar_contrato", JSON.stringify({ tipo: c.tipo, valores: c.valores ?? {} }));
    navigate({ to: "/contratos/editor", search: c.tipo ? { tipo: c.tipo } : {} });
  };
  const cambiarEstado = async (estado: string) => {
    setAbierto(false);
    if (c.id) { await actualizarEstadoContrato(c.id, estado); onCambio(); }
  };

  return (
    <div className="relative inline-block text-left">
      <button onClick={() => setAbierto((v) => !v)} className="rounded-md p-1.5 hover:bg-muted" title="Acciones">
        <MoreVertical className="h-4 w-4" />
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-border bg-white py-1 shadow-lg">
            <button onClick={reelaborar} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
              <PenLine className="h-3.5 w-3.5" /> Reelaborar
            </button>
            {c.estado !== "archivado" && (
              <button onClick={() => cambiarEstado("archivado")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                <Archive className="h-3.5 w-3.5" /> Archivar
              </button>
            )}
            {c.estado === "papelera" ? (
              <button onClick={() => cambiarEstado("generado")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                <PenLine className="h-3.5 w-3.5" /> Restaurar
              </button>
            ) : (
              <button onClick={() => cambiarEstado("papelera")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" /> Mover a papelera
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
