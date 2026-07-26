// ============================================================
// JusticiaFácil · Asistente IA lateral
// ------------------------------------------------------------
// Panel flotante disponible en TODA la app (se monta una sola vez
// en __root.tsx). Tiene dos modos:
//
// 1. "Caso específico" — buscas un cliente/caso, eliges uno, y el
//    chat SOLO ve los documentos de ESE caso (misma lógica de
//    aislamiento que chat-expediente.mjs).
// 2. "Consulta general" — preguntas libres tipo "dame el código de
//    Aime" y el asistente busca en vivo dentro del sistema
//    (chat-sistema.mjs), sin necesidad de elegir nada primero.
// ============================================================
import { useState, useRef, useEffect } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

type Modo = "caso" | "general";
interface Turno { rol: "user" | "model"; texto: string }
interface CasoResultado {
  id: string;
  cliente_nombre: string;
  cliente_codigo: string;
  gar_id: string;
  expediente: string;
  unidad: string;
  fuente: "caso_juridico" | "solicitud_predictamen";
}
interface DocCaso { nombre: string; url: string }
interface ArchivoCache { nombre: string; uri?: string; mime: string; modo: "file" | "inline"; base64?: string }

const UNIDADES = ["URRJ", "UCM", "UCP", "UFC", "Exhortos"];

