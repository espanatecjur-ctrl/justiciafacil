import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Search, ArrowUpDown, FileText, MoreVertical, FolderOpen, Trash2, Upload, RefreshCw, ArrowLeft, Download, CheckCircle2, UserCheck } from "lucide-react";
import type { Semaforo } from "@/lib/urrj-motores";
import { SubirDocModal, ListaDocs } from "@/components/docs-predictamen";
import { cargarPermisosURRJ } from "@/lib/urrj-permisos";
import { ReasignarModal } from "@/components/reasignar-abogado";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export interface Fila {
  id: string; folio: string | null; posicion: string | null; tipo_juicio: string | null;
  expediente: string | null; juzgado: string | null; estado: string | null;
  dictamen_sugerido: string | null; dictamen_final: string | null; created_at: string;
  datos: any; resultados: any; vigente?: boolean; cambios?: string | null; version?: number; terminado?: boolean;
  abogado_id?: string | null; abogado_nombre?: string | null;
}

const POS_COLOR: Record<string, string> = {
  Actor: "bg-emerald-100 text-emerald-800", Demandado: "bg-blue-100 text-blue-800", Sucesorio: "bg-amber-100 text-amber-800",
  Contingencia: "bg-purple-100 text-purple-800", Tramites: "bg-slate-100 text-slate-800",
};
function dicColor(d?: string | null) {
  if (!d) return "text-muted-foreground";
  if (d.includes("POSITIVO") || (d.includes("RECUPERABLE") && !d.includes("NO"))) return "text-emerald-700";
  if (d.includes("NEGATIVO") || d.includes("NO LITIGABLE")) return "text-red-700";
  return "text-amber-700";
}
function semColor(s: Semaforo) {
  return s === "verde" ? "#0C5C46" : s === "amarillo" ? "#C2A24C" : s === "naranja" ? "#D97706" : s === "rojo" ? "#DC2626" : "#9CA3AF";
}

