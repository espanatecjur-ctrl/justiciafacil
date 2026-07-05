// ============================================================
//  FichaURRJ · ficha 360 de una garantía en URRJ
//  4 pestañas: Datos · Jurídico · Registral · Avances
// ============================================================
import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { LineaVidaAreas } from "@/components/linea-vida-areas";
import { ArrowLeft, Scale, Landmark, FileText, Activity, Loader2 } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const enc = (s: string) => encodeURIComponent(s);
const fdate = (s?: string) => s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "";

export interface RefGarantia {
  id?: string;
  expediente?: string;
  direccion_garantia?: string;
  juzgado?: string;
  cliente_nombre?: string;
  deudor?: string;
  entidad?: string;
}

type Tab = "datos" | "juridico" | "registral" | "avances";

function color(res: string) {
  return /positivo|pasa/i.test(res) ? "bg-emerald-100 text-emerald-800"
    : /negativo|no pasa/i.test(res) ? "bg-red-100 text-red-800"
    : "bg-muted text-muted-foreground";
}

export function FichaURRJ({ garantia, onVolver }: { garantia: RefGarantia; onVolver: () => void }) {
  const [tab, setTab] = useState<Tab>("datos");
  const [juridicos, setJuridicos] = useState<any[]>([]);
  const [registrales, setRegistrales] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    const filtroJur = garantia.id
      ? `caso_id=eq.${garantia.id}`
      : garantia.expediente ? `expediente=eq.${enc(garantia.expediente)}` : "id=eq.0";
    const filtroReg = garantia.expediente ? `expediente=eq.${enc(garantia.expediente)}` : "id=eq.0";
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id,version,posicion,dictamen_sugerido,dictamen_final,firma_elabora,firma_valida,created_at&${filtroJur}&order=created_at.desc&limit=50`, { headers }).then((r) => r.ok ? r.json() : []),
      fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral?select=*&${filtroReg}&order=created_at.desc&limit=50`, { headers }).then((r) => r.ok ? r.json() : []),
    ]).then(([j, r]) => { setJuridicos(j); setRegistrales(r); }).finally(() => setCargando(false));
  }, [garantia.id, garantia.expediente]);

  const casoLV: CasoJuridico = {
    id: garantia.id || "",
    expediente: garantia.expediente || "",
    direccion_garantia: garantia.direccion_garantia,
    juzgado: garantia.juzgado,
    cliente_nombre: garantia.cliente_nombre,
  } as CasoJuridico;

  const TABS: { k: Tab; label: string; icon: any }[] = [
    { k: "datos", label: "Datos", icon: FileText },
    { k: "juridico", label: "Jurídico", icon: Scale },
    { k: "registral", label: "Registral", icon: Landmark },
    { k: "avances", label: "Avances", icon: Activity },
  ];

  const Dato = ({ label, valor }: { label: string; valor?: string }) => (
    <div><p className="text-[11px] font-medium text-muted-foreground">{label}</p><p className="text-sm">{valor || "—"}</p></div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onVolver} className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Volver al registro</button>
        <h2 className="font-display text-lg font-bold">Ficha · {garantia.expediente || garantia.direccion_garantia || "Garantía"}</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${tab === t.k ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 text-[color:var(--teal)]" : "border-border text-muted-foreground hover:bg-muted"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : (
        <div className="rounded-xl border border-border p-5">
          {tab === "datos" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Dato label="Expediente" valor={garantia.expediente} />
              <Dato label="Juzgado" valor={garantia.juzgado} />
              <Dato label="Garantía / dirección" valor={garantia.direccion_garantia} />
              <Dato label="Entidad" valor={garantia.entidad} />
              <Dato label="Cliente" valor={garantia.cliente_nombre} />
              <Dato label="Deudor" valor={garantia.deudor} />
              <Dato label="Dictámenes jurídicos" valor={String(juridicos.length)} />
              <Dato label="Dictámenes registrales" valor={String(registrales.length)} />
            </div>
          )}

          {tab === "juridico" && (
            juridicos.length === 0 ? <p className="text-sm text-muted-foreground">Esta garantía no tiene dictámenes jurídicos.</p> : (
              <div className="divide-y divide-border">
                {juridicos.map((j) => (
                  <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="text-sm font-semibold">{j.posicion || "—"} · v{j.version || 1} <span className="text-xs font-normal text-muted-foreground">{fdate(j.created_at)}</span></p>
                      <p className="text-xs text-muted-foreground">
                        Decisión: {j.dictamen_final || "—"}
                        {(j.firma_elabora || j.firma_valida) ? ` · Firmas: ${[j.firma_elabora, j.firma_valida].filter(Boolean).join(" / ")}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${color(j.dictamen_sugerido || "")}`}>{j.dictamen_sugerido || "—"}</span>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "registral" && (
            registrales.length === 0 ? <p className="text-sm text-muted-foreground">Esta garantía no tiene dictámenes registrales.</p> : (
              <div className="divide-y divide-border">
                {registrales.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="text-sm font-semibold">{r.acreditado || "—"} <span className="text-xs font-normal text-muted-foreground">{fdate(r.created_at)}</span></p>
                      <p className="text-xs text-muted-foreground">
                        {r.hay_adicional ? "Con gravamen adicional · " : ""}
                        {(r.firma_elabora?.nombre || r.firma_valida?.nombre) ? `Firmas: ${[r.firma_elabora?.nombre, r.firma_valida?.nombre].filter(Boolean).join(" / ")}` : "Sin firmas"}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${color(r.resultado || "")}`}>{r.resultado || "—"}</span>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "avances" && <LineaVidaAreas caso={casoLV} />}
        </div>
      )}
    </div>
  );
}
