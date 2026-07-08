import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { correoActual, rolActual } from "@/lib/auth";
import { FileText, Loader2, Check, AlertTriangle, ChevronDown, ChevronUp, ScrollText, DollarSign, ShieldCheck } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);
const fecha = (s: string | null) => s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "";

interface Ins {
  id: string; folio: string | null; tipo: string; contenido: string | null;
  precio: number | null; precio_letra: string | null; docs_faltantes: string | null; estado: string | null;
  val_urrj: boolean | null; val_urrj_por: string | null; val_urrj_fecha: string | null;
  val_gad: boolean | null; val_gad_por: string | null; val_gad_fecha: string | null;
  val_dil: boolean | null; val_dil_por: string | null; val_dil_fecha: string | null;
  cliente_juicio?: { nombre: string | null; folio: string | null; domicilio_garantia: string | null } | null;
}

// puede validar: DGE y Super_Admin todo; DIL cierra; GAD precios; URRJ instrucciones.
const puede = (rol: string, quien: "urrj" | "gad" | "dil") => {
  const r = (rol || "").toUpperCase();
  if (r.includes("DGE") || r.includes("SUPER") || r === "") return true; // DGE/Super_Admin (y fail-open si no se detecta)
  if (quien === "urrj") return r.includes("URRJ");
  if (quien === "gad") return r.includes("GAD");
  if (quien === "dil") return r.includes("DIL") || r.includes("DGE");
  return false;
};

export function InstruccionesPanel({ casoId }: { casoId: string }) {
  const [lista, setLista] = useState<Ins[]>([]);
  const [cargando, setCargando] = useState(true);
  const [rol, setRol] = useState("");
  const [correo, setCorreo] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);

  const cargar = () => fetch(`${SUPABASE_URL}/rest/v1/instruccion_cliente?select=*,cliente_juicio(nombre,folio,domicilio_garantia)&caso_id=eq.${casoId}&en_papelera=eq.false&order=folio.asc`, { headers })
    .then((r) => (r.ok ? r.json() : [])).then(setLista).catch(() => {}).finally(() => setCargando(false));
  useEffect(() => { cargar(); rolActual().then(setRol).catch(() => {}); correoActual().then((c) => setCorreo(c || "")).catch(() => {}); }, [casoId]);

  const estadoDe = (i: Ins) => (i.val_urrj && i.val_gad && i.val_dil) ? "listo" : (i.val_urrj || i.val_gad || i.val_dil) ? "en_validacion" : "revisar";

  const validar = async (i: Ins, quien: "urrj" | "gad" | "dil") => {
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

  if (cargando) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando instrucciones…</div>;
  if (lista.length === 0) return <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Aún no hay instrucciones generadas para este juicio.</div>;

  const listos = lista.filter((i) => estadoDe(i) === "listo").length;

  const chip = (ok: boolean | null, por: string | null, fch: string | null, label: string, icon: React.ReactNode) => (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-muted text-muted-foreground"}`} title={ok && por ? `${por} · ${fecha(fch)}` : "Pendiente"}>
      {icon} {label} {ok ? <Check className="h-3 w-3" /> : null}
    </span>
  );

  const btn = (i: Ins, quien: "urrj" | "gad" | "dil", label: string, disabled?: boolean) => (
    <button onClick={() => validar(i, quien)} disabled={disabled}
      className="rounded-md px-2 py-1 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" style={{ background: "var(--teal)" }}>
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-[color:var(--teal)]" /><span className="text-sm font-semibold">{lista.length} instrucciones</span></div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">{listos} listas</span>
        <span className="ml-auto text-[11px] text-muted-foreground">Tu rol: <b className="text-foreground">{rol || "—"}</b> · URRJ valida instrucciones · GAD precios · DIL/DGE cierra</span>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {lista.map((i) => {
          const est = estadoDe(i);
          const open = abierto === i.id;
          const faltan = (i.docs_faltantes || "").toLowerCase() !== "completos" && (i.docs_faltantes || "").trim() !== "";
          return (
            <div key={i.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{i.cliente_juicio?.nombre || "—"}</p>
                  <p className="text-[11px] text-muted-foreground">Folio {i.folio} · {fmtMXN(i.precio)}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${est === "listo" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : est === "en_validacion" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-border bg-muted text-muted-foreground"}`}>
                  {est === "listo" ? "Lista" : est === "en_validacion" ? "En validación" : "Revisar"}
                </span>
              </div>

              {faltan && <p className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800"><AlertTriangle className="h-3 w-3" /> Faltan documentos: {i.docs_faltantes}</p>}

              {/* Validaciones */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {chip(i.val_urrj, i.val_urrj_por, i.val_urrj_fecha, "URRJ", <ScrollText className="h-3 w-3" />)}
                {!i.val_urrj && puede(rol, "urrj") && btn(i, "urrj", "Validar instrucciones")}
                {chip(i.val_gad, i.val_gad_por, i.val_gad_fecha, "GAD precios", <DollarSign className="h-3 w-3" />)}
                {!i.val_gad && puede(rol, "gad") && btn(i, "gad", "Validar precios")}
                {chip(i.val_dil, i.val_dil_por, i.val_dil_fecha, "DIL/DGE", <ShieldCheck className="h-3 w-3" />)}
                {!i.val_dil && puede(rol, "dil") && btn(i, "dil", "Cerrar validación", !i.val_urrj)}
              </div>
              {!i.val_dil && !i.val_urrj && puede(rol, "dil") && <p className="mt-1 text-[10px] text-muted-foreground">DIL/DGE cierra después de que URRJ valide las instrucciones.</p>}

              <button onClick={() => setAbierto(open ? null : i.id)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--teal)] hover:underline">
                {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} {open ? "Ocultar documento" : "Ver documento"}
              </button>
              {open && <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-[11px] leading-relaxed">{i.contenido}</pre>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