export function HistorialPredictamen({ onReDictaminar }: { onReDictaminar?: (f: Fila) => void }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState<{ col: string; asc: boolean }>({ col: "created_at", asc: false });
  const [menu, setMenu] = useState<string | null>(null);
  const [subirDoc, setSubirDoc] = useState<Fila | null>(null);
  const [reasignar, setReasignar] = useState<Fila | null>(null);
  const [puede, setPuede] = useState<string[]>([]);
  useEffect(() => { cargarPermisosURRJ().then((p) => setPuede(p.acciones)); }, []);
  const can = (a: string) => puede.length === 0 || puede.includes(a);
  const navigate = useNavigate();
  const abrirFicha = (f: Fila) => navigate({ to: "/ficha", search: { id: f.id } });

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=*&en_papelera=eq.false&vigente=eq.true&order=created_at.desc&limit=500`, { headers })
      .then((r) => (r.ok ? r.json() : [])).then(setFilas).catch(() => {}).finally(() => setCargando(false));
  }, []);
  useEffect(() => {
    const fn = () => setMenu(null);
    document.addEventListener("click", fn);
    return () => document.removeEventListener("click", fn);
  }, []);

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    let arr = filas;
    if (t) arr = filas.filter((f) => [f.folio, f.posicion, f.tipo_juicio, f.expediente, f.juzgado, f.estado, f.dictamen_sugerido, f.dictamen_final, f.datos?.ubicacion, f.datos?.deudor, f.datos?.deCujus, f.datos?.heredero, f.datos?.acreedor].filter(Boolean).join(" ").toLowerCase().includes(t));
    const c = orden.col;
    return [...arr].sort((a: any, b: any) => { const va = (a[c] ?? "").toString(); const vb = (b[c] ?? "").toString(); return orden.asc ? va.localeCompare(vb) : vb.localeCompare(va); });
  }, [filas, q, orden]);

  const dir = (f: Fila) => f.datos?.ubicacion || "—";
  const fecha = (s: string) => new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

  const Th = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <th className="sticky top-0 z-10 cursor-pointer select-none border-b border-border bg-muted/70 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      onClick={() => setOrden((o) => ({ col, asc: o.col === col ? !o.asc : true }))}>
      <span className="inline-flex items-center gap-1">{children}<ArrowUpDown className="h-3 w-3 opacity-40" /></span>
    </th>
  );
  const Item = ({ icon: Ic, children, onClick, danger }: any) => (
    <button onClick={onClick} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted ${danger ? "text-red-600" : ""}`}>
      <Ic className="h-4 w-4" /> {children}
    </button>
  );

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Historial de pre-dictámenes</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{filtradas.length}</span>
        </div>
        <div className="relative w-48 sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por cualquier cosa…" className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm" />
        </div>
      </div>

      <div className="max-h-[440px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th col="folio">Folio</Th><Th col="posicion">Posición</Th><Th col="ubicacion">Garantía / dirección</Th>
              <Th col="expediente">Expediente</Th><Th col="estado">Estado</Th><Th col="abogado_nombre">Abogado</Th><Th col="dictamen_sugerido">Dictamen</Th>
              <Th col="dictamen_final">Decisión</Th><Th col="created_at">Fecha</Th>
              <th className="sticky top-0 z-10 border-b border-border bg-muted/70 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Cargando…</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">{q ? "Sin resultados." : "Aún no hay pre-dictámenes guardados."}</td></tr>
            ) : filtradas.map((f) => (
              <tr key={f.id} className="border-b border-border/60 hover:bg-muted/40">
                <td className="cursor-pointer px-3 py-2 font-mono text-[12px] font-medium text-[color:var(--teal)] hover:underline" onClick={() => abrirFicha(f)}>{f.folio || "—"}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${POS_COLOR[f.posicion || ""] || "bg-muted"}`}>{f.posicion || "—"}</span>{f.terminado && <span className="ml-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">TERMINADO</span>}</td>
                <td className="max-w-[220px] truncate px-3 py-2">{dir(f)}</td>
                <td className="px-3 py-2">{f.expediente || "—"}</td>
                <td className="px-3 py-2">{f.estado || "—"}</td>
                <td className="px-3 py-2 text-[13px]">{f.abogado_nombre || <span className="text-muted-foreground">— sin asignar —</span>}</td>
                <td className={`px-3 py-2 text-[12px] font-medium ${dicColor(f.dictamen_sugerido)}`}>{f.dictamen_sugerido || "—"}</td>
                <td className="px-3 py-2 text-[12px]">{f.dictamen_final || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fecha(f.created_at)}</td>
                <td className="relative px-2 py-2 text-right">
                  <button onClick={(e) => { e.stopPropagation(); setMenu(menu === f.id ? null : f.id); }} className="rounded-md p-1 hover:bg-muted"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
                  {menu === f.id && (
                    <div onClick={(e) => e.stopPropagation()} className="absolute right-2 top-9 z-20 w-52 rounded-lg border border-border bg-card p-1.5 shadow-xl">
                      <Item icon={FolderOpen} onClick={() => { setMenu(null); abrirFicha(f); }}>Abrir ficha</Item>
                      {!f.terminado && can("reasignar") && <Item icon={UserCheck} onClick={() => { setMenu(null); setReasignar(f); }}>Reasignar abogado</Item>}
                      {can("editar") && <Item icon={Upload} onClick={() => { setMenu(null); setSubirDoc(f); }}>Subir documento / actuación</Item>}
                      {!f.terminado && can("reelaborar") && <Item icon={RefreshCw} onClick={() => { setMenu(null); if (confirm("¿Crear una versión nueva? La actual quedará como antecedente.")) onReDictaminar?.(f); }}>Mandar a re-pre-dictaminar</Item>}
                      {!f.terminado && can("terminar") && <Item icon={CheckCircle2} onClick={async () => {
                        setMenu(null);
                        if (!confirm("¿Dar por TERMINADO este pre-dictamen? Es definitivo: ya no se podrá re-pre-dictaminar.")) return;
                        try {
                          const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${f.id}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ terminado: true }) });
                          if (!res.ok) throw new Error();
                          setFilas((prev) => prev.map((x) => x.id === f.id ? { ...x, terminado: true } : x));
                        } catch { alert("No se pudo marcar como terminado."); }
                      }}>Dar por terminado</Item>}
                      <div className="my-1 border-t border-border" />
                      {can("papelera") && <Item icon={Trash2} danger onClick={async () => {
                        setMenu(null);
                        if (!confirm("¿Enviar este pre-dictamen a la papelera?")) return;
                        try {
                          const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${f.id}`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ en_papelera: true, papelera_fecha: new Date().toISOString() }) });
                          if (!res.ok) throw new Error();
                          setFilas((prev) => prev.filter((x) => x.id !== f.id));
                        } catch { alert("No se pudo enviar a la papelera."); }
                      }}>Enviar a papelera</Item>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {subirDoc && <SubirDocModal predictamenId={subirDoc.id} folio={subirDoc.folio} onClose={() => setSubirDoc(null)} />}
      {reasignar && <ReasignarModal predictamenId={reasignar.id} materia={reasignar.tipo_juicio} actual={reasignar.abogado_nombre} onClose={() => setReasignar(null)} onAsignado={(nombre) => setFilas((prev) => prev.map((x) => x.id === reasignar.id ? { ...x, abogado_nombre: nombre } : x))} />}
    </div>
  );
}

