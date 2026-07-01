import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, FileSignature, FilePlus, Loader2, MapPin } from "lucide-react";
import { listarFormalizaciones, crearFormalizacion, TIPOS_PROCESO, TIPOS_CONTRATO, type Formalizacion } from "@/lib/formalizacion";

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

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return filas;
    return filas.filter((f) =>
      [f.id_interno, f.direccion_garantia, f.expediente, f.tipo_proceso, f.estado_tramite]
        .some((v) => (v || "").toLowerCase().includes(t))
    );
  }, [filas, q]);

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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtradas.map((f) => (
                <tr key={f.id} onClick={() => navigate({ to: "/ufc-ficha", search: { id: f.id } as any })} className="cursor-pointer hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-mono text-[12px] font-semibold" style={{ color: TEAL }}>{f.id_interno || "—"}</p>
                    <p className="text-xs text-muted-foreground">{f.tipo_proceso || ""}</p>
                  </td>
                  <td className="px-4 py-3"><p className="flex max-w-[260px] items-center gap-1"><MapPin className="h-3 w-3 shrink-0 text-muted-foreground" /><span className="truncate">{f.direccion_garantia || "—"}</span></p></td>
                  <td className="px-4 py-3">{f.expediente || "—"}<p className="text-xs text-muted-foreground">{f.juzgado ? f.juzgado.slice(0, 30) + "…" : ""}</p></td>
                  <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{f.estado_tramite || "—"}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{f.etapa_a_seguir || "—"}</td>
                </tr>
              ))}
              {filtradas.length === 0 && !cargando && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Sin formalizaciones. Toca "Nueva formalización" para agregar.</td></tr>
              )}
              {cargando && (<tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>

      {nuevoOpen && <NuevaFormalizacion onClose={() => setNuevoOpen(false)} onCreada={(nf) => { setNuevoOpen(false); if (nf?.id) navigate({ to: "/ufc-ficha", search: { id: nf.id } as any }); else cargar(); }} />}
    </div>
  );
}

// Modal para crear (Bloque 1 · Identificación)
function NuevaFormalizacion({ onClose, onCreada }: { onClose: () => void; onCreada: (f: Formalizacion | null) => void }) {
  const [d, setD] = useState<Formalizacion>({ tipo_proceso: TIPOS_PROCESO[0], tipo_contrato: TIPOS_CONTRATO[0] });
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof Formalizacion, v: string) => setD((p) => ({ ...p, [k]: v }));
  const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const lbl = "mb-1 block text-xs font-medium text-muted-foreground";

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
