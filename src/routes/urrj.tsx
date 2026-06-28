import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { type Precarga } from "@/lib/predictamen-guardar";
import { cargarPermisosURRJ } from "@/lib/urrj-permisos";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Scale } from "lucide-react";
import { getAuth } from "@/lib/auth";
import { RecorridoActor } from "@/components/recorrido-actor";
import { RecorridoDemandado } from "@/components/recorrido-demandado";
import { RecorridoSucesorio } from "@/components/recorrido-sucesorio";
import { RecorridoContingencia } from "@/components/recorrido-contingencia";
import { RecorridoTramites } from "@/components/recorrido-tramites";
import { HistorialPredictamen } from "@/components/historial-predictamen";

export const Route = createFileRoute("/urrj")({
  head: () => ({ meta: [{ title: "URRJ — Pre-dictamen — JusticiaFácil" }] }),
  validateSearch: (s: Record<string, unknown>): { soloRegistro?: boolean } => ({
    soloRegistro: s.soloRegistro === true || s.soloRegistro === "true",
  }),
  component: URRJ,
});

const NAVY = "#0B1E3A";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

function URRJ() {
  const [casos, setCasos] = useState<any[]>([]);
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [vista, setVista] = useState<"elegir" | "Actor" | "Demandado" | "Sucesorio" | "Contingencia" | "Tramites">("elegir");
  const { soloRegistro } = Route.useSearch();
  const [precargar, setPrecargar] = useState<Precarga | null>(null);
  const [permisos, setPermisos] = useState<string[]>([]);
  useEffect(() => { cargarPermisosURRJ().then((p) => setPermisos(p.acciones)); }, []);
  const puede = (a: string) => permisos.length === 0 || permisos.includes(a);
  const volver = () => { setPrecargar(null); setVista("elegir"); };
  const reDictaminar = (fila: any) => {
    const map: Record<string, any> = { Actor: "Actor", Demandado: "Demandado", Sucesorio: "Sucesorio", Contingencia: "Contingencia", "Trámite administrativo": "Tramites" };
    const v = map[fila.posicion];
    if (!v) { alert("No se pudo identificar la posición de este pre-dictamen."); return; }
    const nota = prompt("Nota de cambios (opcional): ¿qué cambió o qué vas a agregar en esta nueva versión?") || "";
    setPrecargar({ datos: fila.datos || {}, antecedenteId: fila.id, version: fila.version || 1, cambios: nota });
    setVista(v);
  };
  const puedeAdmin = ["GAD", "Super_Admin", "DGE"].includes(rolUsuario || "");

  useEffect(() => {
    (async () => {
      try {
        const auth = await getAuth();
        const { data } = await auth.auth.getSession();
        const correo = data.session?.user?.email;
        if (!correo) return;
        const r = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers });
        const j = r.ok ? await r.json() : [];
        setRolUsuario(j?.[0]?.rol ?? null);
      } catch { /* si falla, queda sin permiso de admin */ }
    })();
  }, []);

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=id,expediente,juzgado,entidad,cliente_nombre,direccion_garantia&order=expediente.asc&limit=300`, { headers })
      .then((r) => (r.ok ? r.json() : [])).then(setCasos).catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, #0C5C46)` }}>
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6" style={{ color: "#C2A24C" }} />
          <div>
            <h1 className="text-xl font-bold">{soloRegistro ? "URRJ · Registro" : "JUFA · Pre-dictaminador"}</h1>
            <p className="text-sm text-white/70">{soloRegistro ? "Unidad de Resolución Jurídica · registro de pre-dictámenes" : "Pre-dictaminador de URRJ · el sistema calcula y avisa, las personas firman y deciden"}</p>
          </div>
        </div>
      </div>

      {!soloRegistro && vista === "elegir" && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-base font-semibold">¿Cuál es la posición de DIIPA en este caso?</p>
          <p className="mb-4 text-sm text-muted-foreground">Cada posición tiene su propio recorrido de pre-dictamen.</p>
          {!puede("elaborar") && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">🔒 Tu rol no puede elaborar pre-dictámenes nuevos. Puedes consultar el historial de abajo.</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button onClick={() => { if (!puede("elaborar")) { alert("Tu rol no puede elaborar pre-dictámenes nuevos. Solo puedes ver el historial."); return; } setVista("Actor"); }} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
              <Scale className="mb-2 h-6 w-6" style={{ color: "#0C5C46" }} />
              <p className="font-semibold">Actor</p>
              <p className="text-xs text-muted-foreground">DIIPA demanda / recupera (cesión hipotecaria). 8 fases.</p>
            </button>
            <button onClick={() => { if (!puede("elaborar")) { alert("Tu rol no puede elaborar pre-dictámenes nuevos. Solo puedes ver el historial."); return; } setVista("Demandado"); }} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
              <Scale className="mb-2 h-6 w-6" style={{ color: "#0B1E3A" }} />
              <p className="font-semibold">Demandado</p>
              <p className="text-xs text-muted-foreground">DIIPA compra los derechos del demandado-vendedor. 6 fases.</p>
            </button>
            <button onClick={() => { if (!puede("elaborar")) { alert("Tu rol no puede elaborar pre-dictámenes nuevos. Solo puedes ver el historial."); return; } setVista("Sucesorio"); }} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
              <Scale className="mb-2 h-6 w-6" style={{ color: "#C2A24C" }} />
              <p className="font-semibold">Sucesorio</p>
              <p className="text-xs text-muted-foreground">Vía herencia / posesión. Veredicto cruzado. 6 fases.</p>
            </button>
          </div>
          <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Otros saneamientos</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={() => { if (!puede("elaborar")) { alert("Tu rol no puede elaborar pre-dictámenes nuevos. Solo puedes ver el historial."); return; } setVista("Contingencia"); }} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
              <Scale className="mb-2 h-6 w-6" style={{ color: "#0C5C46" }} />
              <p className="font-semibold">Contingencia inmobiliaria</p>
              <p className="text-xs text-muted-foreground">Defectos registrales, posesión, copropiedad, doble inscripción, traslapes. 6 fases.</p>
            </button>
            <button onClick={() => { if (!puede("elaborar")) { alert("Tu rol no puede elaborar pre-dictámenes nuevos. Solo puedes ver el historial."); return; } setVista("Tramites"); }} className="rounded-xl border border-border p-4 text-left hover:border-[color:var(--teal)] hover:bg-[color:var(--teal)]/5">
              <Scale className="mb-2 h-6 w-6" style={{ color: "#0B1E3A" }} />
              <p className="font-semibold">Trámites administrativos</p>
              <p className="text-xs text-muted-foreground">Amparo, contencioso TFJA, laboral, créditos fiscales. Cuenta el plazo. 6 fases.</p>
            </button>
          </div>
        </div>
      )}

      {soloRegistro && vista === "elegir" && <HistorialPredictamen onReDictaminar={reDictaminar} />}

      {vista === "Actor" && <RecorridoActor casos={casos} onVolver={volver} precargar={precargar} puedeFirmarElabora={puede("firmar_elabora")} puedeValidar={puede("validar")} puedeAdmin={puedeAdmin} />}
      {vista === "Demandado" && <RecorridoDemandado casos={casos} onVolver={volver} precargar={precargar} puedeFirmarElabora={puede("firmar_elabora")} puedeValidar={puede("validar")} />}
      {vista === "Sucesorio" && <RecorridoSucesorio casos={casos} onVolver={volver} precargar={precargar} puedeFirmarElabora={puede("firmar_elabora")} puedeValidar={puede("validar")} />}
      {vista === "Contingencia" && <RecorridoContingencia casos={casos} onVolver={volver} precargar={precargar} puedeFirmarElabora={puede("firmar_elabora")} puedeValidar={puede("validar")} />}
      {vista === "Tramites" && <RecorridoTramites casos={casos} onVolver={volver} precargar={precargar} puedeFirmarElabora={puede("firmar_elabora")} puedeValidar={puede("validar")} />}
    </div>
  );
}
