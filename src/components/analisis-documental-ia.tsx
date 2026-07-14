// ============================================================
//  Panel: Análisis de documentos con IA (dentro de cada recorrido)
// ------------------------------------------------------------
//  Se genera UNA sola vez por caso+posición (se guarda en caché).
//  Busca los documentos por caso_id, expediente o número de
//  crédito — lo que exista — para no depender de que la garantía
//  ya tenga ficha formal.
// ============================================================
import { useEffect, useState } from "react";
import { Sparkles, Download, RefreshCw, Loader2, FileWarning } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import {
  claveAnalisis, obtenerAnalisisCacheado, generarAnalisisIA, descargarAnalisisTxt,
  type AnalisisIA, type DocumentoRef,
} from "@/lib/analisis-ia";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export function AnalisisDocumentalIA({ posicion, casoId, expediente, numeroCredito }: {
  posicion: string;
  casoId?: string;
  expediente?: string;
  numeroCredito?: string;
}) {
  const clave = claveAnalisis({ numeroCredito, expediente, caso_id: casoId });
  const [documentos, setDocumentos] = useState<DocumentoRef[]>([]);
  const [cargandoDocs, setCargandoDocs] = useState(true);
  const [analisis, setAnalisis] = useState<AnalisisIA | null>(null);
  const [cargandoCache, setCargandoCache] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    setCargandoDocs(true);
    const condiciones = [
      casoId ? `caso_id.eq.${casoId}` : null,
      expediente ? `expediente.eq.${encodeURIComponent(expediente)}` : null,
      numeroCredito ? `numero_credito.eq.${encodeURIComponent(numeroCredito)}` : null,
    ].filter(Boolean) as string[];
    if (condiciones.length === 0) { setDocumentos([]); setCargandoDocs(false); return; }
    const filtro = condiciones.length === 1 ? condiciones[0].replace(".eq.", "=eq.") : `or=(${condiciones.join(",")})`;
    fetch(`${SUPABASE_URL}/rest/v1/solicitud_predictamen?select=documentos&${filtro}&area=eq.URRJ&order=created_at.desc&limit=50`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((rows: any[]) => {
        const vistos = new Set<string>();
        const todos: DocumentoRef[] = [];
        for (const row of rows) for (const d of (row.documentos || [])) {
          if (d?.url && !vistos.has(d.url)) { vistos.add(d.url); todos.push({ nombre: d.nombre || "documento", url: d.url }); }
        }
        setDocumentos(todos);
      })
      .catch(() => setDocumentos([]))
      .finally(() => setCargandoDocs(false));
  }, [casoId, expediente, numeroCredito]);

  useEffect(() => {
    if (!clave) { setCargandoCache(false); return; }
    setCargandoCache(true);
    obtenerAnalisisCacheado(clave, posicion).then((a) => { setAnalisis(a); setCargandoCache(false); });
  }, [clave, posicion]);

  const generar = async () => {
    setGenerando(true); setError(null);
    const r = await generarAnalisisIA(clave, posicion, documentos);
    setGenerando(false);
    if (!r.ok) { setError(r.error || "No se pudo generar el análisis."); return; }
    setAnalisis(r.analisis!);
    setAbierto(true);
  };

  if (!clave) return null; // sin crédito/expediente/caso, no hay con qué identificar el caché

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-700" />
        <p className="text-sm font-semibold text-purple-900">Análisis de documentos con IA</p>
      </div>

      {cargandoDocs || cargandoCache ? (
        <p className="mt-2 text-xs text-muted-foreground">Cargando…</p>
      ) : analisis ? (
        <div className="mt-2">
          <p className="text-xs text-purple-900">
            ✓ Generado el {analisis.created_at ? new Date(analisis.created_at).toLocaleString("es-MX") : "—"} · Documento: <b>{analisis.documento_nombre || "—"}</b> ({analisis.documento_tipo || "—"})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => setAbierto((v) => !v)} className="rounded-md border border-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-purple-800 hover:bg-purple-50">
              {abierto ? "Ocultar respuestas" : "Ver respuestas"}
            </button>
            <button onClick={() => descargarAnalisisTxt(analisis)} className="inline-flex items-center gap-1 rounded-md bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-800">
              <Download className="h-3.5 w-3.5" /> Descargar
            </button>
            <button onClick={generar} disabled={generando || documentos.length === 0} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline disabled:opacity-50">
              {generando ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Regenerar (gasta IA otra vez)
            </button>
          </div>
          {abierto && (
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-purple-200 bg-white p-3 text-[11px] text-slate-800">
              {JSON.stringify(analisis.respuestas, null, 2)}
            </pre>
          )}
        </div>
      ) : documentos.length === 0 ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileWarning className="h-3.5 w-3.5" /> Aún no hay documentos adjuntos para esta garantía — la IA necesita al menos uno para analizar.
        </p>
      ) : (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground">{documentos.length} documento(s) disponibles. Se analiza una sola vez (no se repite el gasto de IA).</p>
          <button onClick={generar} disabled={generando} className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-60">
            {generando ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo documentos…</> : <><Sparkles className="h-3.5 w-3.5" /> Analizar con IA</>}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
