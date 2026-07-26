// ============================================================
// JusticiaFácil · Documentos de la solicitud URRJ vinculada
// ------------------------------------------------------------
// Este componente NO tiene su propia copia de documentos — lee y
// escribe DIRECTO sobre la misma fila de `solicitud_predictamen`
// que usa la pantalla URRJ → Solicitudes. Por eso lo que agregas,
// analizas o eliminas aquí se ve también allá, y viceversa: es el
// mismo dato, no una sincronización.
//
// Úsalo donde necesites ver/editar esos documentos fuera de la
// pantalla de Solicitudes — por ejemplo, dentro de la pestaña
// "Registral (RPPC)" de la Ficha de una garantía.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { getAuth } from "@/lib/auth";
import {
  obtenerResumenCacheado,
  generarResumenUnDocumento,
  type ResumenDocumentosCache,
} from "@/lib/resumen-documentos";
import { generarAnalisisIA, guardarAnalisisEnCache } from "@/lib/analisis-ia";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const ORDEN_TIPOS = ["Contrato", "Certificado", "Auto Judicial", "Dictamen", "Otro"];

interface DocRef { nombre: string; url: string }
interface SolicitudVinculada { id: string; documentos: DocRef[]; area?: string | null }

export function DocumentosSolicitudVinculada({
  casoId,
  expediente,
  numeroCredito,
  area = "URRJ",
}: {
  casoId?: string | null;
  expediente?: string | null;
  numeroCredito?: string | null;
  area?: string;
}) {
  const [solicitud, setSolicitud] = useState<SolicitudVinculada | null | undefined>(undefined); // undefined = cargando
  const [resumenDocs, setResumenDocs] = useState<ResumenDocumentosCache | null>(null);
  const [analizandoDoc, setAnalizandoDoc] = useState<string | null>(null);
  const [errorResumen, setErrorResumen] = useState<string | null>(null);
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [errorSubidaDoc, setErrorSubidaDoc] = useState<string | null>(null);

  const claveCaso = numeroCredito || expediente || casoId || "";

  // Busca la solicitud de URRJ vinculada a esta garantía — por caso_id,
  // expediente o número de crédito (lo que haya disponible). Si hay varias,
  // toma la más reciente.
  useEffect(() => {
    const condiciones = [
      casoId ? `caso_id.eq.${casoId}` : null,
      expediente ? `expediente.eq.${encodeURIComponent(expediente)}` : null,
      numeroCredito ? `numero_credito.eq.${encodeURIComponent(numeroCredito)}` : null,
    ].filter(Boolean) as string[];
    if (condiciones.length === 0) { setSolicitud(null); return; }
    const filtro = condiciones.length === 1 ? condiciones[0].replace(".eq.", "=eq.") : `or=(${condiciones.join(",")})`;
    setSolicitud(undefined);
    fetch(`${SUPABASE_URL}/rest/v1/solicitud_predictamen?select=id,documentos,area&${filtro}&area=eq.${area}&order=created_at.desc&limit=1`, { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((filas: SolicitudVinculada[]) => setSolicitud(filas?.[0] || null))
      .catch(() => setSolicitud(null));
  }, [casoId, expediente, numeroCredito, area]);

  useEffect(() => {
    if (!solicitud?.id) { setResumenDocs(null); return; }
    obtenerResumenCacheado(solicitud.id).then(setResumenDocs);
  }, [solicitud?.id]);

  const resumenDe = (nombre: string) => resumenDocs?.resumenes?.find((x) => x.nombre === nombre) || null;

  const documentosOrdenados = useMemo(() => {
    const docs = solicitud?.documentos || [];
    if (!resumenDocs) return docs;
    const todosAnalizados = docs.every((d) => resumenDe(d.nombre));
    if (!todosAnalizados) return docs;
    return [...docs].sort((a, b) => {
      const ia = ORDEN_TIPOS.indexOf(resumenDe(a.nombre)?.tipo || "Otro");
      const ib = ORDEN_TIPOS.indexOf(resumenDe(b.nombre)?.tipo || "Otro");
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitud?.documentos, resumenDocs]);

  function normalizarTexto(t: string) {
    return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function similitudTexto(a: string, b: string) {
    const wa = new Set(normalizarTexto(a).split(" ").filter((w) => w.length > 2));
    const wb = new Set(normalizarTexto(b).split(" ").filter((w) => w.length > 2));
    if (wa.size === 0 || wb.size === 0) return 0;
    let interseccion = 0;
    for (const w of wa) if (wb.has(w)) interseccion++;
    return interseccion / new Set([...wa, ...wb]).size;
  }
  const duplicadosPorNombre = useMemo(() => {
    const docsConResumen = documentosOrdenados.map((d) => ({ nombre: d.nombre, r: resumenDe(d.nombre) })).filter((x) => x.r?.resumen);
    const mapa = new Map<string, string[]>();
    for (let i = 0; i < docsConResumen.length; i++) {
      for (let j = i + 1; j < docsConResumen.length; j++) {
        const a = docsConResumen[i], b = docsConResumen[j];
        if (a.r!.tipo !== b.r!.tipo) continue;
        if (similitudTexto(a.r!.resumen, b.r!.resumen) >= 0.5) {
          if (!mapa.has(a.nombre)) mapa.set(a.nombre, []);
          if (!mapa.has(b.nombre)) mapa.set(b.nombre, []);
          mapa.get(a.nombre)!.push(b.nombre);
          mapa.get(b.nombre)!.push(a.nombre);
        }
      }
    }
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentosOrdenados, resumenDocs]);

  const analizarUnDocumento = async (doc: DocRef) => {
    if (!solicitud?.id || resumenDe(doc.nombre)) return;
    setAnalizandoDoc(doc.nombre);
    setErrorResumen(null);
    const r = await generarResumenUnDocumento(solicitud.id, doc, resumenDocs, claveCaso || solicitud.id);
    setAnalizandoDoc(null);
    if (!r.ok) { setErrorResumen(`"${doc.nombre}": ${r.error || "No se pudo analizar."}`); return; }
    setResumenDocs(r.cache!);
    // Además del resumen rápido, alimenta el cuestionario profundo (Actor)
    // — es el que usa el Dictamen Registral para autollenarse (Certificados
    // de Gravamen, RPPC, escrituras). Si falla, no bloquea: el resumen
    // rápido ya quedó guardado.
    try {
      const claveParaAnalisis = claveCaso || solicitud.id;
      const rA = await generarAnalisisIA(claveParaAnalisis, "Actor", [doc]);
      if (rA.ok && rA.analisis) {
        await guardarAnalisisEnCache({ ...rA.analisis, posicion: "Demandado" });
      }
    } catch { /* el resumen rápido ya se guardó; esto es un plus */ }
  };

  const agregarDocumento = async (file: File) => {
    if (!solicitud?.id) return;
    setSubiendoDoc(true);
    setErrorSubidaDoc(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => { const s = String(fr.result || ""); const c = s.indexOf(","); resolve(c >= 0 ? s.slice(c + 1) : s); };
        fr.onerror = () => reject(new Error("No se pudo leer el archivo."));
        fr.readAsDataURL(file);
      });
      let solicita = "SIN-SESION";
      try {
        const auth = await getAuth();
        const { data } = await auth.auth.getSession();
        solicita = data?.session?.user?.email || "SIN-SESION";
      } catch { /* sin sesión, se sube igual */ }

      const garantia = (numeroCredito || expediente || casoId || "solicitud").toString().replace(/[\\/]/g, "-");
      const r = await fetch("/.netlify/functions/subir-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, solicita, garantia, archivo: base64, nombre: file.name, mime: file.type || "application/octet-stream" }),
      });
      const data = await r.json();
      if (!data.ok) { setErrorSubidaDoc(data.error || "No se pudo subir el documento a Drive."); return; }

      const nuevoDoc = { nombre: data.nombre || file.name, url: data.link };
      const documentosActualizados = [...(solicitud.documentos || []), nuevoDoc];
      const patch = await fetch(`${SUPABASE_URL}/rest/v1/solicitud_predictamen?id=eq.${solicitud.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ documentos: documentosActualizados }),
      });
      if (!patch.ok) { setErrorSubidaDoc("Se subió a Drive, pero no se pudo agregar a la solicitud."); return; }
      setSolicitud({ ...solicitud, documentos: documentosActualizados });
    } catch (e) {
      setErrorSubidaDoc(String((e as Error)?.message || e));
    } finally {
      setSubiendoDoc(false);
    }
  };

  const eliminarDocumento = async (nombre: string) => {
    if (!solicitud?.id) return;
    if (!confirm(`¿Quitar "${nombre}" de esta solicitud? (no borra el archivo de Drive)`)) return;
    const documentosActualizados = (solicitud.documentos || []).filter((d) => d.nombre !== nombre);
    const patch = await fetch(`${SUPABASE_URL}/rest/v1/solicitud_predictamen?id=eq.${solicitud.id}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ documentos: documentosActualizados }),
    });
    if (!patch.ok) { setErrorSubidaDoc("No se pudo quitar el documento — intenta de nuevo."); return; }
    setSolicitud({ ...solicitud, documentos: documentosActualizados });
  };

  if (solicitud === undefined) {
    return <div className="rounded-xl border border-border bg-white p-4 text-xs text-muted-foreground">Buscando la solicitud de URRJ vinculada…</div>;
  }
  if (solicitud === null) {
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
        No hay una solicitud de pre-dictamen de URRJ vinculada todavía (se busca por caso, expediente o número de crédito). Los documentos aparecen aquí en cuanto exista esa solicitud.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">📎 Documentos de la solicitud URRJ ({solicitud.documentos?.length || 0})</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Mismos documentos y análisis que ves en URRJ → Solicitudes — lo que hagas aquí se refleja allá.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[color:var(--teal)] px-3 py-1.5 text-xs font-semibold text-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
          <Upload className="h-3.5 w-3.5" />
          {subiendoDoc ? "Subiendo…" : "Agregar documento"}
          <input type="file" className="hidden" disabled={subiendoDoc} onChange={(e) => { const f = e.target.files?.[0]; if (f) agregarDocumento(f); e.target.value = ""; }} />
        </label>
      </div>
      {errorSubidaDoc && <p className="mt-1 text-xs text-red-600">⚠️ {errorSubidaDoc}</p>}
      {duplicadosPorNombre.size > 0 && (
        <p className="mt-1 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] font-medium text-amber-800">
          ⚠️ Hay {duplicadosPorNombre.size} documento(s) que parecen repetidos — revísalos y elimina el que sobre si aplica.
        </p>
      )}
      {errorResumen && <p className="mt-1 text-xs text-red-600">{errorResumen}</p>}

      {(solicitud.documentos?.length || 0) === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Esta solicitud todavía no tiene documentos.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="bg-muted/50">
                <th className="border border-border px-2.5 py-2 text-left font-semibold">Documento</th>
                <th className="border border-border px-2.5 py-2 text-left font-semibold">Análisis IA</th>
                <th className="border border-border px-2 py-2 text-right font-semibold w-24"></th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {documentosOrdenados.map((d, i) => {
                const r = resumenDe(d.nombre);
                const dupsDe = duplicadosPorNombre.get(d.nombre);
                return (
                  <tr key={d.nombre} className={i % 2 ? "bg-white hover:bg-muted/20" : "bg-muted/10 hover:bg-muted/20"}>
                    <td className="border border-border px-2.5 py-2">
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="block max-w-[260px] truncate font-medium text-[color:var(--teal)] hover:underline">📄 {d.nombre}</a>
                      {dupsDe && dupsDe.length > 0 && <p className="mt-0.5 text-[10px] font-medium text-amber-700">⚠️ Posible duplicado de: {dupsDe.join(", ")}</p>}
                    </td>
                    <td className="border border-border px-2.5 py-2">
                      {r ? (
                        <span className="whitespace-normal text-muted-foreground">
                          <span className="rounded bg-purple-100 px-1 py-0.5 font-medium text-purple-800">{r.tipo}</span> · {r.resumen}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap border border-border px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!r && (
                          <button
                            onClick={() => analizarUnDocumento(d)}
                            disabled={analizandoDoc === d.nombre}
                            className="inline-flex items-center gap-1 rounded bg-purple-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-purple-800 disabled:opacity-60"
                          >
                            {analizandoDoc === d.nombre ? "✨ Leyendo…" : "✨ Analizar"}
                          </button>
                        )}
                        <button onClick={() => eliminarDocumento(d.nombre)} title="Quitar de esta solicitud" className="inline-flex items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
