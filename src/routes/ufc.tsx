import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, Fragment } from "react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, FileSignature, FilePlus, Loader2, MapPin, MoreVertical, Eye, Archive, Trash2, User } from "lucide-react";
import { listarFormalizaciones, crearFormalizacion, listarCasosVinculables, moverPapeleraFormalizacion, TIPOS_PROCESO, TIPOS_CONTRATO, type Formalizacion } from "@/lib/formalizacion";
import type { CasoJuridico } from "@/lib/supabase";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

export const Route = createFileRoute("/ufc")({
  head: () => ({ meta: [{ title: "UFC · Formalizaciones — JusticiaFácil" }] }),
  component: UFC,
});

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";

function UFC() {
  const navigate = useNavigate();
  const [filas, setFilas] = useState<Formalizacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [nuevoOpen, setNuevoOpen] = useState(false);

  const cargar = () => {
    setCargando(true);
    listarFormalizaciones().then(setFilas).finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  // menú de 3 puntitos por fila
  const [menuF, setMenuF] = useState<{ id: string; x: number; y: number } | null>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-menu-ufc]")) setMenuF(null); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  const hdrs = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const archivar = async (f: Formalizacion) => {
    if (!f.id) return;
    if (!confirm(`¿Archivar la formalización ${f.id_interno || f.expediente || ""}?\n\nSale del registro y se puede recuperar después.`)) return;
    await moverPapeleraFormalizacion(f.id); cargar();
  };
  const eliminar = async (f: Formalizacion) => {
    if (!f.id) return;
    if (!confirm(`¿ELIMINAR de forma permanente la formalización ${f.id_interno || f.expediente || ""}?\n\nEsta acción NO se puede deshacer.`)) return;
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/formalizacion?id=eq.${f.id}`, { method: "DELETE", headers: hdrs });
      if (!r.ok) throw new Error(String(r.status));
      cargar();
    } catch { alert("No se pudo eliminar."); }
  };

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return filas;
    return filas.filter((f) =>
      [f.id_interno, f.direccion_garantia, f.expediente, f.tipo_proceso, f.estado_tramite, f.nombre_cesionario]
        .some((v) => (v || "").toLowerCase().includes(t))
    );
  }, [filas, q]);

  // Agrupar por cliente (conecta UCM ↔ UFC)
  const grupos = useMemo(() => {
    const m = new Map<string, Formalizacion[]>();
    for (const f of filtradas) {
      const k = (f.nombre_cesionario || "").trim() || "Sin cliente";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    return [...m.entries()].map(([nombre, items]) => ({ nombre, items }));
  }, [filtradas]);

  const enProceso = filas.filter((f) => (f.estado_tramite || "").toLowerCase().includes("proceso")).length;
  const testimonios = filas.filter((f) => (f.estado_tramite || "").toLowerCase().includes("testimonio")).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="UFC · Formalizaciones"
        description="Cesión de derechos, escrituración y seguimiento a notaría. Las cotizaciones las maneja Contabilidad."
        actions={
          <button onClick={() => setNuevoOpen(true)} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: TEAL }}>
            <FilePlus className="h-4 w-4" /> Nueva formalización
          </button>
        }
      />

      {/* tarjetas resumen */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-2xl font-bold" style={{ color: NAVY }}>{filas.length}</p><p className="text-xs text-muted-foreground">Total en el registro</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold" style={{ color: TEAL }}>{enProceso}</p><p className="text-xs text-muted-foreground">En proceso</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-amber-700">{testimonios}</p><p className="text-xs text-muted-foreground">Testimonio entregado</p></Card>
      </div>

      {/* buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por ID, dirección, expediente…" className="pl-9" />
      </div>

      {/* lista */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">ID / Proceso</th>
                <th className="px-4 py-3">Dirección de la garantía</th>
                <th className="px-4 py-3">Expediente</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Etapa a seguir</th>
                <th className="px-2 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {grupos.map((g) => (
                <Fragment key={g.nombre}>
                  <tr className="bg-[color:var(--teal)]/5">
                    <td colSpan={6} className="px-4 py-1.5">
                      <button onClick={(e) => { e.stopPropagation(); navigate({ to: "/cliente", search: { nombre: g.nombre } as any }); }} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[color:var(--teal)] hover:underline"><User className="h-3.5 w-3.5" /> {g.nombre}</button>
                      <span className="ml-2 text-[11px] text-muted-foreground">· {g.items.length} formalización{g.items.length === 1 ? "" : "es"}</span>
                    </td>
                  </tr>
                  {g.items.map((f) => (
                <tr key={f.id} onClick={() => navigate({ to: "/ufc-ficha", search: { id: f.id } as any })} className="cursor-pointer hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-mono text-[12px] font-semibold" style={{ color: TEAL }}>{f.id_interno || "—"}</p>
                    <p className="text-xs text-muted-foreground">{f.tipo_proceso || ""}</p>
                  </td>
                  <td className="px-4 py-3"><p className="flex max-w-[260px] items-center gap-1"><MapPin className="h-3 w-3 shrink-0 text-muted-foreground" /><span className="truncate">{f.direccion_garantia || "—"}</span></p></td>
                  <td className="px-4 py-3">{f.expediente || "—"}<p className="text-xs text-muted-foreground">{f.juzgado ? f.juzgado.slice(0, 30) + "…" : ""}</p></td>
                  <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{f.estado_tramite || "—"}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{f.etapa_a_seguir || "—"}</td>
                  <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div data-menu-ufc className="relative inline-block">
                      <button onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenuF(menuF?.id === f.id ? null : { id: f.id!, x: r.right, y: r.bottom }); }} className="rounded-md p-1.5 hover:bg-muted" aria-label="Acciones"><MoreVertical className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
                  ))}
                </Fragment>
              ))}
              {filtradas.length === 0 && !cargando && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Sin formalizaciones. Toca "Nueva formalización" para agregar.</td></tr>
              )}
              {cargando && (<tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>

      {/* menú flotante de acciones (3 puntitos) */}
      {menuF && (() => {
        const f = filas.find((x) => x.id === menuF.id);
        if (!f) return null;
        return (
          <div data-menu-ufc onClick={(e) => e.stopPropagation()} className="fixed z-50 w-52 rounded-lg border border-border bg-card p-1.5 shadow-xl"
            style={{ top: menuF.y + 4, left: Math.max(8, menuF.x - 208) }}>
            <button onClick={() => { setMenuF(null); navigate({ to: "/ufc-ficha", search: { id: f.id } as any }); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"><Eye className="h-4 w-4" /> Ver ficha</button>
            <button onClick={() => { setMenuF(null); archivar(f); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"><Archive className="h-4 w-4" /> Archivar</button>
            <div className="my-1 border-t border-border" />
            <button onClick={() => { setMenuF(null); eliminar(f); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-muted"><Trash2 className="h-4 w-4" /> Eliminar</button>
          </div>
        );
      })()}

      {nuevoOpen && <NuevaFormalizacion onClose={() => setNuevoOpen(false)} onCreada={(nf) => { setNuevoOpen(false); if (nf?.id) navigate({ to: "/ufc-ficha", search: { id: nf.id } as any }); else cargar(); }} />}
    </div>
  );
}

// Modal para crear (Bloque 1 · Identificación)
function NuevaFormalizacion({ onClose, onCreada }: { onClose: () => void; onCreada: (f: Formalizacion | null) => void }) {
  const [d, setD] = useState<Formalizacion>({ tipo_proceso: TIPOS_PROCESO[0], tipo_contrato: TIPOS_CONTRATO[0] });
  const [guardando, setGuardando] = useState(false);
  const [casos, setCasos] = useState<CasoJuridico[]>([]);
  const [vinc, setVinc] = useState("");
  const set = (k: keyof Formalizacion, v: string) => setD((p) => ({ ...p, [k]: v }));
  const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const lbl = "mb-1 block text-xs font-medium text-muted-foreground";

  useEffect(() => { listarCasosVinculables().then(setCasos); }, []);

  // Al vincular un caso de UCM/UCP, se auto-llena la identificación.
  const vincular = (id: string) => {
    setVinc(id);
    const c = casos.find((x) => x.id === id);
    if (!c) return;
    setD((p) => ({
      ...p,
      caso_id: c.id,
      unidad_pertenece: c.unidad || p.unidad_pertenece || null,
      id_interno: c.gar_id || p.id_interno || "",
      direccion_garantia: c.direccion_garantia || "",
      expediente: c.expediente || "",
      distrito_judicial: c.distrito_judicial || "",
      juzgado: c.nombre_juzgado || c.juzgado || "",
      via_procesal: c.via_procesal || "",
      tipo_juicio: c.materia || c.tipo_proceso || "",
    }));
  };

  const guardar = async () => {
    setGuardando(true);
    const nf = await crearFormalizacion(d);
    setGuardando(false);
    onCreada(nf);
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 text-white" style={{ background: NAVY }}>
          <p className="flex items-center gap-2 font-semibold"><FileSignature className="h-4 w-4" /> Nueva formalización</p>
          <p className="text-xs text-white/70">Bloque 1 · Identificación. Los demás datos se llenan en la ficha.</p>
        </div>
        <div className="space-y-3 overflow-y-auto p-4">
          <div className="rounded-md border border-[color:var(--teal,#0C5C46)]/30 bg-[color:var(--teal,#0C5C46)]/5 p-3">
            <label className={lbl}>Vincular con un caso de UCM / UCP (auto-llena todo)</label>
            <select className={inp} value={vinc} onChange={(e) => vincular(e.target.value)}>
              <option value="">— Sin vincular (capturar a mano) —</option>
              {casos.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.unidad || "—")} · {c.expediente || "s/exp"} · {(c.direccion_garantia || "sin dirección").slice(0, 40)}
                </option>
              ))}
            </select>
            {vinc && <p className="mt-1 text-[11px] text-[color:var(--teal,#0C5C46)]">Vinculado ✓ Los datos se llenaron desde el caso; puedes ajustarlos abajo.</p>}
          </div>
          <div><label className={lbl}>ID interno (GAR-xxxx)</label><input className={inp} value={d.id_interno || ""} onChange={(e) => set("id_interno", e.target.value)} placeholder="GAR-603217539" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Tipo de proceso</label><select className={inp} value={d.tipo_proceso || ""} onChange={(e) => set("tipo_proceso", e.target.value)}>{TIPOS_PROCESO.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label className={lbl}>Tipo de contrato</label><select className={inp} value={d.tipo_contrato || ""} onChange={(e) => set("tipo_contrato", e.target.value)}>{TIPOS_CONTRATO.map((t) => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div><label className={lbl}>Dirección de la garantía</label><input className={inp} value={d.direccion_garantia || ""} onChange={(e) => set("direccion_garantia", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Expediente</label><input className={inp} value={d.expediente || ""} onChange={(e) => set("expediente", e.target.value)} /></div>
            <div><label className={lbl}>Distrito judicial</label><input className={inp} value={d.distrito_judicial || ""} onChange={(e) => set("distrito_judicial", e.target.value)} /></div>
          </div>
          <div><label className={lbl}>Juzgado</label><input className={inp} value={d.juzgado || ""} onChange={(e) => set("juzgado", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Tipo de juicio</label><input className={inp} value={d.tipo_juicio || ""} onChange={(e) => set("tipo_juicio", e.target.value)} /></div>
            <div><label className={lbl}>Vía procesal</label><input className={inp} value={d.via_procesal || ""} onChange={(e) => set("via_procesal", e.target.value)} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-3">
          <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
            {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</> : <><FilePlus className="h-4 w-4" /> Crear y abrir ficha</>}
          </button>
        </div>
      </div>
    </div>
  );
}
