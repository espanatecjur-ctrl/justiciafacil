import { useEffect, useRef, useState } from "react";
import { BotonVerDoc } from "@/components/visor-documento";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { getAuth } from "@/lib/auth";
import {
  ClipboardList, Plus, Loader2, Paperclip, DollarSign, CheckSquare,
  CalendarClock, Trash2, X, Upload, FileText,
} from "lucide-react";

const TEAL = "#0C5C46";
const wHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface Evidencia {
  id: string;
  caso_id: string | null;
  expediente: string | null;
  fecha: string | null;
  nota: string | null;
  nombre_documento: string | null;
  documento_url: string | null;
  tiene_valor: boolean | null;
  valor: number | null;
  tarea: string | null;
  tarea_asignado: string | null;
  proxima_actuacion: string | null;
  proxima_fecha: string | null;
  creado_por: string | null;
  created_at: string | null;
}

const fmt = (s: string | null) => {
  if (!s) return "—";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dinero = (n: number | null) =>
  n == null ? "" : n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

export function EvidenciaSeguimiento({ casoId, expediente, abrirNueva }: { casoId: string; expediente: string | null; abrirNueva?: boolean }) {
  const [lista, setLista] = useState<Evidencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // campos del formulario
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState("");
  const [nombreDoc, setNombreDoc] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [tieneValor, setTieneValor] = useState(false);
  const [valor, setValor] = useState("");
  const [tarea, setTarea] = useState("");
  const [tareaAsig, setTareaAsig] = useState("");
  const [proxAct, setProxAct] = useState("");
  const [proxFecha, setProxFecha] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = () => {
    fetch(`${SUPABASE_URL}/rest/v1/evidencia_seguimiento?select=*&caso_id=eq.${casoId}&order=fecha.desc,created_at.desc`, { headers: wHeaders })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLista(d || []))
      .catch(() => setLista([]))
      .finally(() => setCargando(false));
  };
  useEffect(() => { cargar(); }, [casoId]);
  useEffect(() => { if (abrirNueva) setForm(true); }, [abrirNueva]);

  const limpiar = () => {
    setFecha(hoyISO()); setNota(""); setNombreDoc(""); setArchivo(null);
    setTieneValor(false); setValor(""); setTarea(""); setTareaAsig("");
    setProxAct(""); setProxFecha(""); setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const guardar = async () => {
    if (!nota.trim() && !nombreDoc.trim() && !archivo && !tarea.trim()) {
      setError("Pon al menos una nota, un documento o una tarea."); return;
    }
    setGuardando(true); setError(null);
    try {
      // 1) subir archivo (si hay) al almacén "evidencias"
      let documento_url: string | null = null;
      if (archivo) {
        const limpio = archivo.name.replace(/[^\w.\-]/g, "_");
        const path = `${casoId}/${Date.now()}_${limpio}`;
        const up = await fetch(`${SUPABASE_URL}/storage/v1/object/evidencias/${path}`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": archivo.type || "application/octet-stream" },
          body: archivo,
        });
        if (!up.ok) throw new Error("No se pudo subir el archivo (" + up.status + ").");
        documento_url = `${SUPABASE_URL}/storage/v1/object/public/evidencias/${path}`;
      }

      // 2) correo del usuario (para creado_por)
      let creado_por: string | null = null;
      try { const a = await getAuth(); const { data } = await a.auth.getSession(); creado_por = data.session?.user?.email ?? null; } catch { /* opcional */ }

      // 3) guardar el registro
      const body = {
        caso_id: casoId,
        expediente: expediente || null,
        fecha: fecha || null,
        nota: nota.trim() || null,
        nombre_documento: nombreDoc.trim() || (archivo ? archivo.name : null),
        documento_url,
        tiene_valor: tieneValor,
        valor: tieneValor && valor ? Number(valor) : null,
        tarea: tarea.trim() || null,
        tarea_asignado: tareaAsig.trim() || null,
        proxima_actuacion: proxAct.trim() || null,
        proxima_fecha: proxFecha || null,
        creado_por,
      };
      const r = await fetch(`${SUPABASE_URL}/rest/v1/evidencia_seguimiento`, {
        method: "POST", headers: { ...wHeaders, Prefer: "return=minimal" }, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("No se pudo guardar (" + r.status + ").");
      limpiar(); setForm(false); setCargando(true); cargar();
    } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
  };

  const borrar = async (id: string) => {
    if (!confirm("¿Borrar esta evidencia?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/evidencia_seguimiento?id=eq.${id}`, { method: "DELETE", headers: wHeaders }).catch(() => {});
    setLista((p) => p.filter((x) => x.id !== id));
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#0B1E3A" }}>
          <ClipboardList className="h-4 w-4" style={{ color: TEAL }} /> Seguimiento (evidencia)
        </p>
        {!form && (
          <button onClick={() => setForm(true)} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ background: TEAL }}>
            <Plus className="h-3.5 w-3.5" /> Agregar evidencia
          </button>
        )}
      </div>

      {/* Formulario */}
      {form && (
        <div className="mb-4 rounded-lg border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: TEAL }}>Nueva evidencia</p>
            <button onClick={() => { setForm(false); limpiar(); }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Fecha de la actuación</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Nombre del documento</label>
              <input value={nombreDoc} onChange={(e) => setNombreDoc(e.target.value)} placeholder="ej. Acuerdo de remate" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="mt-2">
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Nota / observación</label>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="¿Qué pasó en esta actuación?" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>

          {/* Documento (archivo) */}
          <div className="mt-2">
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Documento (PDF o foto)</label>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-xs hover:bg-muted">
              <Upload className="h-3.5 w-3.5" /> {archivo ? archivo.name : "Elegir archivo…"}
            </button>
          </div>

          {/* Valor */}
          <div className="mt-2 flex items-center gap-2">
            <input id="tv" type="checkbox" checked={tieneValor} onChange={(e) => setTieneValor(e.target.checked)} className="h-4 w-4" />
            <label htmlFor="tv" className="text-xs">¿Trae algún valor?</label>
            {tieneValor && (
              <input value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Monto $" inputMode="decimal" className="ml-2 w-40 rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
            )}
          </div>

          {/* Tarea */}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Tarea sobre la actuación</label>
              <input value={tarea} onChange={(e) => setTarea(e.target.value)} placeholder="¿Qué hay que hacer?" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Asignar a (opcional)</label>
              <input value={tareaAsig} onChange={(e) => setTareaAsig(e.target.value)} placeholder="Nombre / correo" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Próxima actuación */}
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_160px]">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Próxima actuación</label>
              <input value={proxAct} onChange={(e) => setProxAct(e.target.value)} placeholder="ej. Audiencia de remate" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Fecha próxima</label>
              <input type="date" value={proxFecha} onChange={(e) => setProxFecha(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setForm(false); limpiar(); }} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
              {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : <><Plus className="h-4 w-4" /> Guardar evidencia</>}
            </button>
          </div>
        </div>
      )}

      {/* Lista de mini-baners */}
      {cargando ? (
        <p className="py-4 text-center text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Aún no hay evidencia registrada. Usa "Agregar evidencia".</p>
      ) : (
        <div className="space-y-2">
          {lista.map((e) => (
            <div key={e.id} className="rounded-lg border-l-4 border-[color:var(--teal)] bg-muted/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold" style={{ color: TEAL }}>{fmt(e.fecha)}</span>
                <button onClick={() => borrar(e.id)} className="text-muted-foreground hover:text-red-600" title="Borrar evidencia"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              {e.nota && <p className="mt-0.5 text-sm">{e.nota}</p>}

              <div className="mt-2 flex flex-wrap gap-1.5">
                {e.documento_url && (
                  <BotonVerDoc url={e.documento_url} nombre={e.nombre_documento || "Documento"} label={e.nombre_documento || "Documento"} icon={false} className="inline-flex items-center gap-1 rounded-full bg-[color:var(--teal)]/10 px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--teal)] hover:underline" />
                )}
                {!e.documento_url && e.nombre_documento && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    <FileText className="h-3 w-3" /> {e.nombre_documento}
                  </span>
                )}
                {e.tiene_valor && e.valor != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                    <DollarSign className="h-3 w-3" /> {dinero(e.valor)}
                  </span>
                )}
                {e.tarea && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                    <CheckSquare className="h-3 w-3" /> {e.tarea}{e.tarea_asignado ? ` · ${e.tarea_asignado}` : ""}
                  </span>
                )}
                {e.proxima_actuacion && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-800">
                    <CalendarClock className="h-3 w-3" /> {e.proxima_actuacion}{e.proxima_fecha ? ` · ${fmt(e.proxima_fecha)}` : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
