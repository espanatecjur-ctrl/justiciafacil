import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, ChevronRight, Lock } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { listarCadenaFirmasPendientes, SLOT_LABEL, type PendienteCadena } from "@/lib/cadena-firmas-dashboard";
import { listarSolicitudes, type SolicitudContrato } from "@/lib/solicitud-contrato";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

type Modulo = "UCM" | "UCP" | "URRJ" | "Contratos" | "Escritos" | "Liquidación" | "UDP" | "UFC";
const MODULOS: Modulo[] = ["UCM", "UCP", "URRJ", "Contratos", "Escritos", "Liquidación", "UDP", "UFC"];
const SIN_VALIDACION: Modulo[] = ["Escritos", "Liquidación", "UDP", "UFC"];

const COLOR_SLOT: Record<string, string> = {
  elabora: "bg-slate-100 text-slate-700",
  dil: "bg-blue-100 text-blue-800",
  ucm: "bg-purple-100 text-purple-800",
  dge: "bg-amber-100 text-amber-800",
  precio: "bg-emerald-100 text-emerald-800",
  gad: "bg-slate-100 text-slate-700",
  dgc: "bg-slate-100 text-slate-700",
};

function hace(fechaISO: string): string {
  const dias = Math.floor((Date.now() - new Date(fechaISO).getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "hace 1 día";
  return `hace ${dias} días`;
}

interface Instruccion {
  id: string; caso_id: string | null; folio: string | null; docs_faltantes: string | null;
  val_urrj: boolean | null; val_gad: boolean | null; val_dil: boolean | null;
  cliente_juicio?: { nombre: string | null } | null;
  caso_juridico?: { expediente: string | null } | null;
}

interface DictamenRegistral {
  id: string; expediente: string | null; acreditado: string | null; resultado: string | null;
  firma_elabora: any; firma_valida: any; created_at: string;
}

interface ItemRol {
  key: string; rol: string; tipo: "Jurídico" | "Registral"; etiqueta: string;
  cliente: string; expediente: string; fecha: string;
  onClick?: () => void;
}

const ORDEN_ROLES = ["Elabora (URRJ)", "DIL", "UCM", "Contabilidad", "DGE"];
const ROL_POR_SLOT: Record<string, string> = { elabora: "Elabora (URRJ)", dil: "DIL", ucm: "UCM", precio: "Contabilidad", dge: "DGE" };

export function InicioValidaciones() {
  const navigate = useNavigate();
  const [modulo, setModulo] = useState<Modulo>("URRJ");
  const [cargando, setCargando] = useState(true);
  const [firmas, setFirmas] = useState<PendienteCadena[]>([]);
  const [registral, setRegistral] = useState<DictamenRegistral[]>([]);
  const [instrucciones, setInstrucciones] = useState<Instruccion[]>([]);
  const [contratos, setContratos] = useState<SolicitudContrato[]>([]);

  useEffect(() => {
    setCargando(true);
    Promise.all([
      listarCadenaFirmasPendientes(),
      fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral?select=id,expediente,acreditado,resultado,firma_elabora,firma_valida,created_at&terminado=eq.false&order=created_at.desc&limit=200`, { headers })
        .then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${SUPABASE_URL}/rest/v1/instruccion_cliente?select=id,caso_id,folio,docs_faltantes,val_urrj,val_gad,val_dil,cliente_juicio(nombre),caso_juridico(expediente)&en_papelera=eq.false&order=created_at.desc`, { headers })
        .then((r) => (r.ok ? r.json() : [])).catch(() => []),
      listarSolicitudes(),
    ]).then(([f, r, i, c]) => {
      setFirmas(f);
      setRegistral(r);
      setInstrucciones((i as Instruccion[]).filter((x) => !x.val_urrj || !x.val_gad || !x.val_dil));
      setContratos(c.filter((s) => (s.estado || "Pendiente") !== "Entregada"));
    }).finally(() => setCargando(false));
  }, []);

  const itemsURRJ: ItemRol[] = [
    ...firmas.filter((v) => v.area === "URRJ").map((v): ItemRol => ({
      key: v.token, rol: ROL_POR_SLOT[v.slot] || v.slot, tipo: "Jurídico",
      etiqueta: SLOT_LABEL[v.slot] || v.slot, cliente: v.cliente_o_garantia || "—", expediente: v.expediente || "—",
      fecha: v.created_at, onClick: () => navigate({ to: "/firmar", search: { token: v.token } as any }),
    })),
    ...registral.filter((d) => !d.firma_elabora).map((d): ItemRol => ({
      key: `reg-elab-${d.id}`, rol: "Elabora (URRJ)", tipo: "Registral",
      etiqueta: "Falta elaborar", cliente: d.acreditado || "—", expediente: d.expediente || "—",
      fecha: d.created_at, onClick: () => navigate({ to: "/urrj", search: { exp: d.expediente || undefined, registral: true } as any }),
    })),
    ...registral.filter((d) => d.firma_elabora && !d.firma_valida).map((d): ItemRol => ({
      key: `reg-val-${d.id}`, rol: "DIL", tipo: "Registral",
      etiqueta: "Falta validar (DIL)", cliente: d.acreditado || "—", expediente: d.expediente || "—",
      fecha: d.created_at, onClick: () => navigate({ to: "/urrj", search: { exp: d.expediente || undefined, registral: true } as any }),
    })),
  ];
  const porRol: Record<string, ItemRol[]> = {};
  for (const it of itemsURRJ) (porRol[it.rol] ||= []).push(it);

  const conteos: Record<Modulo, number> = {
    UCM: firmas.filter((f) => f.area === "UCM").length + instrucciones.length,
    UCP: firmas.filter((f) => f.area === "UCP").length,
    URRJ: itemsURRJ.length,
    Contratos: contratos.length,
    Escritos: 0, Liquidación: 0, UDP: 0, UFC: 0,
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {MODULOS.map((m) => (
          <button
            key={m}
            onClick={() => setModulo(m)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${modulo === m ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 text-[color:var(--teal)]" : "border-border text-muted-foreground hover:bg-muted/50"}`}
          >
            {m} {conteos[m] ? <span className="ml-1 opacity-70">({conteos[m]})</span> : null}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : SIN_VALIDACION.includes(modulo) ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <Lock className="mx-auto h-4 w-4" />
          <span>{modulo} aún sin validaciones configuradas.</span>
        </div>
      ) : modulo === "URRJ" ? (
        itemsURRJ.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Nada pendiente en URRJ.</p>
        ) : (
          <div className="space-y-4">
            {ORDEN_ROLES.filter((rol) => porRol[rol]?.length).map((rol) => (
              <div key={rol}>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{rol} · {porRol[rol].length} pendiente{porRol[rol].length === 1 ? "" : "s"}</p>
                <div className="space-y-2">
                  {porRol[rol].map((it) => (
                    <button key={it.key} onClick={it.onClick} className="flex w-full items-start justify-between gap-2 rounded-lg border border-border p-2.5 text-left hover:bg-muted/30">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${it.tipo === "Registral" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>{it.tipo}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">{it.etiqueta}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium">{it.cliente}</p>
                        <p className="text-[11px] text-muted-foreground">Exp. {it.expediente} · {hace(it.fecha)}</p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {modulo === "UCM" && instrucciones.map((i) => (
            <button key={`ins-${i.id}`} onClick={() => i.caso_id && navigate({ to: "/expedientes/$id", params: { id: i.caso_id } })} className="flex w-full items-start justify-between gap-2 rounded-lg border border-border p-2.5 text-left hover:bg-muted/30">
              <div className="min-w-0">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">Instrucciones (ficha UCM)</span>
                <p className="mt-1 truncate text-sm font-medium">{i.cliente_juicio?.nombre || "—"}</p>
                <p className="text-[11px] text-muted-foreground">{i.folio} · Exp. {i.caso_juridico?.expediente || "—"}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}

          {modulo === "Contratos" && contratos.map((s) => (
            <button key={s.id} onClick={() => navigate({ to: "/contratos" })} className="flex w-full items-start justify-between gap-2 rounded-lg border border-border p-2.5 text-left hover:bg-muted/30">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{s.estado || "Pendiente"}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.val_dil ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>{s.val_dil ? "DIL ✓" : "Falta DIL"}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.val_ucm ? "bg-emerald-100 text-emerald-800" : "bg-purple-100 text-purple-800"}`}>{s.val_ucm ? "UCM ✓" : "Falta UCM"}</span>
                </div>
                <p className="mt-1 truncate text-sm font-medium">{s.tipo_documento || "—"}</p>
                <p className="text-[11px] text-muted-foreground">{s.garantia_ref || "—"} · Área: {s.area || "—"} · {s.created_at ? hace(s.created_at) : ""}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}

          {(modulo === "UCP" || modulo === "UCM") && firmas.filter((f) => f.area === modulo).map((v) => (
            <button key={v.token} onClick={() => navigate({ to: "/firmar", search: { token: v.token } as any })} className="flex w-full items-start justify-between gap-2 rounded-lg border border-border p-2.5 text-left hover:bg-muted/30">
              <div className="min-w-0">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${COLOR_SLOT[v.slot] || "bg-slate-100 text-slate-700"}`}>{SLOT_LABEL[v.slot] || v.slot}</span>
                <p className="mt-1 truncate text-sm font-medium">{v.cliente_o_garantia || "—"}</p>
                <p className="text-[11px] text-muted-foreground">Exp. {v.expediente || "—"} · {hace(v.created_at)}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}

          {conteos[modulo] === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Nada pendiente en {modulo}.</p>}
        </div>
      )}
    </div>
  );
}
