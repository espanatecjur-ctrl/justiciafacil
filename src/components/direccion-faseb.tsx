import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Send, Upload, Loader2, Check, X, Plus, Paperclip, Mail } from "lucide-react";
import { enviarCorreo, listarEnvios, revisarRespuestas, type EnvioRegistro } from "@/lib/enviar-correo";
import {
  archivoABase64, urlABase64, subirCarta, obtenerFaseB, guardarDatosFaseB, marcarEnviadoContabilidad,
  listarCorreosContabilidad, agregarCorreoContabilidad, eliminarCorreoContabilidad,
  type FaseB, type CorreoCont,
} from "@/lib/fase-b";
import type { Validacion } from "@/lib/direccion-validaciones";

export function DireccionFaseB({ sel }: { sel: Validacion | null }) {
  const [faseB, setFaseB] = useState<FaseB | null>(null);
  useEffect(() => {
    if (sel?.caso_id) obtenerFaseB(sel.caso_id, sel.expediente ?? null, sel.cliente ?? null).then(setFaseB);
    else setFaseB(null);
  }, [sel?.caso_id]); // eslint-disable-line

  if (!sel) {
    return (
      <Card className="legal-card p-8 text-center">
        <Wallet className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Ve a la pestaña <b>Validaciones +</b> y pícale “Preparar pase a Fase B” en una garantía positiva.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="legal-card border-emerald-200 p-4">
        <p className="text-sm"><span className="font-semibold">Fase B</span> · Exp. {sel.expediente || "—"}{sel.cliente ? ` · ${sel.cliente}` : ""}</p>
        {sel.garantia && <p className="mt-0.5 text-xs text-muted-foreground">Garantía: {sel.garantia}</p>}
      </Card>

      <PasoSolicitar expediente={sel.expediente || ""} />
      <PasoLlenar faseB={faseB} setFaseB={setFaseB} />
      <PasoContabilidad sel={sel} faseB={faseB} />
    </div>
  );
}

// ————————————————————— Paso 1: solicitar —————————————————————
function PasoSolicitar({ expediente }: { expediente: string }) {
  const folio = `FASEB-${expediente}`;
  const [para, setPara] = useState("");
  const [asunto, setAsunto] = useState(`Solicitud de cuentas y carta propuesta — Exp. ${expediente}`);
  const [mensaje, setMensaje] = useState("Buen día,\n\nSolicito las cuentas de pago y la carta propuesta. Adjunto los documentos requeridos.\n\nQuedo atenta.\nDIIPA · Dirección");
  const [files, setFiles] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [enviadas, setEnviadas] = useState<EnvioRegistro[]>([]);
  const inputFile = useRef<HTMLInputElement>(null);

  const recargar = () => listarEnvios().then((all) => setEnviadas(all.filter((e) => e.folio === folio)));
  useEffect(() => { recargar(); }, [folio]); // eslint-disable-line

  const [revisando, setRevisando] = useState(false);
  const revisar = async () => {
    setRevisando(true);
    const lista = enviadas
      .filter((e) => e.token && e.para && e.enviado_at)
      .map((e) => ({ token: e.token as string, para: e.para as string, enviado_at: e.enviado_at as string }));
    if (lista.length) await revisarRespuestas(lista);
    await recargar();
    setRevisando(false);
  };

  const enviar = async () => {
    if (!para.trim()) { setMsg("Escribe el correo del proveedor."); return; }
    setEnviando(true); setMsg(null);
    try {
      const adjuntos = await Promise.all(files.map((f) => archivoABase64(f)));
      const r = await enviarCorreo({ para, asunto, mensaje, folio, adjuntos });
      if (r.ok) { setMsg("Solicitud enviada ✓"); setFiles([]); recargar(); }
      else setMsg("No se pudo enviar: " + (r.error || ""));
    } catch (e) { setMsg(String((e as Error)?.message || e)); }
    setEnviando(false);
  };

  return (
    <Card className="legal-card p-5">
      <div className="flex items-center gap-2"><Paso n={1} /><h3 className="font-display text-base font-semibold">Solicitar cuentas y carta</h3></div>
      <p className="mt-1 text-sm text-muted-foreground">Por correo. Adjunta CLG, INE, acta o cualquier imagen/documento. Puedes enviar más de una.</p>

      <div className="mt-3 grid gap-2">
        <input value={para} onChange={(e) => setPara(e.target.value)} placeholder="proveedor@correo.com" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        <input value={asunto} onChange={(e) => setAsunto(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={4} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => inputFile.current?.click()}><Paperclip className="h-4 w-4 mr-1.5" /> Agregar archivos</Button>
          <input ref={inputFile} type="file" multiple className="hidden" onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files || [])])} />
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-[color:var(--teal)]/10 px-2 py-1 text-xs text-[color:var(--teal)]">{f.name}<button onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button></span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={enviar} disabled={enviando} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white"><Send className="h-4 w-4 mr-1.5" /> {enviando ? "Enviando…" : "Enviar solicitud"}</Button>
          {msg && <span className={`text-xs font-medium ${msg.startsWith("Solicitud enviada") ? "text-emerald-700" : "text-red-700"}`}>{msg}</span>}
        </div>
      </div>

      {enviadas.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Solicitudes enviadas</p>
            <Button variant="outline" size="sm" onClick={revisar} disabled={revisando}>
              {revisando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Revisar respuestas</>}
            </Button>
          </div>
          {enviadas.map((e, i) => (
            <div key={i} className="flex items-center justify-between py-1 text-sm">
              <span><Mail className="mr-1.5 inline h-3.5 w-3.5 text-muted-foreground" />{e.enviado_at ? new Date(e.enviado_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
              {e.respondido ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">Respondido</span>
              ) : (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${e.estado === "abierto" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>{e.estado === "abierto" ? "Abierto" : "Enviado"}</span>
              )}
            </div>
          ))}
          <p className="mt-1 text-[11px] text-muted-foreground">“Revisar respuestas” busca en tu bandeja si el proveedor ya contestó.</p>
        </div>
      )}
    </Card>
  );
}

