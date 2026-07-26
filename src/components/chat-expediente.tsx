// ============================================================
// JusticiaFácil · Chat con IA sobre los documentos de un expediente
// ------------------------------------------------------------
// Úsalo dentro de la vista de un expediente/garantía ya cargado.
// Ejemplo de uso:
//   <ChatExpediente clave={solicitudActiva.id} documentos={solicitudActiva.documentos} />
// ============================================================
import { useState, useRef, useEffect } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

export interface DocChat { nombre: string; url: string }
interface Turno { rol: "user" | "model"; texto: string }
interface ArchivoCache { nombre: string; uri?: string; mime: string; modo: "file" | "inline"; base64?: string }

export function ChatExpediente({ clave, documentos }: { clave: string; documentos: DocChat[] }) {
  const [historial, setHistorial] = useState<Turno[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivosCache, setArchivosCache] = useState<ArchivoCache[] | null>(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const finRef = useRef<HTMLDivElement>(null);

  // Memoria persistente: cada pregunta/respuesta de este expediente se
  // guarda en Supabase (chat_expediente_historial). Al volver a abrir el
  // expediente — hoy, mañana, quien sea que lo abra — se recarga aquí, así
  // no se pierde ni se vuelve a preguntar por accidente lo mismo.
  useEffect(() => {
    if (!clave) { setCargandoHistorial(false); return; }
    setCargandoHistorial(true);
    fetch(`${SUPABASE_URL}/rest/v1/chat_expediente_historial?select=pregunta,respuesta&clave=eq.${encodeURIComponent(clave)}&order=created_at.asc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((filas: { pregunta: string; respuesta: string }[]) => {
        const turnos: Turno[] = [];
        for (const f of filas) { turnos.push({ rol: "user", texto: f.pregunta }); turnos.push({ rol: "model", texto: f.respuesta }); }
        setHistorial(turnos);
      })
      .catch(() => {})
      .finally(() => setCargandoHistorial(false));
  }, [clave]);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [historial, cargando]);

  async function enviar() {
    const texto = pregunta.trim();
    if (!texto || cargando) return;
    setPregunta("");
    setError(null);
    const nuevoHistorial: Turno[] = [...historial, { rol: "user", texto }];
    setHistorial(nuevoHistorial);
    setCargando(true);
    try {
      const r = await fetch("/.netlify/functions/chat-expediente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clave,
          documentos: archivosCache ? [] : documentos,
          archivosCache: archivosCache || undefined,
          pregunta: texto,
          historial: historial, // los turnos previos, sin el que se acaba de mandar
        }),
      });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error || "No se pudo obtener respuesta.");
        setHistorial(historial); // revierte el turno del usuario si falló
        return;
      }
      setHistorial([...nuevoHistorial, { rol: "model", texto: data.respuesta }]);
      if (Array.isArray(data.archivos) && data.archivos.length > 0) setArchivosCache(data.archivos);
    } catch (e) {
      setError(String((e as Error)?.message || e));
      setHistorial(historial);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex h-[520px] flex-col rounded-lg border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-3 py-2">
        <p className="text-xs font-semibold text-neutral-700">🤖 Preguntar sobre este expediente</p>
        <p className="text-[11px] text-neutral-400">Solo contesta con base en los {documentos.length} documentos de esta solicitud — no ve otros expedientes.</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {cargandoHistorial && <p className="text-xs text-neutral-400">Cargando conversación de este expediente…</p>}
        {!cargandoHistorial && historial.length === 0 && (
          <p className="text-xs text-neutral-400">Pregunta lo que necesites: "¿ya está emplazado?", "¿cuántos gravámenes tiene?", "¿cuál fue la última actuación?"…</p>
        )}
        {historial.map((t, i) => (
          <div key={i} className={t.rol === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${t.rol === "user" ? "bg-[color:var(--teal)] text-white" : "bg-neutral-100 text-neutral-800"}`}>
              {t.texto}
            </div>
          </div>
        ))}
        {cargando && <div className="text-xs text-neutral-400">Leyendo los documentos del expediente…</div>}
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
        <div ref={finRef} />
      </div>

      <div className="flex gap-2 border-t border-neutral-200 p-2">
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder="Escribe tu pregunta…"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[color:var(--teal)]"
          disabled={cargando}
        />
        <button
          onClick={enviar}
          disabled={cargando || !pregunta.trim()}
          className="rounded-md bg-[color:var(--teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
