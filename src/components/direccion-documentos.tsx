import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2, Check, Send, Paperclip } from "lucide-react";
import { usuarioActualEtiqueta } from "@/lib/auth";
import {
  casosParaSelector, subirDocPredictamen, crearSolicitudPredictamen, listarSolicitudesPredictamen,
  type CasoOpcion, type DocRef, type SolicitudPredictamen,
} from "@/lib/solicitud-predictamen";

export function DireccionDocumentos() {
  const [casos, setCasos] = useState<CasoOpcion[]>([]);
  const [casoId, setCasoId] = useState("");
  const [area, setArea] = useState("URRJ");
  const [tipoDictamen, setTipoDictamen] = useState("Jurídico");
  const [nota, setNota] = useState("");
  const [docs, setDocs] = useState<DocRef[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lista, setLista] = useState<SolicitudPredictamen[]>([]);
  const inputFile = useRef<HTMLInputElement>(null);

  const recargar = () => listarSolicitudesPredictamen("pendiente").then(setLista);
  useEffect(() => { casosParaSelector().then(setCasos); recargar(); }, []);

  const caso = casos.find((c) => c.id === casoId);

  const onArchivos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setSubiendo(true);
    setMsg(null);
    try {
      for (const f of Array.from(files)) {
        const ref = await subirDocPredictamen(f);
        setDocs((d) => [...d, ref]);
      }
    } catch (e) {
      setMsg(String((e as Error)?.message || e));
    }
    setSubiendo(false);
    if (inputFile.current) inputFile.current.value = "";
  };

  const enviar = async () => {
    if (!casoId) { setMsg("Escoge la garantía / expediente."); return; }
    if (!area) { setMsg("Escoge el área a la que van los documentos."); return; }
    if (!docs.length) { setMsg("Sube al menos un documento."); return; }
    setEnviando(true);
    setMsg(null);
    const quien = await usuarioActualEtiqueta();
    const usaTipo = area === "URRJ" || area === "UCP";
    const r = await crearSolicitudPredictamen({
      caso_id: casoId,
      expediente: caso?.expediente ?? null,
      cliente: caso?.cliente_nombre ?? null,
      juzgado: caso?.juzgado ?? null,
      area,
      tipo_dictamen: usaTipo ? tipoDictamen : null,
      nota: nota || null,
      documentos: docs,
      solicitado_por: quien,
    });
    setEnviando(false);
    if (r.ok) {
      setMsg("Enviado a pre-dictaminar ✓");
      setCasoId(""); setNota(""); setDocs([]);
      recargar();
    } else {
      setMsg("No se pudo enviar: " + (r.error || "") + " (¿corriste el SQL de solicitud_predictamen?)");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="legal-card p-5">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-[color:var(--teal)]" />
          <h3 className="font-display text-base font-semibold">Documentos → pre-dictamen</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Sube documentos de una garantía y mándalos a pre-dictaminar.</p>

        <div className="mt-4 grid gap-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Garantía / expediente</label>
            <select value={casoId} onChange={(e) => setCasoId(e.target.value)}
              className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">— Escoge —</option>
              {casos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.expediente || "s/exp"}{c.cliente_nombre ? ` · ${c.cliente_nombre}` : ""}
                </option>
              ))}
            </select>
          </div>

          {caso && (
            <p className="text-xs text-muted-foreground">
              {caso.cliente_nombre ? <>Cliente: <b>{caso.cliente_nombre}</b> · </> : null}{caso.juzgado || "Sin juzgado"}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Área a la que van</label>
              <select value={area} onChange={(e) => setArea(e.target.value)}
                className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="URRJ">URRJ · Resolución Jurídica</option>
                <option value="UCP">UCP · Consolidación Patrimonial</option>
                <option value="UFC">UFC · Formalizaciones</option>
                <option value="UDP">UDP · Defensa y Protección</option>
              </select>
            </div>
            {(area === "URRJ" || area === "UCP") && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Tipo de dictamen</label>
                <select value={tipoDictamen} onChange={(e) => setTipoDictamen(e.target.value)}
                  className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="Jurídico">Jurídico (¿es litigable?)</option>
                  <option value="Registral">Registral (RPPC)</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Nota para el dictaminador (opcional)</label>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2}
              className="mt-0.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Documentos</label>
            <div
              onClick={() => inputFile.current?.click()}
              className="mt-0.5 cursor-pointer rounded-lg border border-dashed border-border bg-muted/20 p-5 text-center text-sm text-muted-foreground hover:bg-muted/40"
            >
              {subiendo ? <><Loader2 className="mx-auto mb-1 h-5 w-5 animate-spin" /> Subiendo…</> : <><Upload className="mx-auto mb-1 h-5 w-5" /> Da clic para subir documentos</>}
            </div>
            <input ref={inputFile} type="file" multiple className="hidden" onChange={(e) => onArchivos(e.target.files)} />
            {docs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {docs.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--teal)]/10 px-2.5 py-1 text-xs text-[color:var(--teal)]">
                    <FileText className="h-3.5 w-3.5" /> {d.nombre}
                    <button onClick={() => setDocs((x) => x.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={enviar} disabled={enviando || subiendo} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
              <Send className="h-4 w-4 mr-1.5" /> {enviando ? "Enviando…" : "Enviar a pre-dictaminar"}
            </Button>
            {msg && <span className={`text-xs font-medium ${msg.startsWith("Enviado") ? "text-emerald-700" : "text-red-700"}`}>{msg}</span>}
          </div>
        </div>
      </Card>

      <Card className="legal-card p-5">
        <h3 className="font-display text-base font-semibold">Enviadas a pre-dictaminar (pendientes)</h3>
        {lista.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {lista.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-semibold">Exp. {s.expediente || "—"} {s.cliente ? <span className="font-normal text-muted-foreground">· {s.cliente}</span> : null}</p>
                  <p className="text-xs text-muted-foreground">
                    <Paperclip className="mr-1 inline h-3 w-3" />{s.documentos?.length || 0} documento(s){s.created_at ? ` · ${new Date(s.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {s.area && <span className="rounded-full bg-[color:var(--teal)]/10 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--teal)]">{s.area}</span>}
                    {s.tipo_dictamen && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Dictamen {s.tipo_dictamen}</span>}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                  <Check className="h-3 w-3" /> En pre-dictamen
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
