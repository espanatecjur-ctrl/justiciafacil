// ============================================================
// JusticiaFácil · Registro de visitas al juzgado (UCP)
// ------------------------------------------------------------
// Antes esto solo existía como texto de contrato ("visitas a
// juzgados" dentro del servicio que se le cobra al cliente) —
// nunca se capturaba de verdad quién fue, cuándo, y qué verificó.
// Este componente sí lo guarda, ligado al caso.
// ============================================================
import { useEffect, useState } from "react";
import { Landmark, Plus, Loader2, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { correoActual } from "@/lib/auth";
import { registrarEvento } from "@/lib/cronologia-caso";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface VisitaJuzgado {
  id: string;
  caso_id: string | null;
  expediente: string | null;
  juzgado: string | null;
  fecha_visita: string;
  realizado_por: string | null;
  motivo: string | null;
  documentos_verificados: string | null;
  hallazgos: string | null;
  created_at: string;
}

const fmtFecha = (s: string | null) => {
  if (!s) return "—";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
};

export function VisitaJuzgadoSeccion({ casoId, expediente, juzgado, area = "UCP" }: {
  casoId: string; expediente?: string | null; juzgado?: string | null; area?: string;
}) {
  const [lista, setLista] = useState<VisitaJuzgado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [miCorreo, setMiCorreo] = useState("");
  const [form, setForm] = useState({ fecha_visita: new Date().toISOString().slice(0, 10), realizado_por: "", motivo: "", documentos_verificados: "", hallazgos: "" });

  useEffect(() => { correoActual().then((c) => setMiCorreo(c || "")).catch(() => {}); }, []);

  const cargar = () => {
    setCargando(true);
    fetch(`${SUPABASE_URL}/rest/v1/visita_juzgado?select=*&caso_id=eq.${casoId}&order=fecha_visita.desc`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(setLista)
      .finally(() => setCargando(false));
  };
  useEffect(cargar, [casoId]);

  const guardar = async () => {
    if (!form.fecha_visita || !form.realizado_por.trim()) return;
    setGuardando(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/visita_juzgado`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({
          caso_id: casoId, expediente: expediente || null, juzgado: juzgado || null, area,
          fecha_visita: form.fecha_visita, realizado_por: form.realizado_por.trim(),
          motivo: form.motivo.trim() || null,
          documentos_verificados: form.documentos_verificados.trim() || null,
          hallazgos: form.hallazgos.trim() || null,
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
      await registrarEvento({
        caso_id: casoId, expediente: expediente || null, area, tipo: "actuacion",
        texto: `Visita al juzgado (${fmtFecha(form.fecha_visita)}) por ${form.realizado_por.trim()}${form.motivo.trim() ? `: ${form.motivo.trim()}` : ""}`,
        autor: miCorreo || null,
      });
      setForm({ fecha_visita: new Date().toISOString().slice(0, 10), realizado_por: "", motivo: "", documentos_verificados: "", hallazgos: "" });
      setAbierto(false);
      cargar();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="legal-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#0B1E3A" }}>
          <Landmark className="h-4 w-4 text-[color:var(--teal)]" /> Visitas al juzgado
        </p>
        <button
          onClick={() => setAbierto((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" /> Registrar visita
        </button>
      </div>

      {abierto && (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Fecha de la visita</span>
              <input type="date" value={form.fecha_visita} onChange={(e) => setForm((f) => ({ ...f, fecha_visita: e.target.value }))} className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm" />
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Quién fue</span>
              <input value={form.realizado_por} onChange={(e) => setForm((f) => ({ ...f, realizado_por: e.target.value }))} placeholder="Nombre de quien visitó" className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm" />
            </label>
          </div>
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Motivo de la visita</span>
            <input value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} placeholder="Ej. Verificar documentos del expediente" className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Documentos verificados</span>
            <textarea value={form.documentos_verificados} onChange={(e) => setForm((f) => ({ ...f, documentos_verificados: e.target.value }))} placeholder="Qué se revisó físicamente en el expediente" className="min-h-[60px] w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm" />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Hallazgos / observaciones</span>
            <textarea value={form.hallazgos} onChange={(e) => setForm((f) => ({ ...f, hallazgos: e.target.value }))} placeholder="Qué se encontró (opcional)" className="min-h-[60px] w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm" />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              onClick={guardar}
              disabled={guardando || !form.fecha_visita || !form.realizado_por.trim()}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              style={{ background: "#0C5C46" }}
            >
              {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />} Guardar visita
            </button>
            <button onClick={() => setAbierto(false)} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">Cancelar</button>
          </div>
        </div>
      )}

      {cargando ? (
        <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="text-xs text-muted-foreground">Todavía no hay visitas registradas para este expediente.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((v) => (
            <div key={v.id} className="rounded-md bg-muted/40 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="font-semibold">{fmtFecha(v.fecha_visita)}</span>
                <span className="text-xs text-muted-foreground">{v.realizado_por || "—"}</span>
              </div>
              {v.motivo && <p className="mt-1 text-xs text-muted-foreground">{v.motivo}</p>}
              {v.documentos_verificados && <p className="mt-1 text-xs"><span className="font-medium">Verificó:</span> {v.documentos_verificados}</p>}
              {v.hallazgos && <p className="mt-1 text-xs"><span className="font-medium">Hallazgos:</span> {v.hallazgos}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