// ————————————————————— Paso 2: llenar —————————————————————
function PasoLlenar({ faseB, setFaseB }: { faseB: FaseB | null; setFaseB: (f: FaseB) => void }) {
  const [banco, setBanco] = useState("");
  const [clabe, setClabe] = useState("");
  const [titular, setTitular] = useState("");
  const [carta, setCarta] = useState<{ url: string; nombre: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const inputCarta = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (faseB) {
      setBanco(faseB.banco || ""); setClabe(faseB.clabe || ""); setTitular(faseB.titular || "");
      if (faseB.carta_url) setCarta({ url: faseB.carta_url, nombre: faseB.carta_nombre || "carta" });
    }
  }, [faseB?.id]); // eslint-disable-line

  const subir = async (file?: File) => {
    if (!file) return;
    const r = await subirCarta(file);
    setCarta(r);
  };

  const guardar = async () => {
    if (!faseB?.id) return;
    setGuardando(true); setOk(false);
    const cambios: Partial<FaseB> = { banco, clabe, titular, estado: "lleno", carta_url: carta?.url ?? null, carta_nombre: carta?.nombre ?? null };
    const done = await guardarDatosFaseB(faseB.id, cambios);
    setGuardando(false);
    if (done) { setOk(true); setFaseB({ ...faseB, ...cambios }); }
  };

  return (
    <Card className="legal-card p-5">
      <div className="flex items-center gap-2"><Paso n={2} /><h3 className="font-display text-base font-semibold">Llenar lo que llegó (a mano)</h3></div>
      <p className="mt-1 text-sm text-muted-foreground">Captura las cuentas y adjunta la carta que te enviaron.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Banco" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        <input value={clabe} onChange={(e) => setClabe(e.target.value)} placeholder="CLABE / cuenta" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        <input value={titular} onChange={(e) => setTitular(e.target.value)} placeholder="Titular" className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => inputCarta.current?.click()}><Upload className="h-4 w-4 mr-1.5" /> {carta ? "Cambiar carta" : "Adjuntar carta"}</Button>
        <input ref={inputCarta} type="file" className="hidden" onChange={(e) => subir(e.target.files?.[0])} />
        {carta && <span className="inline-flex items-center gap-1 text-xs text-[color:var(--teal)]"><Check className="h-3.5 w-3.5" /> {carta.nombre}</span>}
        <span className="flex-1" />
        <Button onClick={guardar} disabled={guardando || !faseB?.id} className="bg-[#0B1E3A] hover:bg-[#0B1E3A]/90 text-white">{guardando ? "Guardando…" : "Guardar"}</Button>
        {ok && <span className="text-xs font-medium text-emerald-700">Guardado ✓</span>}
      </div>
    </Card>
  );
}

