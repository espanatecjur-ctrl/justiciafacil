import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { correoActual, rolActual } from "@/lib/auth";
import { FileText, Loader2, Check, AlertTriangle, ChevronDown, ChevronUp, ScrollText, DollarSign, ShieldCheck, Package, Pencil, X, Send, Mail, Copy } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);
const TIPO_LABEL: Record<string, string> = { cesion: "Cesión de derechos", instruccion_notarial: "Instrucción notarial", solicitud_cotizacion: "Solicitud de cotización", solicitud_formalizacion: "Solicitud de formalización" };
const MARCA = "FALTA POR CAPTURAR";

interface Doc {
  id: string; tipo: string; folio: string | null; contenido: string | null; precio: number | null; docs_faltantes: string | null; info_faltante: string | null;
  val_urrj: boolean | null; val_urrj_por: string | null; val_urrj_fecha: string | null;
  val_gad: boolean | null; val_gad_por: string | null; val_gad_fecha: string | null;
  val_dil: boolean | null; val_dil_por: string | null; val_dil_fecha: string | null;
}
const puede = (rol: string, quien: "urrj" | "gad" | "dil") => {
  const r = (rol || "").toUpperCase();
  if (r.includes("DGE") || r.includes("SUPER") || r === "") return true;
  if (quien === "urrj") return r.includes("URRJ");
  if (quien === "gad") return r.includes("GAD");
  if (quien === "dil") return r.includes("DIL") || r.includes("DGE");
  return false;
};
const estadoDe = (i: Doc) => (i.val_urrj && i.val_gad && i.val_dil) ? "listo" : (i.val_urrj || i.val_gad || i.val_dil) ? "en_validacion" : "revisar";