// ---------------- Ficha de garantía ----------------
export function FichaGarantia({ f, onVolver }: { f: Fila; onVolver: () => void }) {
  const [subir, setSubir] = useState(false);
  const [refresco, setRefresco] = useState(0);
  const [versiones, setVersiones] = useState<Fila[]>([]);
  const [verVieja, setVerVieja] = useState<Fila | null>(null);

  useEffect(() => {
    let activo = true;
    (async () => {
      const out: Fila[] = [];
      let target = f.id;
      for (let i = 0; i < 20; i++) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=*&antecedente_de=eq.${target}`, { headers }).then((x) => (x.ok ? x.json() : [])).catch(() => []);
        if (!r.length) break;
        out.push(r[0]); target = r[0].id;
      }
      if (activo) setVersiones(out);
    })();
    return () => { activo = false; };
  }, [f.id]);

  if (verVieja) return <FichaGarantia f={verVieja} onVolver={() => setVerVieja(null)} />;

  const d = f.datos || {};
  const res = f.resultados || {};
  const fmt = (v: number) => (v || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  const dicColorBox = f.dictamen_sugerido?.includes("POSITIVO") || (f.dictamen_sugerido?.includes("RECUPERABLE") && !f.dictamen_sugerido?.includes("NO")) ? "bg-emerald-50 text-emerald-800 border-emerald-200" : f.dictamen_sugerido?.includes("NEGATIVO") || f.dictamen_sugerido?.includes("NO LITIGABLE") ? "bg-red-50 text-red-800 border-red-200" : "bg-amber-50 text-amber-800 border-amber-200";

  const riesgos = Object.entries(res).filter(([k, v]: any) => v && typeof v === "object" && v.semaforo).map(([k, v]: any) => ({ k, v }));
  const firmas = res.firmas || {};
  const fin = res.financiero; const vaae = res.vaae;

  const descargar = async () => {
    const { descargarPredictamenPDF } = await import("@/lib/predictamen-pdf");
    await descargarPredictamenPDF({
      expediente: f.expediente || "", juzgado: f.juzgado || "", estado: f.estado || "", tipoJuicio: f.tipo_juicio || "", posicion: f.posicion || "",
      ubicacion: d.ubicacion || "", deudor: d.deudor || d.deCujus || "", quienCede: d.quienCede || d.acreedor || d.heredero || "", queCede: d.queCede || "Derechos",
      dictamen: f.dictamen_sugerido || "", riesgos: riesgos.map((r) => ({ nombre: r.k, r: r.v })),
      intereses: fin ? { ordinarios: fin.ordinarios, moratorios: fin.moratorios, iva: fin.iva, total: fin.totalDeuda, udis: fin.udis, usura: fin.alertaUsura } : { ordinarios: 0, moratorios: 0, iva: 0, total: vaae?.vaae || 0, usura: false },
      admin: null, anotaciones: d.anotacionesHumanas || d.anotaciones || "", firmaElabora: firmas.elabora || null, firmaValida: firmas.valida || null, decision: f.dictamen_final || "",
      noValido: f.vigente === false,
      cambios: (() => { try { return f.cambios ? JSON.parse(f.cambios) : null; } catch { return null; } })(),
    });
  };

  const Dato = ({ k, v }: { k: string; v: any }) => v ? <div className="flex gap-2 py-1 text-sm"><span className="w-44 shrink-0 text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div> : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onVolver} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:underline"><ArrowLeft className="h-4 w-4" /> Volver al historial</button>
        <button onClick={descargar} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted" style={{ borderColor: "#C2A24C" }}><Download className="h-4 w-4" style={{ color: "#C2A24C" }} /> Descargar PDF</button>
      </div>

      <div className="rounded-xl p-5 text-white" style={{ background: "linear-gradient(135deg,#0B1E3A,#0C5C46)" }}>
        <p className="font-mono text-sm text-white/80">{f.folio}</p>
        <h2 className="mt-1 text-xl font-bold">{d.ubicacion || f.expediente || "Pre-dictamen"}</h2>
        <p className="text-sm text-white/70">{f.posicion} · {f.tipo_juicio} · {f.estado}</p>
        {f.terminado && <span className="mt-2 inline-block rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">✓ TERMINADO</span>}
      </div>

      <div className={`rounded-lg border p-4 ${dicColorBox}`}>
        <p className="text-sm font-semibold">Dictamen del sistema: {f.dictamen_sugerido || "—"}</p>
        <p className="mt-0.5 text-sm">Decisión humana: <b>{f.dictamen_final || "—"}</b></p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">Datos de la garantía</p>
        <Dato k="Folio" v={f.folio} /><Dato k="Abogado responsable" v={f.abogado_nombre} /><Dato k="Expediente" v={f.expediente} /><Dato k="Juzgado" v={f.juzgado} />
        <Dato k="Estado" v={f.estado} /><Dato k="Dirección / garantía" v={d.ubicacion} /><Dato k="Deudor / de cujus" v={d.deudor || d.deCujus} />
        <Dato k="Quién cede / acreedor" v={d.quienCede || d.acreedor || d.heredero} /><Dato k="Qué se cede" v={d.queCede} /><Dato k="RFC" v={d.rfc} />
      </div>

      {riesgos.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-semibold">Auditores / riesgos</p>
          <div className="space-y-2">
            {riesgos.map(({ k, v }) => (
              <div key={k} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center gap-2 font-medium"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: semColor(v.semaforo) }} />{v.etiqueta}{v.dato ? <span className="font-normal text-muted-foreground">· {v.dato}</span> : null}</div>
                <p className="mt-1 text-[13px] text-muted-foreground">{v.detalle}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(fin || vaae) && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="mb-2 font-semibold">{fin ? "Intereses" : "V_AAE"}</p>
          {fin && <div className="space-y-0.5"><div>Ordinarios: <b>{fmt(fin.ordinarios)}</b></div><div>Moratorios: <b>{fmt(fin.moratorios)}</b></div><div>Total deuda: <b>{fmt(fin.totalDeuda)}</b></div></div>}
          {vaae && <div>V_AAE (máximo a pagar): <b>{fmt(vaae.vaae)}</b></div>}
        </div>
      )}

      {(d.anotacionesHumanas || d.anotaciones) && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="mb-1 font-semibold">Anotaciones del abogado</p>
          <p className="whitespace-pre-wrap text-muted-foreground">{d.anotacionesHumanas || d.anotaciones}</p>
        </div>
      )}

      {(firmas.elabora || firmas.valida) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {["elabora", "valida"].map((key) => { const fi = firmas[key]; if (!fi) return null; return (
            <div key={key} className="rounded-xl border border-border bg-card p-4">
              <p className="mb-1 text-xs text-muted-foreground">{key === "elabora" ? "Elabora · abogado URRJ" : "Valida · Director Legal"}</p>
              {fi.dibujo && <img src={fi.dibujo} alt="firma" className="mb-1 h-14 w-auto rounded border border-border bg-white" />}
              <p className="text-sm font-semibold text-[color:var(--teal)]">{fi.nombre}</p>
              {fi.cargo && <p className="text-xs text-muted-foreground">{fi.cargo}</p>}
              {fi.fecha && <p className="text-[11px] text-muted-foreground">Firmado: {new Date(fi.fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</p>}
            </div>
          ); })}
        </div>
      )}

      {versiones.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-semibold">Versiones anteriores <span className="text-xs font-normal text-muted-foreground">({versiones.length})</span></p>
          <div className="space-y-2">
            {versiones.map((v) => (
              <button key={v.id} onClick={() => setVerVieja(v)} className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="font-mono text-[12px] font-medium">{v.folio || "—"} <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-sans font-semibold text-red-700">NO VÁLIDO</span></p>
                  <p className="text-xs text-muted-foreground">Versión {v.version || "?"} · {v.dictamen_final || v.dictamen_sugerido || "—"} · {new Date(v.created_at).toLocaleDateString("es-MX")}</p>
                </div>
                <span className="shrink-0 text-xs text-[color:var(--teal)]">Ver ficha →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Documentos y actuaciones</p>
          <button onClick={() => setSubir(true)} className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"><Upload className="h-3.5 w-3.5" /> Subir documento</button>
        </div>
        <ListaDocs predictamenId={f.id} refresco={refresco} />
      </div>

      {subir && <SubirDocModal predictamenId={f.id} folio={f.folio} onClose={() => setSubir(false)} onSubido={() => setRefresco((r) => r + 1)} />}
    </div>
  );
}
