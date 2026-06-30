import { useEffect, useState } from "react";
import { X, Loader2, Scale, Check, CircleDot, Circle, MapPin, Megaphone, Save, Settings2 } from "lucide-react";
import { type CasoJuridico, SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { CATALOGO_ETAPAS, POSICIONES, tipoJuicioPorClave, listaTiposJuicio, type EtapaJuicio } from "@/lib/etapas-juicio";
import { obtenerSeguimiento, guardarSeguimiento, type SeguimientoJuicio } from "@/lib/seguimiento-juicio";
import { DocumentosGarantia } from "@/components/documentos-garantia";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";
const wHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const lbl = "mb-1 block text-[11px] font-medium text-muted-foreground";

interface Acuerdo { fecha_acuerdo: string | null; texto: string | null; }

const fmt = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

export function SeguimientoJuicioModal({ area, caso, onClose }: { area: string; caso: CasoJuridico; onClose: () => void }) {
  const [cargando, setCargando] = useState(true);
  const [seg, setSeg] = useState<SeguimientoJuicio | null>(null);
  const [ultimoAcuerdo, setUltimoAcuerdo] = useState<Acuerdo | null>(null);

  // estado de configuración (cuando aún no hay tipo)
  const [tipoSel, setTipoSel] = useState("");
  const [posSel, setPosSel] = useState("");
  const [config, setConfig] = useState(false); // mostrar el configurador
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const s = await obtenerSeguimiento(caso);
      setSeg(s);
      if (s) { setTipoSel(s.tipo_juicio || ""); setPosSel(s.posicion || ""); }
      else setConfig(true); // sin configurar → pedir tipo+posición
      // último acuerdo del boletín como referencia
      if (caso.expediente) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial?select=fecha_acuerdo,texto&expediente=eq.${encodeURIComponent(caso.expediente.trim())}&order=fecha_acuerdo.desc&limit=1`, { headers: wHeaders });
        const d = r.ok ? await r.json() : [];
        setUltimoAcuerdo(d?.[0] || null);
      }
      setCargando(false);
    })();
    // eslint-disable-next-line
  }, [caso.id]);

  const tipoDef = tipoJuicioPorClave(seg?.tipo_juicio);
  const etapas: EtapaJuicio[] = tipoDef?.etapas || [];
  const hechas = new Set(seg?.etapas_hechas || []);
  const etapaActual = seg?.etapa_actual || null;

  const guardarConfig = async () => {
    if (!tipoSel || !posSel) return;
    setGuardando(true);
    const s = await guardarSeguimiento(caso, seg?.id || null, { tipo_juicio: tipoSel, posicion: posSel });
    setGuardando(false);
    if (s) { setSeg(s); setConfig(false); }
  };

  // marcar una etapa como la actual (y todas las anteriores como hechas)
  const marcarActual = async (clave: string) => {
    if (!seg) return;
    const idx = etapas.findIndex((e) => e.clave === clave);
    const previas = etapas.slice(0, idx).map((e) => e.clave);
    const s = await guardarSeguimiento(caso, seg.id, { etapa_actual: clave, etapas_hechas: previas });
    if (s) setSeg(s);
  };

  // marcar/desmarcar una etapa como hecha (sin moverla a actual)
  const toggleHecha = async (clave: string) => {
    if (!seg) return;
    const set = new Set(seg.etapas_hechas || []);
    if (set.has(clave)) set.delete(clave); else set.add(clave);
    const s = await guardarSeguimiento(caso, seg.id, { etapas_hechas: [...set] });
    if (s) setSeg(s);
  };

  const estatusActual = (() => {
    if (!etapaActual) return "Sin etapa marcada";
    const e = etapas.find((x) => x.clave === etapaActual);
    return e ? e.nombre : "—";
  })();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between gap-2 p-4 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${TEAL})` }}>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold"><Scale className="h-4 w-4" /> Seguimiento del juicio</p>
            <p className="truncate text-xs text-white/80">{caso.expediente || "— sin expediente —"}</p>
          </div>
          <button onClick={onClose} className="shrink-0"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto p-4">
          {cargando ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
          ) : config ? (
            // ---- Configurador inicial: elegir tipo + posición ----
            <div className="space-y-4">
              <div className="rounded-lg border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3 text-sm">
                Configura este juicio una vez: elige el <b>tipo</b> y la <b>posición</b> de DIIPA. Después solo vas marcando las etapas.
              </div>
              <div>
                <label className={lbl}>Tipo de juicio</label>
                <select className={inp} value={tipoSel} onChange={(e) => setTipoSel(e.target.value)}>
                  <option value="">— elegir —</option>
                  {listaTiposJuicio().map((t) => <option key={t.clave} value={t.clave}>{t.etiqueta}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Posición de DIIPA</label>
                <select className={inp} value={posSel} onChange={(e) => setPosSel(e.target.value)}>
                  <option value="">— elegir —</option>
                  {POSICIONES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                {seg && <button onClick={() => setConfig(false)} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>}
                <button onClick={guardarConfig} disabled={!tipoSel || !posSel || guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: TEAL }}>
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
                </button>
              </div>
            </div>
          ) : (
            // ---- Vista normal ----
            <div className="space-y-4">
              {/* resumen */}
              <div className="grid gap-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-2">
                <div><span className="text-xs text-muted-foreground">Tipo de juicio</span><p className="font-medium">{tipoDef ? `${tipoDef.tipo} · ${tipoDef.via === "oral" ? "Oral" : "Escrito"}` : "—"}</p></div>
                <div><span className="text-xs text-muted-foreground">Posición de DIIPA</span><p className="font-medium">{seg?.posicion || "—"}</p></div>
                <div><span className="text-xs text-muted-foreground">Estatus actual</span><p className="font-medium" style={{ color: TEAL }}>{estatusActual}</p></div>
                <div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Megaphone className="h-3 w-3" /> Última actuación (boletín)</span>
                  <p className="text-xs">{ultimoAcuerdo ? `${fmt(ultimoAcuerdo.fecha_acuerdo)} · ${ultimoAcuerdo.texto || "—"}` : "Sin acuerdos del robot todavía."}</p>
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <button onClick={() => setConfig(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Settings2 className="h-3.5 w-3.5" /> Cambiar tipo / posición</button>
                </div>
              </div>

              {/* ruta de etapas */}
              {tipoDef ? (
                <div>
                  <p className="mb-2 text-xs font-semibold" style={{ color: NAVY }}>Etapas del juicio · <span className="font-normal text-muted-foreground">{tipoDef.ley}</span></p>
                  <p className="mb-3 text-[11px] text-muted-foreground">Toca una etapa para marcarla como la <b>actual</b>. El ✓ marca las completadas.</p>
                  <div className="space-y-1.5">
                    {etapas.map((e) => {
                      const esActual = e.clave === etapaActual;
                      const esHecha = hechas.has(e.clave);
                      return (
                        <div key={e.clave} className={`flex items-start gap-2 rounded-lg border p-2.5 ${esActual ? "border-[color:var(--teal)] bg-[color:var(--teal)]/5" : "border-border"}`}>
                          <button onClick={() => toggleHecha(e.clave)} title="Marcar completada" className="mt-0.5 shrink-0">
                            {esActual ? <CircleDot className="h-4 w-4" style={{ color: TEAL }} /> : esHecha ? <Check className="h-4 w-4 text-[color:var(--teal)]" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                          </button>
                          <button onClick={() => marcarActual(e.clave)} className="min-w-0 flex-1 text-left">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`text-sm ${esActual ? "font-semibold" : esHecha ? "font-medium" : ""}`}>{e.nombre}</span>
                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{e.fase}</span>
                              {esActual && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: TEAL }}>EN CURSO</span>}
                            </div>
                            {e.resumen && <p className="mt-0.5 text-[11px] text-muted-foreground">{e.resumen}</p>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No se encontraron las etapas de este tipo.</p>
              )}

              {/* documentos y movimientos (también dentro del modal) */}
              <div className="border-t border-border pt-3">
                <DocumentosGarantia area={area} caso={caso} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
