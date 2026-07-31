import { useEffect, useState } from "react";
import { Check, CircleDot, Circle, UploadCloud, Copy, FileText, ExternalLink, Loader2, X, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, sbSelect, type CasoJuridico } from "@/lib/supabase";
import { tipoJuicioPorClave } from "@/lib/etapas-juicio";
import { obtenerSeguimiento, type SeguimientoJuicio } from "@/lib/seguimiento-juicio";
import { subirDocumento } from "@/lib/drive";
import { listarCopias, firmarCopias, type Copia } from "@/lib/drive-explorar";

const TEAL = "#0C5C46";
const NAVY = "#0B1E3A";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

interface DocEtapa {
  id: string;
  nombre: string | null;
  link: string | null;
  drive_id: string | null;
  etapa: string | null;
  postura: "a_favor" | "en_contra" | "neutro" | null;
  nota_corta: string | null;
}

const POSTURA_UI: Record<string, { Icon: typeof ThumbsUp; cls: string; txt: string }> = {
  a_favor: { Icon: ThumbsUp, cls: "text-emerald-600", txt: "A favor" },
  en_contra: { Icon: ThumbsDown, cls: "text-red-600", txt: "En contra" },
  neutro: { Icon: Minus, cls: "text-muted-foreground", txt: "Neutro" },
};