// ————————————————————— Paso 3: contabilidad —————————————————————
function PasoContabilidad({ sel, faseB }: { sel: Validacion; faseB: FaseB | null }) {
  const [correos, setCorreos] = useState<CorreoCont[]>([]);
  const [nuevo, setNuevo] = useState("");
  const [tipoNuevo, setTipoNuevo] = useState<"para" | "cco">("para");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const recargar = () => listarCorreosContabilidad().then(setCorreos);
  useEffect(() => { recargar(); }, []);

  const agregar = async () => {
    if (!nuevo.trim()) return;
    await agregarCorreoContabilidad(nuevo.trim(), tipoNuevo);
    setNuevo(""); recargar();
  };
  const quitar = async (id?: string) => { if (id) { await eliminarCorreoContabilidad(id); recargar(); } };

  const enviar = async () => {
    const para = correos.filter((c) => c.tipo === "para").map((c) => c.correo).join(", ");
    const cco = correos.filter((c) => c.tipo === "cco").map((c) => c.correo).join(", ");
    if (!para) { setMsg("Agrega al menos un correo en 'Para'."); return; }
    if (!window.confirm("¿Ya adjuntaste la carta y capturaste las cuentas? Se enviará a contabilidad.")) return;
    setEnviando(true); setMsg(null);
    try {
      const adjuntos: { nombre: string; tipo: string; base64: string }[] = [];
      if (faseB?.carta_url) adjuntos.push({ nombre: faseB.carta_nombre || "carta.pdf", tipo: "application/pdf", base64: await urlABase64(faseB.carta_url) });
      const cuentas = `Banco: ${faseB?.banco || "—"}\nCLABE/Cuenta: ${faseB?.clabe || "—"}\nTitular: ${faseB?.titular || "—"}`;
      const mensaje = `Para pre-cobro.\n\nExpediente: ${sel.expediente || "—"}\nCliente: ${sel.cliente || "—"}\n\nCuentas de pago:\n${cuentas}\n\nSe adjunta la carta propuesta.\n\nDIIPA · Dirección`;
      const r = await enviarCorreo({ para, cco, asunto: `Pre-cobro — Exp. ${sel.expediente || ""}`, mensaje, folio: `FASEB-${sel.expediente}`, adjuntos });
      if (r.ok) { setMsg("Enviado a contabilidad ✓"); if (faseB?.id) marcarEnviadoContabilidad(faseB.id); }
      else setMsg("No se pudo enviar: " + (r.error || ""));
    } catch (e) { setMsg(String((e as Error)?.message || e)); }
    setEnviando(false);
  };

  return (
    <Card className="legal-card p-5">
      <div className="flex items-center gap-2"><Paso n={3} /><h3 className="font-display text-base font-semibold">Enviar a contabilidad (pre-cobro)</h3></div>
      <p className="mt-1 text-sm text-muted-foreground">Los correos guardados se pre-cargan; tú revisas y envías. Los “cco” van ocultos.</p>

      <div className="mt-3">
        <p className="text-xs text-muted-foreground">Correos guardados</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {correos.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
              {c.correo} <span className="text-[10px] uppercase text-muted-foreground">{c.tipo}</span>
              <button onClick={() => quitar(c.id)}><X className="h-3 w-3" /></button>
            </span>
          ))}
          {correos.length === 0 && <span className="text-xs text-muted-foreground">Aún no hay correos. Agrégalos abajo.</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="correo@…" className="h-9 flex-1 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm" />
          <select value={tipoNuevo} onChange={(e) => setTipoNuevo(e.target.value as "para" | "cco")} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="para">Para</option>
            <option value="cco">Copia oculta</option>
          </select>
          <Button variant="outline" size="sm" onClick={agregar}><Plus className="h-4 w-4 mr-1.5" /> Agregar correo</Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button onClick={enviar} disabled={enviando} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white"><Send className="h-4 w-4 mr-1.5" /> {enviando ? "Enviando…" : "Revisar y enviar a contabilidad"}</Button>
        {msg && <span className={`text-xs font-medium ${msg.startsWith("Enviado") ? "text-emerald-700" : "text-red-700"}`}>{msg}</span>}
      </div>
    </Card>
  );
}

function Paso({ n }: { n: number }) {
  return <span className="grid h-6 w-6 place-items-center rounded-full bg-[color:var(--teal)]/15 text-xs font-semibold text-[color:var(--teal)]">{n}</span>;
}
