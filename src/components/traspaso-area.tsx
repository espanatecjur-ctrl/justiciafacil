import { useState } from "react";
import { ArrowRightCircle, Loader2, CheckCircle2, Circle, FolderPlus, AlertTriangle, Send } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { CarpetaDriveVinculada } from "@/components/carpeta-drive-vinculada";
import { registrarEvento } from "@/lib/cronologia-caso";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

// Flujo de áreas y los documentos que se piden al pasar de una a la siguiente.
// (Manual por ahora: avisa lo que falta pero deja pasar.)
interface Paso { destino: string; titulo: string; docs: string[] }
const TRASPASO: Record<string, Paso> = {
  URRJ: { destino: "SVT", titulo: "Mandar a SVT (visita y valoración)", docs: ["Datos de la garantía completos", "Pre-dictamen URRJ positivo"] },
  SVT:  { destino: "UCP", titulo: "Mandar a UCP (dictaminación)", docs: ["Documentos necesarios para dictaminar", "Apartado / contrato"] },
  UCP:  { destino: "UFC", titulo: "Mandar a UFC (firma · formalización)", docs: ["Contrato de cesión", "Formalización / escritura", "Dictamen final firmado"] },
  UFC:  { destino: "UCM", titulo: "Mandar a UCM (formalizaciones)", docs: ["Testimonio adecuado", "Abogado asignado"] },
  // UCM es la última: no hay traspaso.
};

function normArea(u?: string | null): string {
  const s = (u || "").toUpperCase();
  if (s.includes("UDP")) return "UDP";
  if (s.includes("UFC")) return "UFC";
  if (s.includes("UCM")) return "UCM";
  if (s.includes("URRJ")) return "URRJ";
  if (s.includes("SVT")) return "SVT";
  if (s.includes("UCP")) return "UCP";
  return s.trim();
}

/**
 * Motor de traspaso entre áreas (URRJ → SVT → UCP → UFC → UCM).
 * Reutilizable en la ficha de cualquier módulo.
 * - Pide (recuerda) los documentos necesarios para pasar.
 * - Si no hay carpeta de Drive, deja escoger/crear una.
 * - Al confirmar, mueve el expediente a la siguiente área y lo registra en la cronología.
 * Por ahora MANUAL: avisa lo que falta pero permite pasar.
 */
export function TraspasoArea({ caso, area, onGuardarCarpeta, onTraspaso }: {
  caso: CasoJuridico;
  area: string;
  onGuardarCarpeta: (campos: Record<string, string>) => void | Promise<void>;
  onTraspaso: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paso = TRASPASO[normArea(area)];
  if (!paso) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        <CheckCircle2 className="mr-1 inline h-4 w-4" /> Este expediente ya está en la última área del flujo.
      </div>
    );
  }

  const sinCarpeta = !caso.drive_carpeta_id;
  const faltan = paso.docs.filter((d) => !checks[d]);

  const confirmar = async () => {
    if (faltan.length > 0 && !confirm(`Todavía faltan ${faltan.length} documento(s) por marcar.\n\n¿Mandar de todos modos a ${paso.destino}? (traspaso manual)`)) return;
    setEnviando(true); setError(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${caso.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ unidad: paso.destino }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const detalle = paso.docs.map((d) => (checks[d] ? "✓" : "—") + " " + d).join(" · ");
      await registrarEvento({ caso_id: caso.id, expediente: caso.expediente, area: paso.destino, tipo: "nota", texto: `Traspaso ${normArea(area)} → ${paso.destino}. ${detalle}` });
      onTraspaso();
    } catch {
      setError("No se pudo hacer el traspaso. Revisa la columna 'unidad' del caso.");
    } finally { setEnviando(false); }
  };

  return (
    <div className="rounded-xl border-2 border-[color:var(--teal)]/40 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-[color:var(--teal)]"><Send className="h-4 w-4" /> {paso.titulo}</p>
        {!abierto && (
          <button onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white" style={{ background: "#0C5C46" }}>
            <ArrowRightCircle className="h-4 w-4" /> Preparar traspaso
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-3 space-y-3">
          {/* checklist de documentos */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Documentos necesarios para pasar a {paso.destino}:</p>
            <div className="space-y-1">
              {paso.docs.map((d) => (
                <button key={d} onClick={() => setChecks((p) => ({ ...p, [d]: !p[d] }))} className="flex w-full items-center gap-2 rounded-md border border-input px-2.5 py-1.5 text-left text-sm hover:bg-muted">
                  {checks[d] ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span className={checks[d] ? "" : "text-muted-foreground"}>{d}</span>
                </button>
              ))}
            </div>
          </div>

          {/* carpeta de Drive */}
          {sinCarpeta ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-800"><FolderPlus className="h-3.5 w-3.5" /> Este expediente no tiene carpeta de Drive. Escoge una o crea una para subir los documentos:</p>
              <CarpetaDriveVinculada caso={caso} area={area} onGuardar={onGuardarCarpeta} />
            </div>
          ) : (
            <p className="rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-600" /> Carpeta de Drive vinculada. Sube los documentos en la pestaña <b>Documentos</b> antes de pasar.</p>
          )}

          {faltan.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Faltan {faltan.length} de {paso.docs.length} documentos por marcar. Puedes pasar igual (manual), pero conviene completarlos.</p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button onClick={confirmar} disabled={enviando} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightCircle className="h-4 w-4" />} Confirmar traspaso a {paso.destino}
            </button>
            <button onClick={() => setAbierto(false)} className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
