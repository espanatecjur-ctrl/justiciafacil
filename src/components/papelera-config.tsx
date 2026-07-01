import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { RotateCcw, Trash2, FileText, FileBox } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

interface Fila {
  id: string; folio: string | null; posicion: string | null; expediente: string | null;
  estado: string | null; dictamen_sugerido: string | null; papelera_fecha: string | null; datos: any;
}

interface DocFila {
  id: string; nombre: string | null; tipo: string | null; expediente: string | null;
  papelera_fecha: string | null; link: string | null;
}

export function PapeleraConfig() {
  // pre-dictámenes en papelera
  const [filas, setFilas] = useState<Fila[]>([]);
  // documentos / movimientos en papelera
  const [docs, setDocs] = useState<DocFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = () => {
    setCargando(true);
    // 1) pre-dictámenes
    const p1 = fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id,folio,posicion,expediente,estado,dictamen_sugerido,papelera_fecha,datos&en_papelera=eq.true&order=papelera_fecha.desc`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(setFilas).catch(() => {});
    // 2) documentos / movimientos
    const p2 = fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?select=id,nombre,tipo,expediente,papelera_fecha,link&en_papelera=eq.true&order=papelera_fecha.desc`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(setDocs).catch(() => {});
    Promise.all([p1, p2]).finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  // ---- pre-dictámenes ----
  const recuperar = async (f: Fila) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${f.id}`, { method: "PATCH", headers, body: JSON.stringify({ en_papelera: false, papelera_fecha: null }) });
      if (!res.ok) throw new Error();
      setFilas((p) => p.filter((x) => x.id !== f.id));
    } catch { setError("No se pudo recuperar."); }
  };
  const borrar = async (f: Fila) => {
    if (!confirm(`¿Borrar DEFINITIVO ${f.folio || "este pre-dictamen"}? Esto no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${f.id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error();
      setFilas((p) => p.filter((x) => x.id !== f.id));
    } catch { setError("No se pudo borrar."); }
  };

  // ---- documentos / movimientos ----
  const recuperarDoc = async (d: DocFila) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?id=eq.${d.id}`, { method: "PATCH", headers, body: JSON.stringify({ en_papelera: false, papelera_fecha: null }) });
      if (!res.ok) throw new Error();
      setDocs((p) => p.filter((x) => x.id !== d.id));
    } catch { setError("No se pudo recuperar el documento."); }
  };
  const borrarDoc = async (d: DocFila) => {
    if (!confirm(`¿Borrar DEFINITIVO "${d.nombre || "este documento"}"? Esto no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?id=eq.${d.id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error();
      setDocs((p) => p.filter((x) => x.id !== d.id));
    } catch { setError("No se pudo borrar el documento."); }
  };

  const fecha = (s: string | null) => s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const total = filas.length + docs.length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{cargando ? "Cargando…" : `${total} en la papelera`} · lo enviado aquí no aparece en las listas, pero se puede recuperar.</p>
      {error && <Card className="legal-card p-4 border-amber-200 bg-amber-50 text-sm text-amber-800">{error}</Card>}

      {!cargando && total === 0 && (
        <Card className="legal-card p-8 text-center text-muted-foreground">La papelera está vacía.</Card>
      )}

      {/* Sección 1: pre-dictámenes */}
      {filas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pre-dictámenes ({filas.length})</p>
          {filas.map((f) => (
            <Card key={f.id} className="legal-card flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-mono text-[12px] font-medium">{f.folio || "—"} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-sans">{f.posicion}</span></p>
                  <p className="text-xs text-muted-foreground">{f.datos?.ubicacion || f.expediente || "—"} · enviado {fecha(f.papelera_fecha)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => recuperar(f)} className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"><RotateCcw className="h-3.5 w-3.5" /> Recuperar</button>
                <button onClick={() => borrar(f)} className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Borrar definitivo</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Sección 2: documentos y movimientos */}
      {docs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documentos y movimientos ({docs.length})</p>
          {docs.map((d) => (
            <Card key={d.id} className="legal-card flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-3">
                <FileBox className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[13px] font-medium">{d.nombre || "Documento sin nombre"} {d.tipo && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px]">{d.tipo}</span>}</p>
                  <p className="text-xs text-muted-foreground">{d.expediente || "—"} · enviado {fecha(d.papelera_fecha)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => recuperarDoc(d)} className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"><RotateCcw className="h-3.5 w-3.5" /> Recuperar</button>
                <button onClick={() => borrarDoc(d)} className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Borrar definitivo</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
