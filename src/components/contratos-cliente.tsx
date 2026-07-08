import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { correoActual, rolActual } from "@/lib/auth";
import { FileText, Loader2, Check, AlertTriangle, ChevronDown, ChevronUp, ScrollText, DollarSign, ShieldCheck, Package } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);
const TIPO_LABEL: Record<string, string> = { cesion: "Cesión de derechos", instruccion_notarial: "Instrucción notarial", solicitud_cotizacion: "Solicitud de cotización", solicitud_formalizacion: "Solicitud de formalización" };

interface Doc {
  id: string; tipo: string; folio: string | null; contenido: string | null; precio: number | null; docs_faltantes: string | null;
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

// Contratos y documentos del cliente (todas sus garantías) con su validación.
export function ContratosCliente({ clienteIds }: { clienteIds: string[] }) {
  const [lista, setLista] = useState<Doc[]>([]);
  const [cargando, setCargando] = useState(true);
  const [rol, setRol] = useState("");
  const [correo, setCorreo] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);

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
    <div className="divide-y divide-border">
      {lista.map((i) => {
        const est = estadoDe(i);
        const open = abierto === i.id;
        const faltan = (i.docs_faltantes || "").toLowerCase() !== "completos" && (i.docs_faltantes || "").trim() !== "";
        return (
          <div key={i.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium"><FileText className="h-3.5 w-3.5 text-[color:var(--teal)]" /> {TIPO_LABEL[i.tipo] || i.tipo}</p>
                <p className="text-[11px] text-muted-foreground">Folio {i.folio} · {fmtMXN(i.precio)}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${est === "listo" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : est === "en_validacion" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-border bg-muted text-muted-foreground"}`}>{est === "listo" ? "Listo" : est === "en_validacion" ? "En validación" : "Revisar"}</span>
            </div>
            {faltan && <p className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800"><AlertTriangle className="h-3 w-3" /> Faltan documentos: {i.docs_faltantes}</p>}
            {est === "listo" && <p className="mt-1 inline-flex items-center gap-1 rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 px-2 py-0.5 text-[11px] font-medium text-[color:var(--teal)]"><Package className="h-3 w-3" /> Falta mandar paquete para formalizar</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {chip(i.val_urrj, "URRJ", <ScrollText className="h-3 w-3" />)}
              {!i.val_urrj && puede(rol, "urrj") && <button onClick={() => validar(i, "urrj")} className="rounded-md border border-input px-2 py-0.5 text-[11px] font-medium hover:bg-muted">Validar instrucciones</button>}
              {chip(i.val_gad, "GAD precios", <DollarSign className="h-3 w-3" />)}
              {!i.val_gad && puede(rol, "gad") && <button onClick={() => validar(i, "gad")} className="rounded-md border border-input px-2 py-0.5 text-[11px] font-medium hover:bg-muted">Validar precios</button>}
              {chip(i.val_dil, "DIL/DGE", <ShieldCheck className="h-3 w-3" />)}
              {!i.val_dil && puede(rol, "dil") && <button onClick={() => validar(i, "dil")} disabled={!i.val_urrj} className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-40" style={{ background: "var(--teal)" }}>Cerrar validación</button>}
            </div>
            <button onClick={() => setAbierto(open ? null : i.id)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--teal)] hover:underline">{open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} {open ? "Ocultar documento" : "Ver documento"}</button>
            {open && <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-[11px] leading-relaxed">{i.contenido}</pre>}
          </div>
        );
      })}
    </div>
  );
}
