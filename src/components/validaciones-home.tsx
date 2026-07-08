import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { correoActual, rolActual } from "@/lib/auth";
import { ShieldCheck, Loader2, Check, AlertTriangle, ScrollText, DollarSign, ChevronRight } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);

interface Ins {
  id: string; caso_id: string | null; folio: string | null; precio: number | null; docs_faltantes: string | null;
  val_urrj: boolean | null; val_gad: boolean | null; val_dil: boolean | null;
  cliente_juicio?: { nombre: string | null } | null;
  caso_juridico?: { expediente: string | null } | null;
}

const puede = (rol: string, quien: "urrj" | "gad" | "dil") => {
  const r = (rol || "").toUpperCase();
  if (r.includes("DGE") || r.includes("SUPER") || r === "") return true;
  if (quien === "urrj") return r.includes("URRJ");
  if (quien === "gad") return r.includes("GAD");
  if (quien === "dil") return r.includes("DIL") || r.includes("DGE");
  return false;
};

export function ValidacionesHome() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<Ins[]>([]);
  const [cargando, setCargando] = useState(true);
  const [rol, setRol] = useState("");
  const [correo, setCorreo] = useState("");

  const cargar = () => fetch(`${SUPABASE_URL}/rest/v1/instruccion_cliente?select=id,caso_id,folio,precio,docs_faltantes,val_urrj,val_gad,val_dil,cliente_juicio(nombre),caso_juridico(expediente)&en_papelera=eq.false&order=created_at.desc`, { headers })
    .then((r) => (r.ok ? r.json() : [])).then(setLista).catch(() => {}).finally(() => setCargando(false));
  useEffect(() => { cargar(); rolActual().then(setRol).catch(() => {}); correoActual().then((c) => setCorreo(c || "")).catch(() => {}); }, []);

  // lo que ESTE usuario puede validar y aún está pendiente
  const pendientesMios = lista.filter((i) => {
    if (puede(rol, "urrj") && !i.val_urrj) return true;
    if (puede(rol, "gad") && !i.val_gad) return true;
    if (puede(rol, "dil") && i.val_urrj && !i.val_dil) return true;
    return false;
  });

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

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[color:var(--teal)]" />
        <h3 className="text-sm font-semibold">Validaciones pendientes</h3>
        {!cargando && <span className="ml-auto rounded-full bg-[color:var(--teal)]/10 px-2 py-0.5 text-xs font-semibold text-[color:var(--teal)]">{pendientesMios.length}</span>}
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">Tu rol: <b className="text-foreground">{rol || "—"}</b> · URRJ instrucciones · GAD precios · DIL/DGE cierra</p>

      {cargando ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : pendientesMios.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">No tienes validaciones pendientes. 🎉</p>
      ) : (
        <div className="space-y-2">
          {pendientesMios.slice(0, 12).map((i) => {
            const faltan = (i.docs_faltantes || "").toLowerCase() !== "completos" && (i.docs_faltantes || "").trim() !== "";
            return (
              <div key={i.id} className="rounded-lg border border-border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => i.cliente_juicio?.nombre && navigate({ to: "/cliente", search: { nombre: i.cliente_juicio.nombre } as any })} className="min-w-0 text-left">
                    <p className="truncate text-sm font-medium">{i.cliente_juicio?.nombre || "—"}</p>
                    <p className="text-[11px] text-muted-foreground">{i.folio} · {fmtMXN(i.precio)} · Exp. {i.caso_juridico?.expediente || "—"}</p>
                  </button>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                {faltan && <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-700"><AlertTriangle className="h-3 w-3" /> Faltan: {i.docs_faltantes}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {puede(rol, "urrj") && !i.val_urrj && <button onClick={() => validar(i, "urrj")} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted"><ScrollText className="h-3 w-3" /> Validar instrucciones</button>}
                  {puede(rol, "gad") && !i.val_gad && <button onClick={() => validar(i, "gad")} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted"><DollarSign className="h-3 w-3" /> Validar precios</button>}
                  {puede(rol, "dil") && i.val_urrj && !i.val_dil && <button onClick={() => validar(i, "dil")} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white" style={{ background: "var(--teal)" }}><Check className="h-3 w-3" /> Cerrar validación</button>}
                </div>
              </div>
            );
          })}
          {pendientesMios.length > 12 && <p className="pt-1 text-center text-[11px] text-muted-foreground">y {pendientesMios.length - 12} más…</p>}
        </div>
      )}
    </div>
  );
}