// Línea del tiempo compacta de las etapas del juicio (dónde vamos y qué sigue).
// Cada punto se puede abrir para ver/subir/copiar los documentos de esa etapa,
// con su postura (a favor / en contra / neutro) y una nota corta de por qué.
export function LineaTiempoJuicio({ caso, area = "UCM", onAbrir }: { caso: CasoJuridico; area?: string; onAbrir?: () => void }) {
  const [seg, setSeg] = useState<SeguimientoJuicio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [docs, setDocs] = useState<DocEtapa[]>([]);
  const [etapaAbierta, setEtapaAbierta] = useState<string | null>(null);
  const [copiando, setCopiando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  const cargarDocs = () => {
    sbSelect<DocEtapa>("documento_garantia", `select=id,nombre,link,drive_id,etapa,postura,nota_corta&caso_id=eq.${caso.id}&en_papelera=eq.false&etapa=not.is.null`).then(setDocs).catch(() => setDocs([]));
  };

  useEffect(() => {
    obtenerSeguimiento(caso).then(setSeg).finally(() => setCargando(false));
    cargarDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caso.id]);

  if (cargando) return null;

  const tipoDef = tipoJuicioPorClave(seg?.tipo_juicio);

  if (!seg || !tipoDef) {
    return (
      <button onClick={onAbrir} className="w-full rounded-xl border border-dashed border-border bg-muted/30 p-3 text-left text-xs text-muted-foreground hover:bg-muted/50">
        Aún no has configurado el <b>seguimiento del juicio</b>. Toca aquí o el botón "Seguimiento del juicio" para elegir el tipo y marcar las etapas.
      </button>
    );
  }

  const etapas = tipoDef.etapas;
  const hechas = new Set(seg.etapas_hechas || []);
  const actualIdx = etapas.findIndex((e) => e.clave === seg.etapa_actual);
  const actual = actualIdx >= 0 ? etapas[actualIdx] : null;
  const siguiente = actualIdx >= 0 && actualIdx + 1 < etapas.length ? etapas[actualIdx + 1] : null;

  const docsDe = (clave: string) => docs.filter((d) => d.etapa === clave);
  const posturaEtapa = (clave: string): "a_favor" | "en_contra" | "neutro" | null => {
    const ds = docsDe(clave);
    if (ds.length === 0) return null;
    if (ds.some((d) => d.postura === "en_contra")) return "en_contra";
    if (ds.every((d) => d.postura === "a_favor")) return "a_favor";
    return "neutro";
  };

  const handleSubir = async (clave: string, file: File) => {
    setSubiendo(true);
    try {
      const r = await subirDocumento(area, caso, file, "otro");
      if (r.ok && r.doc?.id) {
        await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?id=eq.${r.doc.id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ etapa: clave }) });
        cargarDocs();
      }
    } finally { setSubiendo(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold" style={{ color: NAVY }}>
          Línea del tiempo · <span className="font-normal text-muted-foreground">{tipoDef.tipo} · {tipoDef.via === "oral" ? "Oral" : "Escrito"}{seg.posicion ? ` · ${seg.posicion}` : ""}</span>
        </p>
        {onAbrir && <button onClick={onAbrir} className="text-[11px] font-medium text-[color:var(--teal)] hover:underline">Ver / editar</button>}
      </div>

      {/* línea horizontal de puntos */}
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {etapas.map((e, i) => {
          const esActual = e.clave === seg.etapa_actual;
          const esHecha = hechas.has(e.clave);
          const ultimo = i === etapas.length - 1;
          const nDocs = docsDe(e.clave).length;
          const postura = posturaEtapa(e.clave);
          const PUi = postura ? POSTURA_UI[postura] : null;
          return (
            <div key={e.clave} className="flex min-w-[70px] flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : esHecha || esActual ? "bg-[color:var(--teal)]" : "bg-border"}`} />
                <button onClick={() => setEtapaAbierta(etapaAbierta === e.clave ? null : e.clave)} title="Ver / subir documentos de esta etapa">
                  {esActual ? <CircleDot className="h-4 w-4 shrink-0" style={{ color: TEAL }} /> : esHecha ? <Check className="h-4 w-4 shrink-0 text-[color:var(--teal)]" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </button>
                <div className={`h-0.5 flex-1 ${ultimo ? "opacity-0" : esHecha ? "bg-[color:var(--teal)]" : "bg-border"}`} />
              </div>
              <span className={`mt-1 text-center text-[9px] leading-tight ${esActual ? "font-semibold text-foreground" : esHecha ? "text-foreground" : "text-muted-foreground"}`}>{e.nombre}</span>
              <button onClick={() => setEtapaAbierta(etapaAbierta === e.clave ? null : e.clave)} className="mt-0.5 flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-[color:var(--teal)]">
                {PUi && <PUi.Icon className={`h-2.5 w-2.5 ${PUi.cls}`} />}
                {nDocs > 0 ? `${nDocs} doc.` : "subir doc."}
              </button>
            </div>
          );
        })}
      </div>

      {/* panel de la etapa abierta */}
      {etapaAbierta && (() => {
        const e = etapas.find((x) => x.clave === etapaAbierta)!;
        const ds = docsDe(etapaAbierta);
        return (
          <div className="mt-3 rounded-lg border border-dashed border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: TEAL }}>{e.nombre}</p>
              <button onClick={() => setEtapaAbierta(null)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
            </div>
            {ds.length === 0 && <p className="mb-2 text-[11px] text-muted-foreground">Sin documentos ligados a esta etapa todavía.</p>}
            <div className="space-y-1.5">
              {ds.map((d) => {
                const PUi = d.postura ? POSTURA_UI[d.postura] : null;
                return (
                  <div key={d.id} className="rounded-md border border-border bg-card p-2 text-[11px]">
                    <div className="flex items-start justify-between gap-2">
                      <a href={d.link || "#"} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 font-medium text-[color:var(--teal)] hover:underline">
                        <FileText className="h-3 w-3 shrink-0" /> <span className="truncate">{d.nombre}</span> <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      </a>
                      {PUi && <span className={`flex shrink-0 items-center gap-0.5 ${PUi.cls}`}><PUi.Icon className="h-3 w-3" /> {PUi.txt}</span>}
                    </div>
                    {d.nota_corta && <p className="mt-0.5 text-muted-foreground">{d.nota_corta}</p>}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="flex cursor-pointer items-center gap-1 rounded-md border border-[color:var(--teal)]/40 px-2 py-1 text-[11px] font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10">
                {subiendo ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3 w-3" />} Subir documento
                <input type="file" className="hidden" disabled={subiendo} onChange={(ev) => { const f = ev.target.files?.[0]; if (f) handleSubir(etapaAbierta, f); ev.target.value = ""; }} />
              </label>
              <button onClick={() => setCopiando(true)} className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/50">
                <Copy className="h-3 w-3" /> Copiar de Documentos fijos
              </button>
            </div>
          </div>
        );
      })()}

      {/* dónde vamos / qué sigue */}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md bg-[color:var(--teal)]/5 p-2 text-xs">
          <span className="text-[10px] font-semibold text-[color:var(--teal)]">DÓNDE VAMOS</span>
          <p>{actual ? actual.nombre : "Sin etapa marcada"}</p>
        </div>
        <div className="rounded-md bg-muted/40 p-2 text-xs">
          <span className="text-[10px] font-semibold text-muted-foreground">QUÉ SIGUE (aprox.)</span>
          <p>{siguiente ? siguiente.nombre : actual ? "Última etapa / cierre" : "—"}</p>
        </div>
      </div>

      {copiando && etapaAbierta && (
        <CopiarDeFijosModal
          caso={caso}
          etapa={etapaAbierta}
          yaLigados={new Set(docs.map((d) => d.drive_id).filter(Boolean) as string[])}
          onClose={() => setCopiando(false)}
          onCopiado={() => { setCopiando(false); cargarDocs(); }}
        />
      )}
    </div>
  );
}

// ============================================================
// CopiarDeFijosModal · elige un documento ya sincronizado (Documentos
// fijos / drive_copia) y lo liga a esta etapa sin volver a subir nada.
// ============================================================
function CopiarDeFijosModal({ caso, etapa, yaLigados, onClose, onCopiado }: { caso: CasoJuridico; etapa: string; yaLigados: Set<string>; onClose: () => void; onCopiado: () => void }) {
  const [copias, setCopias] = useState<Copia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [ligando, setLigando] = useState<string | null>(null);

  useEffect(() => {
    listarCopias(caso.id).then((mapa) => setCopias(Object.values(mapa))).finally(() => setCargando(false));
  }, [caso.id]);

  const disponibles = copias.filter((c) => !yaLigados.has(c.drive_id) && (c.nombre || "").toLowerCase().includes(buscar.toLowerCase()));

  const ligar = async (c: Copia) => {
    setLigando(c.drive_id);
    try {
      const urls = await firmarCopias([c.storage_path]);
      await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          caso_id: caso.id, expediente: caso.expediente || null,
          nombre: c.nombre, link: urls[c.storage_path] || null, drive_id: c.drive_id, mime: c.mime,
          tipo: "otro", etapa,
        }),
      });
      onCopiado();
    } finally { setLigando(null); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: "#0B1E3A" }}>
          <p className="font-semibold">Copiar de Documentos fijos</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[70vh] space-y-2 overflow-y-auto p-4">
          <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Buscar por nombre…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          {cargando && <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
          {!cargando && disponibles.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">No hay documentos fijos disponibles para copiar (o ya están todos ligados).</p>}
          {disponibles.map((c) => (
            <button key={c.drive_id} onClick={() => ligar(c)} disabled={!!ligando} className="flex w-full items-center gap-2 rounded-md border border-border p-2 text-left text-xs hover:bg-muted/40 disabled:opacity-60">
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
              {ligando === c.drive_id ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-[color:var(--teal)]" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