export function AsistenteIALateral() {
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<Modo>("general");

  return (
    <>
      {/* Botón flotante para abrir/cerrar */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--teal)] text-2xl text-white shadow-lg hover:opacity-90"
        aria-label="Asistente IA"
      >
        {abierto ? "✕" : "🤖"}
      </button>

      {abierto && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[600px] w-[380px] max-w-[95vw] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl">
          <div className="border-b border-neutral-200 bg-[color:var(--teal)] px-4 py-3">
            <p className="text-sm font-semibold text-white">🤖 Asistente IA — JusticiaFácil</p>
          </div>

          {/* Selector de modo */}
          <div className="flex gap-1 border-b border-neutral-200 p-2">
            <button
              onClick={() => setModo("general")}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${modo === "general" ? "bg-[color:var(--teal)] text-white" : "bg-neutral-100 text-neutral-600"}`}
            >
              Consulta general
            </button>
            <button
              onClick={() => setModo("caso")}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${modo === "caso" ? "bg-[color:var(--teal)] text-white" : "bg-neutral-100 text-neutral-600"}`}
            >
              Caso específico
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {modo === "general" ? <ChatGeneral /> : <ChatCasoEspecifico />}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Modo 1: Consulta general — busca en vivo dentro del sistema
// ============================================================
function ChatGeneral() {
  const [historial, setHistorial] = useState<Turno[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [historial, cargando]);

  async function enviar() {
    const texto = pregunta.trim();
    if (!texto || cargando) return;
    setPregunta("");
    setError(null);
    const nuevo: Turno[] = [...historial, { rol: "user", texto }];
    setHistorial(nuevo);
    setCargando(true);
    try {
      const r = await fetch("/.netlify/functions/chat-sistema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: texto, historial }),
      });
      const data = await r.json();
      if (!data.ok) { setError(data.error || "No se pudo obtener respuesta."); setHistorial(historial); return; }
      setHistorial([...nuevo, { rol: "model", texto: data.respuesta }]);
    } catch (e) {
      setError(String((e as Error)?.message || e));
      setHistorial(historial);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {historial.length === 0 && (
          <p className="text-xs text-neutral-400">
            Pregunta lo que sea del sistema: "dame el código de Aime", "¿en qué unidad está el expediente 1393/2017?", "¿cuántos casos tiene Culiacán?"…
            <br /><br />
            Busca en vivo dentro de JusticiaFácil — siempre lee datos actuales, nunca inventa.
          </p>
        )}
        {historial.map((t, i) => (
          <div key={i} className={t.rol === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${t.rol === "user" ? "bg-[color:var(--teal)] text-white" : "bg-neutral-100 text-neutral-800"}`}>{t.texto}</div>
          </div>
        ))}
        {cargando && <div className="text-xs text-neutral-400">Buscando en el sistema…</div>}
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
        <button onClick={enviar} disabled={cargando || !pregunta.trim()} className="rounded-md bg-[color:var(--teal)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">➤</button>
      </div>
    </div>
  );
}

// ============================================================
// Modo 2: Caso específico — buscar caso, elegirlo, chat aislado
// ============================================================
function ChatCasoEspecifico() {
  const [busqueda, setBusqueda] = useState("");
  const [unidadFiltro, setUnidadFiltro] = useState<string>("");
  const [resultados, setResultados] = useState<CasoResultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [yaBusco, setYaBusco] = useState(false);
  const [casoElegido, setCasoElegido] = useState<CasoResultado | null>(null);

  async function buscarCasos() {
    if (!busqueda.trim() && !unidadFiltro) return;
    setBuscando(true);
    setYaBusco(true);
    try {
      const combinados: CasoResultado[] = [];
      const q = busqueda.trim() ? encodeURIComponent(`%${busqueda.trim()}%`) : null;

      // 1) caso_juridico — casos en litigio/consolidación, filtrable por unidad exacta
      const condiciones1: string[] = [];
      if (q) condiciones1.push(`or=(cliente_nombre.ilike.${q},cliente_codigo.ilike.${q},gar_id.ilike.${q},expediente.ilike.${q})`);
      if (unidadFiltro) condiciones1.push(`unidad=eq.${encodeURIComponent(unidadFiltro)}`);
      const r1 = await fetch(
        `${SUPABASE_URL}/rest/v1/caso_juridico?select=id,cliente_nombre,cliente_codigo,gar_id,expediente,unidad&${condiciones1.join("&")}&limit=15`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      if (r1.ok) {
        const filas = await r1.json();
        combinados.push(...filas.map((f: any) => ({ ...f, fuente: "caso_juridico" as const })));
      }

      // 2) solicitud_predictamen — pre-dictámenes de URRJ. Solo se busca aquí si no hay
      // filtro de unidad, o si el filtro es justo "URRJ" (es el área que maneja esta tabla).
      if (!unidadFiltro || unidadFiltro === "URRJ") {
        const condiciones2: string[] = [];
        if (q) condiciones2.push(`or=(cliente.ilike.${q},expediente.ilike.${q},numero_credito.ilike.${q})`);
        const r2 = await fetch(
          `${SUPABASE_URL}/rest/v1/solicitud_predictamen?select=id,cliente,expediente,area&${condiciones2.join("&")}&limit=15`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        if (r2.ok) {
          const filas = await r2.json();
          combinados.push(
            ...filas.map((f: any) => ({
              id: f.id,
              cliente_nombre: f.cliente || "(sin nombre)",
              cliente_codigo: "",
              gar_id: "",
              expediente: f.expediente || "",
              unidad: f.area || "URRJ",
              fuente: "solicitud_predictamen" as const,
            }))
          );
        }
      }

      setResultados(combinados);
    } finally {
      setBuscando(false);
    }
  }

  if (casoElegido) {
    return <ChatDeCaso caso={casoElegido} onSalir={() => { setCasoElegido(null); setResultados([]); setBusqueda(""); setYaBusco(false); }} />;
  }

  return (
    <div className="flex h-full flex-col p-3">
      <p className="mb-2 text-xs text-neutral-500">Filtra por unidad y/o busca por cliente, código, garantía o expediente:</p>

      <div className="mb-2 flex flex-wrap gap-1">
        {UNIDADES.map((u) => (
          <button
            key={u}
            onClick={() => setUnidadFiltro(unidadFiltro === u ? "" : u)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              unidadFiltro === u ? "border-[color:var(--teal)] bg-[color:var(--teal)] text-white" : "border-neutral-300 text-neutral-600"
            }`}
          >
            {u}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscarCasos()}
          placeholder="Ej: García, GAR-2024-001, 2909/2011…"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[color:var(--teal)]"
        />
        <button onClick={buscarCasos} disabled={buscando} className="rounded-md bg-[color:var(--teal)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Buscar</button>
      </div>

      <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
        {buscando && <p className="text-xs text-neutral-400">Buscando…</p>}
        {!buscando && yaBusco && resultados.length === 0 && <p className="text-xs text-neutral-400">Sin resultados con esos filtros.</p>}
        {resultados.map((c) => (
          <button
            key={`${c.fuente}-${c.id}`}
            onClick={() => setCasoElegido(c)}
            className="block w-full rounded-md border border-neutral-200 px-3 py-2 text-left text-xs hover:bg-neutral-50"
          >
            <span className="font-semibold">{c.cliente_nombre || "(sin nombre)"}</span>
            <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">{c.unidad}</span>
            <br />
            <span className="text-neutral-500">{c.gar_id || c.expediente}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Chat aislado a un solo caso, una vez elegido.
function ChatDeCaso({ caso, onSalir }: { caso: CasoResultado; onSalir: () => void }) {
  const [documentos, setDocumentos] = useState<DocCaso[] | null>(null);
  const [historial, setHistorial] = useState<Turno[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivosCache, setArchivosCache] = useState<ArchivoCache[] | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (caso.fuente === "caso_juridico") {
      fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?select=nombre,link&caso_id=eq.${caso.id}&en_papelera=eq.false`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((filas: { nombre: string; link: string }[]) => setDocumentos(filas.map((f) => ({ nombre: f.nombre, url: f.link }))))
        .catch(() => setDocumentos([]));
    } else {
      // solicitud_predictamen guarda sus documentos directo en una columna jsonb
      fetch(`${SUPABASE_URL}/rest/v1/solicitud_predictamen?select=documentos&id=eq.${caso.id}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      })
        .then((r) => (r.ok ? r.json() : []))
        .then((filas: { documentos: { nombre: string; url: string }[] }[]) => setDocumentos(filas[0]?.documentos || []))
        .catch(() => setDocumentos([]));
    }
  }, [caso.id, caso.fuente]);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [historial, cargando]);

  async function enviar() {
    const texto = pregunta.trim();
    if (!texto || cargando || !documentos) return;
    setPregunta("");
    setError(null);
    const nuevo: Turno[] = [...historial, { rol: "user", texto }];
    setHistorial(nuevo);
    setCargando(true);
    try {
      const r = await fetch("/.netlify/functions/chat-expediente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clave: caso.id,
          documentos: archivosCache ? [] : documentos,
          archivosCache: archivosCache || undefined,
          pregunta: texto,
          historial,
        }),
      });
      const data = await r.json();
      if (!data.ok) { setError(data.error || "No se pudo obtener respuesta."); setHistorial(historial); return; }
      setHistorial([...nuevo, { rol: "model", texto: data.respuesta }]);
      if (Array.isArray(data.archivos) && data.archivos.length > 0) setArchivosCache(data.archivos);
    } catch (e) {
      setError(String((e as Error)?.message || e));
      setHistorial(historial);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <div className="text-xs">
          <p className="font-semibold">{caso.cliente_nombre}</p>
          <p className="text-neutral-500">{caso.gar_id} · {documentos ? `${documentos.length} documentos` : "cargando…"}</p>
        </div>
        <button onClick={onSalir} className="text-xs text-neutral-400 hover:text-neutral-700">← cambiar caso</button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {documentos && documentos.length === 0 && <p className="text-xs text-amber-700">Este caso no tiene documentos cargados todavía.</p>}
        {historial.length === 0 && documentos && documentos.length > 0 && (
          <p className="text-xs text-neutral-400">Pregunta lo que necesites — solo ve los documentos de este caso.</p>
        )}
        {historial.map((t, i) => (
          <div key={i} className={t.rol === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${t.rol === "user" ? "bg-[color:var(--teal)] text-white" : "bg-neutral-100 text-neutral-800"}`}>{t.texto}</div>
          </div>
        ))}
        {cargando && <div className="text-xs text-neutral-400">Leyendo los documentos del caso…</div>}
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
          disabled={cargando || !documentos || documentos.length === 0}
        />
        <button onClick={enviar} disabled={cargando || !pregunta.trim() || !documentos || documentos.length === 0} className="rounded-md bg-[color:var(--teal)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">➤</button>
      </div>
    </div>
  );
}
