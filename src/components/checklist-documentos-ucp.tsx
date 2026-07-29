// ============================================================
// JusticiaFácil · Checklist de documentos de UCP
// ------------------------------------------------------------
// Carpetas fijas de esta unidad: el Dictamen Final del sistema se
// guarda solo (automático) en cuanto quedan las firmas completas;
// las demás son "enviar documento" -> en cuanto hay al menos uno,
// se habilita "Validar existe".
// ============================================================
import { useEffect, useState } from "react";
import { FileCheck2, UploadCloud, Loader2, CheckCircle2, Clock, FileText, ExternalLink, FolderOpen, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { subirDocumento, type DocumentoGarantia } from "@/lib/drive";
import { correoActual } from "@/lib/auth";
import { firmarCopias, type Copia } from "@/lib/drive-explorar";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

interface Categoria { clave: string; etiqueta: string; obligatorio: boolean; auto: boolean; multiple: boolean; }

const CATEGORIAS: Categoria[] = [
  { clave: "dictamen_final_sistema", etiqueta: "Dictamen Final (PDF del sistema)", obligatorio: true, auto: true, multiple: false },
  { clave: "dictamen_juridico_viejo", etiqueta: "Dictamen Jurídico (documento anterior)", obligatorio: false, auto: false, multiple: false },
  { clave: "dictamen_registral_viejo", etiqueta: "Dictamen Registral (documento anterior)", obligatorio: false, auto: false, multiple: false },
  { clave: "clg", etiqueta: "CLG", obligatorio: false, auto: false, multiple: true },
  { clave: "doc_administradora", etiqueta: "Documentos de la administradora / banco", obligatorio: false, auto: false, multiple: true },
];

interface Checklist { id: string; categoria: string; validado: boolean; validado_por: string | null; validado_en: string | null; }

export function ChecklistDocumentosUCP({ caso, area = "UCP" }: { caso: CasoJuridico; area?: string }) {
  const [docs, setDocs] = useState<DocumentoGarantia[]>([]);
  const [checklist, setChecklist] = useState<Checklist[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [validando, setValidando] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [miCorreo, setMiCorreo] = useState("");
  const [copiasDisponibles, setCopiasDisponibles] = useState<(Copia & { id: string })[]>([]);
  const [eligiendoPara, setEligiendoPara] = useState<string | null>(null);
  const [asignando, setAsignando] = useState<string | null>(null);

  useEffect(() => { correoActual().then((c) => setMiCorreo(c || "")).catch(() => {}); }, []);

  const cargar = () => {
    setCargando(true);
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?select=*&caso_id=eq.${caso.id}&categoria_checklist=not.is.null&en_papelera=eq.false`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/checklist_documento?select=*&caso_id=eq.${caso.id}`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/drive_copia?select=id,drive_id,storage_path,nombre,mime&caso_id=eq.${caso.id}&papelera=eq.false&order=nombre.asc`, { headers }).then((r) => (r.ok ? r.json() : [])),
    ]).then(([d, c, copias]) => {
      setDocs(d); setChecklist(c); setCopiasDisponibles(copias);
      const conLink = [
        ...d.map((x: DocumentoGarantia) => x.drive_copia?.storage_path).filter((p: any): p is string => !!p),
        ...copias.map((x: Copia) => x.storage_path),
      ];
      if (conLink.length) firmarCopias(conLink).then(setUrls);
    }).finally(() => setCargando(false));
  };
  useEffect(cargar, [caso.id]);

  const docsDe = (clave: string) => docs.filter((d) => (d as any).categoria_checklist === clave);

  // Cuando se envía o elige un documento para la categoría CLG, se refleja en
  // la Gestoría RPPC (misma fuente que alimenta el indicador de la tabla de
  // UCP) — así "Documentos fijos" y "Gestoría RPPC" nunca quedan desconectados.
  const sincronizarGestoriaCLG = async (nombreDoc: string) => {
    try {
      const rd = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=id&caso_id=eq.${caso.id}&vigente=eq.true&limit=1`, { headers });
      const dictamenId = (rd.ok ? await rd.json() : [])?.[0]?.id;
      if (!dictamenId) return; // sin dictamen todavía — no hay a qué ligarlo
      const rg = await fetch(`${SUPABASE_URL}/rest/v1/gestoria_rppc?select=id,fase&dictamen_id=eq.${dictamenId}&documento=eq.CLG&limit=1`, { headers });
      const existente = (rg.ok ? await rg.json() : [])?.[0];
      const hoy = new Date().toISOString().slice(0, 10);
      if (existente) {
        if (existente.fase !== "entrega" && existente.fase !== "cerrada") {
          await fetch(`${SUPABASE_URL}/rest/v1/gestoria_rppc?id=eq.${existente.id}`, {
            method: "PATCH", headers, body: JSON.stringify({ fase: "entrega", fecha_entrega: hoy, evidencia: `Documento: ${nombreDoc}` }),
          });
        }
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/gestoria_rppc`, {
          method: "POST", headers,
          body: JSON.stringify({ dictamen_id: dictamenId, caso_id: caso.id, documento: "CLG", fase: "entrega", fecha_solicitud: hoy, fecha_entrega: hoy, evidencia: `Documento: ${nombreDoc}` }),
        });
      }
    } catch { /* no bloquea el guardado del documento si esto falla */ }
  };

  const enviar = async (clave: string, file: File) => {
    setSubiendo(clave);
    try {
      const r = await subirDocumento(area, caso, file, "otro");
      if (r.ok && r.doc) {
        await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?id=eq.${r.doc.id}`, {
          method: "PATCH", headers, body: JSON.stringify({ categoria_checklist: clave }),
        });
        if (clave === "clg") await sincronizarGestoriaCLG(file.name);
      }
      cargar();
    } finally { setSubiendo(null); }
  };

  const yaAsignados = new Set(docs.map((d) => d.drive_copia_id).filter(Boolean));

  const asignarExistente = async (clave: string, copia: Copia & { id: string }) => {
    setAsignando(copia.id);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia`, {
        method: "POST", headers,
        body: JSON.stringify({
          caso_id: caso.id, expediente: caso.expediente || null, nombre: copia.nombre, mime: copia.mime,
          tipo: "otro", subido_por: miCorreo || null, categoria_checklist: clave, drive_copia_id: copia.id,
        }),
      });
      if (clave === "clg") await sincronizarGestoriaCLG(copia.nombre || "documento");
      setEligiendoPara(null);
      cargar();
    } finally { setAsignando(null); }
  };

  const validar = async (clave: string) => {
    setValidando(clave);
    try {
      const existente = checklist.find((c) => c.categoria === clave);
      const body = { caso_id: caso.id, area, categoria: clave, validado: true, validado_por: miCorreo || null, validado_en: new Date().toISOString() };
      if (existente) {
        await fetch(`${SUPABASE_URL}/rest/v1/checklist_documento?id=eq.${existente.id}`, { method: "PATCH", headers, body: JSON.stringify(body) });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/checklist_documento`, { method: "POST", headers, body: JSON.stringify(body) });
      }
      cargar();
    } finally { setValidando(null); }
  };

  return (
    <Card className="legal-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <FileCheck2 className="h-4 w-4" style={{ color: "#0C447C" }} />
        <p className="text-sm font-semibold" style={{ color: "#0B1E3A" }}>Documentos obligatorios de UCP</p>
      </div>
      <p className="text-xs text-muted-foreground">El Dictamen Final se guarda solo aquí en cuanto estén las firmas completas. Los demás los subes tú — en cuanto haya al menos uno, se habilita "Validar".</p>

      {cargando ? (
        <p className="py-4 text-center text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Cargando…</p>
      ) : (
        <div className="space-y-3">
          {CATEGORIAS.map((cat) => {
            const propios = docsDe(cat.clave);
            const ch = checklist.find((c) => c.categoria === cat.clave);
            const validado = !!ch?.validado;
            return (
              <div key={cat.clave} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{cat.etiqueta}</p>
                    {cat.obligatorio && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">Obligatorio</span>}
                    {cat.auto && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">Automático</span>}
                  </div>
                  {validado ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Validado{ch?.validado_por ? ` · ${ch.validado_por}` : ""}</span>
                  ) : propios.length > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"><Clock className="h-3.5 w-3.5" /> Enviado — falta validar</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Falta enviar</span>
                  )}
                </div>

                {propios.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {propios.map((d) => (
                      <a key={d.id} href={d.drive_copia ? (urls[d.drive_copia.storage_path] || "#") : (d.link || "#")} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-[11px] hover:bg-muted">
                        <FileText className="h-3 w-3" /> {d.nombre || "documento"} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ))}
                  </div>
                )}

                {!cat.auto && (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs font-medium ${subiendo === cat.clave ? "opacity-60" : "hover:bg-muted"}`} style={{ borderColor: "#0C447C", color: "#0C447C" }}>
                        {subiendo === cat.clave ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                        {propios.length > 0 && cat.multiple ? "Subir otro documento nuevo" : "Subir documento nuevo"}
                        <input type="file" className="hidden" disabled={subiendo === cat.clave} onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(cat.clave, f); e.target.value = ""; }} />
                      </label>
                      <button
                        onClick={() => setEligiendoPara(eligiendoPara === cat.clave ? null : cat.clave)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        <FolderOpen className="h-3.5 w-3.5" /> Elegir de Documentos Fijos
                      </button>
                      {propios.length > 0 && !validado && (
                        <button onClick={() => validar(cat.clave)} disabled={validando === cat.clave}
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>
                          {validando === cat.clave ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Validar que existe
                        </button>
                      )}
                    </div>

                    {eligiendoPara === cat.clave && (
                      <div className="rounded-md border border-border bg-muted/20 p-2">
                        <div className="mb-1.5 flex items-center justify-between">
                          <p className="text-[11px] font-medium text-muted-foreground">Documentos ya guardados en el sistema para este caso — elige el que corresponda:</p>
                          <button onClick={() => setEligiendoPara(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                        </div>
                        {copiasDisponibles.filter((cp) => !yaAsignados.has(cp.id)).length === 0 ? (
                          <p className="py-2 text-center text-[11px] text-muted-foreground">No hay documentos fijos sin asignar todavía.</p>
                        ) : (
                          <div className="max-h-52 space-y-1 overflow-y-auto">
                            {copiasDisponibles.filter((cp) => !yaAsignados.has(cp.id)).map((cp) => (
                              <button key={cp.id} onClick={() => asignarExistente(cat.clave, cp)} disabled={asignando === cp.id}
                                className="flex w-full items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-60">
                                <span className="flex items-center gap-1.5 truncate"><FileText className="h-3.5 w-3.5 shrink-0 text-[color:var(--teal)]" /> {cp.nombre || "Documento"}</span>
                                {asignando === cp.id ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <span className="shrink-0 text-[10px] font-medium" style={{ color: "#0C447C" }}>Usar este</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {cat.auto && propios.length === 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">Todavía no se han completado las firmas del dictamen — en cuanto se firme, aparece aquí solo.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/** Genera el Dictamen Final en PDF y lo guarda como "documento fijo" en la
 *  categoría automática — se llama justo después de que se completa la
 *  última firma (jurídico + registral validados). No bloquea si falla. */
export async function autoguardarDictamenFinalSiListo(caso: CasoJuridico, area: string, blobPDF: Blob, nombreArchivo: string) {
  try {
    const ya = await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?select=id&caso_id=eq.${caso.id}&categoria_checklist=eq.dictamen_final_sistema&en_papelera=eq.false&limit=1`, { headers });
    const existe = ya.ok ? await ya.json() : [];
    if (existe?.length) return; // ya se había guardado uno — no duplicar
    const file = new File([blobPDF], nombreArchivo, { type: "application/pdf" });
    const r = await subirDocumento(area, caso, file, "otro");
    if (r.ok && r.doc) {
      await fetch(`${SUPABASE_URL}/rest/v1/documento_garantia?id=eq.${r.doc.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ categoria_checklist: "dictamen_final_sistema" }),
      });
    }
  } catch { /* no bloquea el guardado de la firma si esto falla */ }
}
