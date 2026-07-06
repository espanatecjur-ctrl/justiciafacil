// JusticiaFácil · Vista "Boletín" del expediente principal
// Muestra TODAS las actuaciones del robot de este expediente en su propia
// pantalla, y deja consultar el boletín en vivo (mismo robotsito).
import { useState } from "react";
import { BuscadorBoletin } from "@/components/buscador-boletin";
import { Megaphone, Search, Loader2, AlertTriangle } from "lucide-react";

const TEAL = "#0C5C46";

interface Acuerdo {
  id: string;
  expediente: string | null;
  fecha_acuerdo: string | null;
  texto: string | null;
  tipo_acuerdo: string | null;
  urgente: boolean | null;
}

// Fecha "YYYY-MM-DD" como local (sin brincar de día)
function fmtFecha(s: string | null): string {
  if (!s) return "—";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

const TIPO_COLOR: Record<string, string> = {
  Boletín: "bg-blue-100 text-blue-700", Amparo: "bg-purple-100 text-purple-700", Exhorto: "bg-cyan-100 text-cyan-700",
  Edicto: "bg-orange-100 text-orange-700", Almoneda: "bg-rose-100 text-rose-700", RPP: "bg-teal-100 text-teal-700",
};

export function BoletinExpediente({ acuerdos, expediente, sinJuzgado, cargando }: {
  acuerdos: Acuerdo[];
  expediente: string | null;
  sinJuzgado: boolean;
  cargando?: boolean;
}) {
  const [verBuscar, setVerBuscar] = useState(false);
  const ultima = acuerdos[0] || null;

  return (
    <div className="space-y-4">
      {/* Resumen + buscar en vivo */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: TEAL }}>
            <Megaphone className="h-4 w-4" /> Actuaciones del boletín
          </p>
          <button onClick={() => setVerBuscar((v) => !v)} className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--teal)] px-3 py-1.5 text-xs font-semibold" style={{ color: TEAL }}>
            <Search className="h-3.5 w-3.5" /> {verBuscar ? "Ocultar búsqueda" : "Buscar en el boletín ahora"}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {cargando ? "Cargando…" : acuerdos.length > 0
            ? <>{acuerdos.length} actuación{acuerdos.length === 1 ? "" : "es"} · última: {fmtFecha(ultima?.fecha_acuerdo ?? null)}</>
            : "Sin actuaciones registradas todavía."}
        </p>

        {verBuscar && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-[11px] text-muted-foreground">Consulta en vivo (no espera a la corrida de las 9 AM). Elige jurisdicción + juzgado y busca el expediente.</p>
            <BuscadorBoletin expedienteInicial={expediente || ""} />
          </div>
        )}
      </div>

      {/* Lista de actuaciones */}
      {cargando ? (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando actuaciones…</p>
      ) : sinJuzgado ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mr-1 inline h-4 w-4" /> Falta asignar el juzgado para que el robot pueda seguir este expediente en el boletín. Asígnalo en la pestaña <b>General → Estatus actual</b>.
        </div>
      ) : acuerdos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Aún no hay actuaciones. El robot revisa el boletín <b>todos los días a las 9:00 AM</b> y las irá llenando solo.
        </div>
      ) : (
        <div className="space-y-2">
          {acuerdos.map((a) => (
            <div key={a.id} className={`rounded-lg border p-3 ${a.urgente ? "border-red-300 bg-red-50" : "border-border bg-card"}`}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {a.tipo_acuerdo && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIPO_COLOR[a.tipo_acuerdo] || "bg-muted text-muted-foreground"}`}>{a.tipo_acuerdo}</span>}
                  {a.urgente && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">URGENTE</span>}
                </div>
                <span className="text-xs text-muted-foreground">{fmtFecha(a.fecha_acuerdo)}</span>
              </div>
              <p className="text-sm">{a.texto || "(sin texto)"}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
