import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ClipboardList, Loader2, ExternalLink, Mail } from "lucide-react";
import { listarCadenaFirmasPendientes, SLOT_LABEL, type PendienteCadena } from "@/lib/cadena-firmas-dashboard";

function hace(fechaISO: string): string {
  const dias = Math.floor((Date.now() - new Date(fechaISO).getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "hace 1 día";
  return `hace ${dias} días`;
}

const COLOR_SLOT: Record<string, string> = {
  elabora: "bg-slate-100 text-slate-700",
  dil: "bg-blue-100 text-blue-800",
  ucm: "bg-purple-100 text-purple-800",
  dge: "bg-amber-100 text-amber-800",
  precio: "bg-emerald-100 text-emerald-800",
};

const AREAS = ["Todas", "URRJ", "UCP", "UCM"] as const;

export function DireccionMisValidaciones() {
  const [lista, setLista] = useState<PendienteCadena[]>([]);
  const [cargando, setCargando] = useState(true);
  const [areaSel, setAreaSel] = useState<(typeof AREAS)[number]>("Todas");

  useEffect(() => { listarCadenaFirmasPendientes().then(setLista).finally(() => setCargando(false)); }, []);

  const listaFiltrada = areaSel === "Todas" ? lista : lista.filter((v) => v.area === areaSel);
  const conteos: Record<string, number> = { Todas: lista.length };
  for (const a of ["URRJ", "UCP", "UCM"]) conteos[a] = lista.filter((v) => v.area === a).length;

  return (
    <Card className="legal-card p-5">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-[color:var(--teal)]" />
        <h3 className="font-display text-base font-semibold">Mis validaciones</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Todo lo que está esperando firma o validación ahora mismo — Elabora, DIL, UCM, DGE y cálculo de precio (Contabilidad) — separado por área para saber de dónde viene cada una.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {AREAS.map((a) => (
          <button
            key={a}
            onClick={() => setAreaSel(a)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${areaSel === a ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 text-[color:var(--teal)]" : "border-border text-muted-foreground hover:bg-muted/50"}`}
          >
            {a} {conteos[a] ? <span className="ml-1 opacity-70">({conteos[a]})</span> : null}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : listaFiltrada.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No hay nada pendiente de validar aquí ahorita.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Esperando</th>
                <th className="px-3 py-2">Expediente</th>
                <th className="px-3 py-2">Cliente / garantía</th>
                <th className="px-3 py-2">Área</th>
                <th className="px-3 py-2">Enviado a</th>
                <th className="px-3 py-2">Desde</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((v) => (
                <tr key={v.token} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${COLOR_SLOT[v.slot] || "bg-muted text-foreground"}`}>
                      {SLOT_LABEL[v.slot] || v.slot}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">{v.expediente || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{v.cliente_o_garantia || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{v.area}</td>
                  <td className="px-3 py-2 text-muted-foreground"><span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {v.correo_esperado}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{hace(v.created_at)}</td>
                  <td className="px-3 py-2">
                    <a href={`/firmar?token=${v.token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs hover:bg-muted/70">
                      Ver <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
