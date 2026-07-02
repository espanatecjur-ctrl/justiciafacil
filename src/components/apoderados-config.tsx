// ============================================================
//  ApoderadosConfig · Administrar apoderados (agregar/editar/borrar)
// ------------------------------------------------------------
//  Guarda en la tabla `apoderado` de Supabase. Requiere haber
//  corrido el SQL de la Fase 5. Sin tocar código: desde aquí se
//  dan de alta los que firman por la empresa.
// ============================================================
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { TIPOS_PODER } from "@/lib/apoderados";
import type { ApoderadoRow } from "@/lib/apoderados";
import { UserPlus, Pencil, Trash2, X, Loader2, ScrollText, Save } from "lucide-react";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

type Borrador = Partial<ApoderadoRow>;

const vacio: Borrador = {
  nombre: "", cargo: "", empresa: "", tipo_poder: "",
  escritura_numero: "", volumen: "", libro: "", fecha_poder: "",
  notario: "", numero_notaria: "", estado_notaria: "", rfc: "", curp: "", activo: true,
};

export function ApoderadosConfig() {
  const [lista, setLista] = useState<ApoderadoRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = () => {
    setCargando(true);
    fetch(`${SUPABASE_URL}/rest/v1/apoderado?select=*&order=nombre.asc`, { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Supabase ${r.status}`))))
      .then((d) => setLista(d))
      .catch((e) => setError(e.message + " (¿corriste el SQL de la Fase 5 — tabla apoderado?)"))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  const guardar = async () => {
    if (!editando?.nombre) { setError("El nombre del apoderado es obligatorio."); return; }
    setGuardando(true);
    setError(null);
    const payload = {
      nombre: editando.nombre,
      cargo: editando.cargo || null,
      empresa: editando.empresa || null,
      tipo_poder: editando.tipo_poder || null,
      escritura_numero: editando.escritura_numero || null,
      volumen: editando.volumen || null,
      libro: editando.libro || null,
      fecha_poder: editando.fecha_poder || null,
      notario: editando.notario || null,
      numero_notaria: editando.numero_notaria || null,
      estado_notaria: editando.estado_notaria || null,
      rfc: editando.rfc || null,
      curp: editando.curp || null,
      activo: editando.activo ?? true,
    };
    try {
      const res = editando.id
        ? await fetch(`${SUPABASE_URL}/rest/v1/apoderado?id=eq.${editando.id}`, {
            method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(payload),
          })
        : await fetch(`${SUPABASE_URL}/rest/v1/apoderado`, {
            method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      setEditando(null);
      cargar();
    } catch (e) {
      setError("No se pudo guardar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (a: ApoderadoRow) => {
    if (!confirm(`¿Quitar al apoderado ${a.nombre}?`)) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/apoderado?id=eq.${a.id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      cargar();
    } catch (e) {
      setError("No se pudo quitar: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const set = (k: keyof ApoderadoRow, v: string | boolean) =>
    setEditando((s) => ({ ...(s ?? {}), [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Personas facultadas para firmar a nombre de la empresa. Se usan en el Editor de Contratos.
        </p>
        {!editando && (
          <Button size="sm" onClick={() => setEditando({ ...vacio })}
            className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
            <UserPlus className="h-4 w-4 mr-1.5" /> Nuevo apoderado
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
      )}

      {/* Formulario alta/edición */}
      {editando && (
        <Card className="legal-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display font-bold text-sm flex items-center gap-1.5">
              <ScrollText className="h-4 w-4 text-[color:var(--teal)]" />
              {editando.id ? "Editar apoderado" : "Nuevo apoderado"}
            </p>
            <button onClick={() => setEditando(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Campo label="Nombre completo *"><Input value={editando.nombre ?? ""} onChange={(e) => set("nombre", e.target.value)} /></Campo>
            <Campo label="Cargo (cómo firma)"><Input value={editando.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} placeholder="Apoderado Legal / Representante Legal" /></Campo>
            <Campo label="Empresa que representa" full><Input value={editando.empresa ?? ""} onChange={(e) => set("empresa", e.target.value)} /></Campo>
            <Campo label="Tipo de poder" full>
              <Input list="tipos-poder" value={editando.tipo_poder ?? ""} onChange={(e) => set("tipo_poder", e.target.value)} placeholder="Selecciona un tipo o escríbelo…" />
              <datalist id="tipos-poder">
                {TIPOS_PODER.map((t) => <option key={t} value={t} />)}
              </datalist>
            </Campo>

            <div className="md:col-span-2 mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Escritura del poder</div>
            <Campo label="No. de escritura"><Input value={editando.escritura_numero ?? ""} onChange={(e) => set("escritura_numero", e.target.value)} /></Campo>
            <Campo label="Fecha del poder"><Input value={editando.fecha_poder ?? ""} onChange={(e) => set("fecha_poder", e.target.value)} placeholder="12 de marzo de 2026" /></Campo>
            <Campo label="Volumen"><Input value={editando.volumen ?? ""} onChange={(e) => set("volumen", e.target.value)} /></Campo>
            <Campo label="Libro"><Input value={editando.libro ?? ""} onChange={(e) => set("libro", e.target.value)} /></Campo>
            <Campo label="Notario"><Input value={editando.notario ?? ""} onChange={(e) => set("notario", e.target.value)} /></Campo>
            <Campo label="No. de notaría"><Input value={editando.numero_notaria ?? ""} onChange={(e) => set("numero_notaria", e.target.value)} /></Campo>
            <Campo label="Estado de la notaría"><Input value={editando.estado_notaria ?? ""} onChange={(e) => set("estado_notaria", e.target.value)} /></Campo>
            <Campo label="RFC (opcional)"><Input value={editando.rfc ?? ""} onChange={(e) => set("rfc", e.target.value)} /></Campo>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editando.activo ?? true} onChange={(e) => set("activo", e.target.checked)} />
            Activo (aparece en el selector de contratos)
          </label>

          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={guardar} disabled={guardando}
              className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
              {guardando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Guardar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {/* Lista */}
      {cargando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay apoderados. Agrega el primero con el botón de arriba.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {lista.map((a) => (
            <Card key={a.id} className="legal-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display font-bold text-sm">{a.nombre}</p>
                  <p className="text-xs text-muted-foreground">{a.cargo || "—"}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditando({ ...a })} title="Editar" className="p-1.5 rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => borrar(a)} title="Quitar" className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-foreground/80">
                Escritura No. {a.escritura_numero || "—"} · {a.fecha_poder || "—"}<br />
                {a.notario || "—"} · Notaría {a.numero_notaria || "—"}, {a.estado_notaria || "—"}
              </p>
              {!a.activo && <span className="mt-2 inline-block rounded bg-zinc-200 px-2 py-0.5 text-[10px] text-zinc-700">Inactivo</span>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Campo({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <Label className="text-xs font-medium">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
