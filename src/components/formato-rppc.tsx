import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { type DictamenRow } from "@/components/ficha-ucp";
import { FileSpreadsheet, Save, Loader2, ChevronDown, ChevronRight } from "lucide-react";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

type Tipo = "text" | "date" | "num" | "area" | "sino";
interface Campo { k: string; label: string; tipo?: Tipo; }

// ---- campos tal cual el formato Excel de RPPC ----
const CABECERA: Campo[] = [
  { k: "fecha_verificacion", label: "Fecha de verificación", tipo: "date" },
  { k: "numero_credito", label: "Número de crédito" },
  { k: "acreditado", label: "Acreditado" },
  { k: "abogado_seguimiento", label: "Abogado de seguimiento" },
  { k: "distrito_registral", label: "Distrito registral" },
];
const PROPIEDAD: Campo[] = [
  { k: "p_direccion", label: "Dirección" },
  { k: "p_acto", label: "Acto" },
  { k: "p_fecha_inscripcion", label: "Fecha de inscripción", tipo: "date" },
  { k: "p_no_escritura", label: "No. de escritura" },
  { k: "p_fecha_escritura", label: "Fecha de escritura", tipo: "date" },
  { k: "p_titular", label: "Titular registral" },
  { k: "p_enajenante", label: "Enajenante" },
  { k: "p_notario", label: "Notario" },
  { k: "p_monto", label: "Monto operación", tipo: "num" },
  { k: "p_superficie", label: "Superficie" },
  { k: "p_libera_gravamen", label: "¿Existe liberación de gravamen?", tipo: "sino" },
];
const GRAVAMEN = (pre: string): Campo[] => [
  { k: `${pre}_direccion`, label: "Dirección" },
  { k: `${pre}_acto`, label: "Acto" },
  { k: `${pre}_fecha_inscripcion`, label: "Fecha de inscripción", tipo: "date" },
  { k: `${pre}_no_escritura`, label: "No. de escritura" },
  { k: `${pre}_fecha_escritura`, label: "Fecha de escritura", tipo: "date" },
  { k: `${pre}_acreedor`, label: "Acreedor" },
  { k: `${pre}_deudor`, label: "Deudor" },
  { k: `${pre}_notario`, label: "Notario" },
  { k: `${pre}_monto`, label: "Monto operación", tipo: "num" },
  { k: `${pre}_equivalente`, label: "Equivalente" },
];
const RESULTADOS = ["POSITIVO", "CONDICIONADO", "NEGATIVO"];

type Datos = Record<string, string>;

interface Props {
  caso: CasoJuridico;
  dictamen: DictamenRow;
  onGuardado: () => void;
}

export function FormatoRPPC({ caso, dictamen, onGuardado }: Props) {
  const guardado = ((dictamen as any).rppc as Datos) || {};
  const [d, setD] = useState<Datos>(() => ({
    numero_credito: guardado.numero_credito ?? caso.expediente ?? "",
    acreditado: guardado.acreditado ?? caso.cliente_nombre ?? "",
    p_direccion: guardado.p_direccion ?? caso.direccion_garantia ?? "",
    distrito_registral: guardado.distrito_registral ?? caso.distrito_judicial ?? "",
    ...guardado,
  }));
  const set = (k: string, v: string) => setD((p) => ({ ...p, [k]: v }));

  const [gaAbierto, setGaAbierto] = useState<boolean>(!!guardado.ga_aplica);
  const [resultado, setResultado] = useState<string>(guardado.resultado || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const guardar = async () => {
    setGuardando(true); setError(null); setOk(false);
    try {
      const payload = { ...d, ga_aplica: gaAbierto ? "si" : "", resultado, actualizado: new Date().toISOString() };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${dictamen.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ rppc: payload, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status} — ¿corriste el SQL de la columna rppc?`);
      setOk(true);
      onGuardado();
    } catch (e: any) { setError("No se pudo guardar el formato: " + e.message); }
    finally { setGuardando(false); }
  };

  return (
    <Card className="legal-card">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-[color:var(--teal)]" />
          <p className="text-sm font-semibold">Formato RPPC · verificación registral</p>
          {resultado && <Badge variant="outline" className="ml-auto">{resultado}</Badge>}
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        <Seccion titulo="Cabecera">{CABECERA.map((c) => <Field key={c.k} c={c} d={d} set={set} />)}</Seccion>
        <Seccion titulo="Propiedad (verificación registral)">{PROPIEDAD.map((c) => <Field key={c.k} c={c} d={d} set={set} />)}</Seccion>
        <Seccion titulo="Gravamen">{GRAVAMEN("g").map((c) => <Field key={c.k} c={c} d={d} set={set} />)}</Seccion>

        {/* gravamen adicional (solo si aplica) */}
        <div className="rounded-lg border border-border">
          <button onClick={() => setGaAbierto((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium">
            {gaAbierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Gravamen adicional <span className="text-xs font-normal text-muted-foreground">(solo si aplica)</span>
          </button>
          {gaAbierto && (
            <div className="grid grid-cols-1 gap-2 border-t border-border p-3 sm:grid-cols-2">
              {GRAVAMEN("ga").map((c) => <Field key={c.k} c={c} d={d} set={set} />)}
            </div>
          )}
        </div>

        {/* cierre */}
        <div className="space-y-2">
          <Campo label="Anotaciones adicionales">
            <Textarea className="min-h-[44px]" value={d.anotaciones || ""} onChange={(e) => set("anotaciones", e.target.value)} />
          </Campo>
          <Campo label="Conclusión">
            <Textarea className="min-h-[44px]" value={d.conclusion || ""} onChange={(e) => set("conclusion", e.target.value)} />
          </Campo>
          <Campo label="Resultado de compra">
            <div className="flex flex-wrap gap-1">
              {RESULTADOS.map((r) => (
                <button key={r} onClick={() => setResultado(r)}
                  className={`rounded-md border px-3 py-1.5 text-xs ${resultado === r
                    ? r === "POSITIVO" ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : r === "NEGATIVO" ? "border-red-300 bg-red-50 text-red-800"
                      : "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-input text-muted-foreground"}`}>
                  {r}
                </button>
              ))}
            </div>
          </Campo>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={guardar} disabled={guardando}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar formato RPPC
          </Button>
          {ok && <span className="text-xs text-emerald-700">Guardado ✓</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- piezas ----
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Field({ c, d, set }: { c: Campo; d: Datos; set: (k: string, v: string) => void }) {
  if (c.tipo === "sino") {
    return (
      <Campo label={c.label}>
        <div className="flex gap-1">
          {["si", "no"].map((o) => (
            <button key={o} onClick={() => set(c.k, o)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-sm ${d[c.k] === o ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-input text-muted-foreground"}`}>
              {o === "si" ? "Sí" : "No"}
            </button>
          ))}
        </div>
      </Campo>
    );
  }
  if (c.tipo === "area") {
    return <Campo label={c.label}><Textarea className="min-h-[40px]" value={d[c.k] || ""} onChange={(e) => set(c.k, e.target.value)} /></Campo>;
  }
  return (
    <Campo label={c.label}>
      <Input
        type={c.tipo === "date" ? "date" : "text"}
        inputMode={c.tipo === "num" ? "decimal" : undefined}
        value={d[c.k] || ""}
        onChange={(e) => set(c.k, e.target.value)}
      />
    </Campo>
  );
}
