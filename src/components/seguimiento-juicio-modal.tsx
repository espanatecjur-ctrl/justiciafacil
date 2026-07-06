import { useEffect, useState } from "react";
import { X, Loader2, Scale, Check, CircleDot, Circle, MapPin, Megaphone, Save, Settings2 } from "lucide-react";
import { type CasoJuridico, SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { CATALOGO_ETAPAS, POSICIONES, tipoJuicioPorClave, listaTiposJuicio, type EtapaJuicio } from "@/lib/etapas-juicio";
import { obtenerSeguimiento, guardarSeguimiento, estadoChecklist, marcarChecklist, listarProcesal, agregarProcesal, type SeguimientoJuicio, type MarcaChecklist, type SeguimientoProcesal } from "@/lib/seguimiento-juicio";
import { sugerirEtapa } from "@/lib/boletin-a-etapa";
import { DocumentosGarantia } from "@/components/documentos-garantia";
import { ChulearDocumentoModal } from "@/components/chulear-documento";
import { ChevronDown, ChevronRight, FileCheck2, FileX2, Plus, ClipboardList, Loader2 as Spin, Eye } from "lucide-react";

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
  const [acuerdosTxt, setAcuerdosTxt] = useState<string[]>([]);
  const [sugerencia, setSugerencia] = useState<{ clave: string; acto: string; etiqueta: string } | null>(null);
  const [buscoSug, setBuscoSug] = useState(false);

  // estado de configuración (cuando aún no hay tipo)
  const [tipoSel, setTipoSel] = useState("");
  const [posSel, setPosSel] = useState("");
  const [config, setConfig] = useState(false); // mostrar el configurador
  const [guardando, setGuardando] = useState(false);

  // checklist por etapa
  const [expandida, setExpandida] = useState<string | null>(null);
  const [etapasConDoc, setEtapasConDoc] = useState<Set<string>>(new Set());
  const [docsPorEtapa, setDocsPorEtapa] = useState<Record<string, { nombre: string | null; link: string | null; drive_id: string | null; mime: string | null }[]>>({});
  const [marcas, setMarcas] = useState<MarcaChecklist[]>([]);
  const [verDoc, setVerDoc] = useState<{ nombre: string | null; link: string | null; drive_id: string | null } | null>(null);

  // seguimiento procesal (bitácora + notas de estrategia)
  const [procesal, setProcesal] = useState<SeguimientoProcesal[]>([]);
  const [agregarProc, setAgregarProc] = useState(false);

  // chulear documento (pide tipo + archivo obligatorio)
  const [chulear, setChulear] = useState<{ etapa: string; doc: string } | null>(null);

  const cargarChecklist = () => {
    estadoChecklist(caso).then((r) => { setEtapasConDoc(r.etapasConDoc); setDocsPorEtapa(r.docsPorEtapa); setMarcas(r.marcas); }).catch(() => {});
    listarProcesal(caso).then(setProcesal).catch(() => {});
  };

  useEffect(() => {
    (async () => {
      setCargando(true);
      const s = await obtenerSeguimiento(caso);
      setSeg(s);
      if (s) { setTipoSel(s.tipo_juicio || ""); setPosSel(s.posicion || ""); }
      else setConfig(true); // sin configurar → pedir tipo+posición
      // último acuerdo del boletín como referencia
      if (caso.expediente) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial?select=fecha_acuerdo,texto&expediente=eq.${encodeURIComponent(caso.expediente.trim())}&order=fecha_acuerdo.desc&limit=40`, { headers: wHeaders });
        const d = r.ok ? await r.json() : [];
        setUltimoAcuerdo(d?.[0] || null);
        setAcuerdosTxt((d || []).map((x: Acuerdo) => x.texto || "").filter(Boolean));
      }
      cargarChecklist();
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

  // ¿un documento esperado ya está cubierto? (auto por etapa con doc, o palomeo manual)
  const marcaDe = (etapaClave: string, docNombre: string) => marcas.find((m) => m.etapa === etapaClave && m.doc_nombre === docNombre) || null;

  const togglePalomeo = async (etapaClave: string, docNombre: string) => {
    const m = marcaDe(etapaClave, docNombre);
    const nuevo = !(m && m.hecho);
    const res = await marcarChecklist(caso, etapaClave, docNombre, m?.id || null, nuevo);
    if (res) {
      setMarcas((prev) => {
        const sin = prev.filter((x) => x.id !== res.id && !(x.etapa === etapaClave && x.doc_nombre === docNombre));
        return [...sin, res];
      });
    }
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

                  {/* Sugerencia de avance a partir del boletín (siempre la confirmas tú) */}
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={() => { setSugerencia(sugerirEtapa([...acuerdosTxt, caso.etapa_actual], etapas)); setBuscoSug(true); }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--teal)] px-3 py-1.5 text-[11px] font-semibold"
                      style={{ color: TEAL }}
                    >
                      <Megaphone className="h-3.5 w-3.5" /> Sugerir avance desde el boletín
                    </button>
                    {sugerencia ? (
                      <div className="mt-2 rounded-lg border border-[color:var(--teal)]/40 bg-[color:var(--teal)]/5 p-2.5">
                        <p className="text-xs">El boletín sugiere avanzar a: <b>{sugerencia.etiqueta}</b> <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{sugerencia.acto}</span></p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Revísalo. Si es correcto, se marca como etapa actual y las anteriores como hechas.</p>
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={async () => { await marcarActual(sugerencia.clave); setSugerencia(null); setBuscoSug(false); }} className="rounded-md px-3 py-1.5 text-[11px] font-semibold text-white" style={{ background: TEAL }}>Aplicar como etapa actual</button>
                          <button type="button" onClick={() => { setSugerencia(null); setBuscoSug(false); }} className="rounded-md border border-input px-3 py-1.5 text-[11px] font-medium hover:bg-muted">Descartar</button>
                        </div>
                      </div>
                    ) : buscoSug ? (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">No reconocí ninguna etapa en las actuaciones del boletín. Márcala a mano abajo.</p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    {etapas.map((e) => {
                      const esActual = e.clave === etapaActual;
                      const esHecha = hechas.has(e.clave);
                      const abierta = expandida === e.clave;
                      return (
                        <div key={e.clave} className={`rounded-lg border ${esActual ? "border-[color:var(--teal)] bg-[color:var(--teal)]/5" : "border-border"}`}>
                          <div className="flex items-start gap-2 p-2.5">
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
                            <button onClick={() => setExpandida(abierta ? null : e.clave)} title="Ver documentos de esta etapa" className="mt-0.5 shrink-0 text-muted-foreground">
                              {abierta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </div>

                          {/* checklist de documentos esperados de esta etapa */}
                          {abierta && (
                            <div className="border-t border-border/60 px-3 py-2.5">
                              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Documentos que deben existir en esta etapa:</p>
                              <div className="space-y-1">
                                {e.docs.map((doc) => {
                                  const auto = etapasConDoc.has(e.clave); // hay al menos un archivo ligado a la etapa
                                  const manual = !!marcaDe(e.clave, doc.nombre)?.hecho;
                                  const cubierto = auto || manual;
                                  const docEtapa = (docsPorEtapa[e.clave] || [])[0]; // primer archivo de la etapa
                                  return (
                                    <div key={doc.nombre} className="flex items-center gap-2 text-xs">
                                      <button onClick={() => { if (cubierto && manual) { togglePalomeo(e.clave, doc.nombre); } else if (!cubierto) { setChulear({ etapa: e.clave, doc: doc.nombre }); } }} className="shrink-0" title={cubierto ? (manual ? "Quitar palomita" : "Ya cubierto por archivo") : "Chulear: subir documento"}>
                                        {cubierto ? <FileCheck2 className="h-4 w-4 text-[color:var(--teal)]" /> : <FileX2 className="h-4 w-4 text-muted-foreground" />}
                                      </button>
                                      <span className={`flex-1 ${cubierto ? "" : "text-muted-foreground"}`}>{doc.nombre}</span>
                                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{doc.acto}</span>
                                      {doc.obligatorio && <span className="text-[9px] font-semibold text-red-600">obligatorio</span>}
                                      {auto && <span className="text-[9px] text-[color:var(--teal)]">✓ por archivo</span>}
                                      {auto && docEtapa?.link && (
                                        <button onClick={() => setVerDoc(docEtapa)} title="Ver documento" className="shrink-0 grid h-6 w-6 place-items-center rounded hover:bg-muted"><Eye className="h-3.5 w-3.5 text-[color:var(--teal)]" /></button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No se encontraron las etapas de este tipo.</p>
              )}

              {/* Seguimiento procesal: bitácora + notas de estrategia, ligado a etapa */}
              {tipoDef && (
                <div className="border-t border-border pt-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: NAVY }}>
                      <ClipboardList className="h-4 w-4" style={{ color: TEAL }} /> Seguimiento procesal
                    </p>
                    <button onClick={() => setAgregarProc(true)} className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-white" style={{ background: TEAL }}>
                      <Plus className="h-3.5 w-3.5" /> Agregar
                    </button>
                  </div>
                  {procesal.length === 0 ? (
                    <p className="rounded-md bg-muted/40 p-2.5 text-center text-[11px] text-muted-foreground">Sin apuntes todavía. Agrega notas de estrategia u observaciones del juicio.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {procesal.map((p) => {
                        const et = etapas.find((e) => e.clave === p.etapa);
                        return (
                          <div key={p.id} className="rounded-md border border-border bg-muted/20 p-2.5 text-xs">
                            <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-muted-foreground">{fmt(p.fecha)}</span>
                              {et && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{et.nombre}</span>}
                              {p.tipo_acto && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "#E6F1FB", color: "#0C447C" }}>{p.tipo_acto}</span>}
                            </div>
                            <p>{p.nota}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* documentos y movimientos (también dentro del modal) */}
              <div className="border-t border-border pt-3">
                <DocumentosGarantia area={area} caso={caso} />
              </div>
            </div>
          )}
        </div>
      </div>

      {agregarProc && (
        <AgregarProcesalModal
          etapas={etapas}
          etapaActual={etapaActual}
          onClose={() => setAgregarProc(false)}
          onGuardar={async (datos) => {
            const r = await agregarProcesal(caso, datos);
            if (r) setProcesal((p) => [r, ...p]);
            setAgregarProc(false);
          }}
        />
      )}

      {chulear && (
        <ChulearDocumentoModal
          area={area} caso={caso}
          etapaClave={chulear.etapa} docNombre={chulear.doc}
          onClose={() => setChulear(null)}
          onListo={() => { setChulear(null); cargarChecklist(); }}
        />
      )}

      {verDoc && verDoc.link && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" onClick={() => setVerDoc(null)}>
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-card shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 p-3 text-white" style={{ background: NAVY }}>
              <p className="truncate text-sm font-semibold">{verDoc.nombre || "Documento"}</p>
              <button onClick={() => setVerDoc(null)} className="text-sm">Cerrar ✕</button>
            </div>
            <iframe
              src={verDoc.drive_id ? `https://drive.google.com/file/d/${verDoc.drive_id}/preview` : (verDoc.link.match(/\/d\/([^/]+)/) ? `https://drive.google.com/file/d/${verDoc.link.match(/\/d\/([^/]+)/)![1]}/preview` : verDoc.link)}
              title={verDoc.nombre || "Documento"} className="h-[70vh] w-full border-0 bg-muted" />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Sub-modal: agregar un apunte de seguimiento procesal ----
function AgregarProcesalModal({ etapas, etapaActual, onClose, onGuardar }: {
  etapas: EtapaJuicio[];
  etapaActual: string | null;
  onClose: () => void;
  onGuardar: (datos: { etapa: string; fecha: string; nota: string; tipo_acto: string }) => Promise<void>;
}) {
  const [etapa, setEtapa] = useState(etapaActual || "");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tipoActo, setTipoActo] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const ACTOS = ["promocion", "acuerdo", "audiencia", "acta", "resolucion", "nota"];

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: NAVY }}>
          <p className="flex items-center gap-2 font-semibold"><ClipboardList className="h-4 w-4" /> Agregar seguimiento procesal</p>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <label className={lbl}>Etapa del juicio</label>
            <select className={inp} value={etapa} onChange={(e) => setEtapa(e.target.value)}>
              <option value="">— elegir —</option>
              {etapas.map((e) => <option key={e.clave} value={e.clave}>{e.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Fecha</label>
              <input type="date" className={inp} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Tipo de acto</label>
              <select className={inp} value={tipoActo} onChange={(e) => setTipoActo(e.target.value)}>
                <option value="">— opcional —</option>
                {ACTOS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Nota / observación</label>
            <textarea className={inp} rows={3} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ej. Vigilar el término para apelar; el juzgado va lento con los oficios." />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button disabled={!etapa || !nota.trim() || guardando} onClick={async () => { setGuardando(true); await onGuardar({ etapa, fecha, nota: nota.trim(), tipo_acto: tipoActo }); }}
              className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: TEAL }}>
              {guardando ? <Spin className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