export function ContratosCliente({ clienteIds, clienteNombre }: { clienteIds: string[]; clienteNombre?: string }) {
  const [lista, setLista] = useState<Doc[]>([]);
  const [cargando, setCargando] = useState(true);
  const [rol, setRol] = useState("");
  const [correo, setCorreo] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [completar, setCompletar] = useState<Doc | null>(null);
  const [enviar, setEnviar] = useState<Doc | null>(null);

  const cargar = () => {
    if (clienteIds.length === 0) { setCargando(false); return; }
    fetch(`${SUPABASE_URL}/rest/v1/instruccion_cliente?select=*&cliente_id=in.(${clienteIds.join(",")})&en_papelera=eq.false&order=tipo.asc,folio.asc`, { headers })
      .then((r) => (r.ok ? r.json() : [])).then(setLista).catch(() => {}).finally(() => setCargando(false));
  };
  useEffect(() => { setCargando(true); cargar(); rolActual().then(setRol).catch(() => {}); correoActual().then((c) => setCorreo(c || "")).catch(() => {}); }, [clienteIds.join(",")]);

  const validar = async (i: Doc, quien: "urrj" | "gad" | "dil") => {
    const now = new Date().toISOString();
    const patch: any = {};
    if (quien === "urrj") { patch.val_urrj = true; patch.val_urrj_por = correo; patch.val_urrj_fecha = now; }
    if (quien === "gad") { patch.val_gad = true; patch.val_gad_por = correo; patch.val_gad_fecha = now; }
    if (quien === "dil") { patch.val_dil = true; patch.val_dil_por = correo; patch.val_dil_fecha = now; }
    const next = { ...i, ...patch };
    patch.estado = (next.val_urrj && next.val_gad && next.val_dil) ? "listo" : "en_validacion";
    await fetch(`${SUPABASE_URL}/rest/v1/instruccion_cliente?id=eq.${i.id}`, { method: "PATCH", headers, body: JSON.stringify(patch) });
    cargar();
  };

  if (cargando) return <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando contratos…</div>;
  if (lista.length === 0) return <p className="p-4 text-center text-xs text-muted-foreground">Este cliente aún no tiene contratos ni instrucciones generadas.</p>;

  const chip = (ok: boolean | null, label: string, icon: React.ReactNode) => (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-muted text-muted-foreground"}`}>{icon} {label} {ok ? <Check className="h-3 w-3" /> : null}</span>
  );

  return (
    <>
      <div className="divide-y divide-border">
        {lista.map((i) => {
          const est = estadoDe(i);
          const open = abierto === i.id;
          const faltanDocs = (i.docs_faltantes || "").toLowerCase() !== "completos" && (i.docs_faltantes || "").trim() !== "";
          const faltaInfo = i.info_faltante && i.info_faltante !== "Completa";
          return (
            <div key={i.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium"><FileText className="h-3.5 w-3.5 text-[color:var(--teal)]" /> {TIPO_LABEL[i.tipo] || i.tipo}</p>
                  <p className="text-[11px] text-muted-foreground">Folio {i.folio} · {fmtMXN(i.precio)}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${est === "listo" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : est === "en_validacion" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-border bg-muted text-muted-foreground"}`}>{est === "listo" ? "Listo" : est === "en_validacion" ? "En validación" : "Revisar"}</span>
              </div>

              {faltanDocs && <p className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800"><AlertTriangle className="h-3 w-3" /> Faltan documentos: {i.docs_faltantes}</p>}
              {faltaInfo && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800"><AlertTriangle className="h-3 w-3" /> Falta info por capturar: {i.info_faltante}</span>
                  <button onClick={() => setCompletar(i)} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: "var(--teal)" }}><Pencil className="h-3 w-3" /> Completar datos</button>
                </div>
              )}
              {est === "listo" && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 px-2 py-0.5 text-[11px] font-medium text-[color:var(--teal)]"><Package className="h-3 w-3" /> Falta mandar paquete para formalizar</span>
                  <button onClick={() => setEnviar(i)} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: "#C2A24C", color: "#0B1E3A" }}><Send className="h-3 w-3" /> Enviar por correo</button>
                </div>
              )}

              {/* Validaciones */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {chip(i.val_urrj, "URRJ", <ScrollText className="h-3 w-3" />)}
                {!i.val_urrj && puede(rol, "urrj") && <button onClick={() => validar(i, "urrj")} className="rounded-md border border-input px-2 py-0.5 text-[11px] font-medium hover:bg-muted">Validar instrucciones</button>}
                {chip(i.val_gad, "GAD precios", <DollarSign className="h-3 w-3" />)}
                {!i.val_gad && puede(rol, "gad") && <button onClick={() => validar(i, "gad")} className="rounded-md border border-input px-2 py-0.5 text-[11px] font-medium hover:bg-muted">Validar precios</button>}
                {chip(i.val_dil, "DIL/DGE", <ShieldCheck className="h-3 w-3" />)}
                {!i.val_dil && puede(rol, "dil") && <button onClick={() => validar(i, "dil")} disabled={!i.val_urrj} className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-40" style={{ background: "var(--teal)" }}>Cerrar validación</button>}
              </div>

              <button onClick={() => setAbierto(open ? null : i.id)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--teal)] hover:underline">{open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} {open ? "Ocultar documento" : "Ver documento"}</button>
              {open && (
                <div className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-border bg-white p-6 shadow-inner">
                  <div className="mx-auto max-w-2xl whitespace-pre-wrap text-justify text-[13px] leading-relaxed text-gray-800" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>{i.contenido}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {completar && <BannerCompletar doc={completar} onClose={() => setCompletar(null)} onHecho={() => { setCompletar(null); cargar(); }} />}
      {enviar && <BannerEnviar doc={enviar} clienteNombre={clienteNombre} onClose={() => setEnviar(null)} />}
    </>
  );
}

// ---- Banner flotante: completar datos faltantes en casillas ----
function BannerCompletar({ doc, onClose, onHecho }: { doc: Doc; onClose: () => void; onHecho: () => void }) {
  const campos = (doc.info_faltante || "").split(",").map((s) => s.trim()).filter(Boolean);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    // Reemplaza cada «FALTA POR CAPTURAR» en orden con el valor capturado
    let cuerpo = doc.contenido || "";
    const restantes: string[] = [];
    for (const c of campos) {
      const v = (vals[c] || "").trim();
      if (v) {
        cuerpo = cuerpo.replace(MARCA, v);
      } else {
        restantes.push(c);
      }
    }
    const nuevoFaltante = restantes.length ? restantes.join(", ") : "Completa";
    await fetch(`${SUPABASE_URL}/rest/v1/instruccion_cliente?id=eq.${doc.id}`, {
      method: "PATCH", headers, body: JSON.stringify({ contenido: cuerpo, info_faltante: nuevoFaltante }),
    });
    setGuardando(false); onHecho();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-[22rem] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border bg-[color:var(--teal)]/10 px-3 py-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Pencil className="h-4 w-4 text-[color:var(--teal)]" /> Completar datos</p>
        <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-2 p-3">
        <p className="text-[11px] text-muted-foreground">Captura los datos que faltan; se llenan directo en el documento.</p>
        {campos.map((c) => (
          <div key={c}>
            <label className="text-[11px] font-medium">{c}</label>
            <input value={vals[c] || ""} onChange={(e) => setVals((p) => ({ ...p, [c]: e.target.value }))} placeholder={`Escribe el ${c}`} className="mt-0.5 w-full rounded-md border border-input px-2 py-1.5 text-sm" />
          </div>
        ))}
        <button onClick={guardar} disabled={guardando} className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--teal)" }}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Guardar y actualizar documento
        </button>
      </div>
    </div>
  );
}

// ---- Banner flotante: enviar por correo (estilo MSN, abajo-derecha) ----
function BannerEnviar({ doc, clienteNombre, onClose }: { doc: Doc; clienteNombre?: string; onClose: () => void }) {
  const [para, setPara] = useState("");
  const [copiado, setCopiado] = useState(false);
  const asunto = `${TIPO_LABEL[doc.tipo] || "Documento"} — ${clienteNombre || ""} (${doc.folio || ""})`.trim();
  const cuerpo = `Buen día:\n\nAdjunto/copio el documento "${TIPO_LABEL[doc.tipo] || "documento"}" ${doc.folio ? "(" + doc.folio + ")" : ""} para su revisión y trámite de formalización.\n\n${doc.contenido || ""}\n\nSaludos.\nDIIPA · Área Jurídica`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(para)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  const outlook = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(para)}&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  const mailto = `mailto:${encodeURIComponent(para)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  const copiar = async () => { try { await navigator.clipboard.writeText(`Para: ${para}\nAsunto: ${asunto}\n\n${cuerpo}`); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { /* ignore */ } };

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-[24rem] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2" style={{ background: "#0B1E3A" }}>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-white"><Mail className="h-4 w-4" style={{ color: "#C2A24C" }} /> Enviar por correo</p>
        <button onClick={onClose} className="rounded-md p-1 hover:bg-white/10"><X className="h-4 w-4 text-white" /></button>
      </div>
      <div className="space-y-2 p-3">
        <div>
          <label className="text-[11px] font-medium">Para</label>
          <input value={para} onChange={(e) => setPara(e.target.value)} placeholder="correo@ejemplo.com" className="mt-0.5 w-full rounded-md border border-input px-2 py-1.5 text-sm" />
        </div>
        <p className="text-[11px] text-muted-foreground"><b>Asunto:</b> {asunto}</p>
        <div className="grid grid-cols-3 gap-1.5">
          <a href={gmail} target="_blank" rel="noreferrer" className="rounded-md border border-input px-2 py-1.5 text-center text-[11px] font-medium hover:bg-muted">Gmail</a>
          <a href={outlook} target="_blank" rel="noreferrer" className="rounded-md border border-input px-2 py-1.5 text-center text-[11px] font-medium hover:bg-muted">Outlook</a>
          <a href={mailto} className="rounded-md border border-input px-2 py-1.5 text-center text-[11px] font-medium hover:bg-muted">Correo</a>
        </div>
        <button onClick={copiar} className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium hover:bg-muted"><Copy className="h-3 w-3" /> {copiado ? "¡Copiado!" : "Copiar texto"}</button>
        <p className="text-[10px] text-muted-foreground">Se abre tu correo con el mensaje listo; tú lo revisas y lo envías.</p>
      </div>
    </div>
  );
}
