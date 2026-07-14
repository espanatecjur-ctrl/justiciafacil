import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { type Precarga, buscarPredictamenVigenteCompleto } from "@/lib/predictamen-guardar";
import { cargarPermisosURRJ } from "@/lib/urrj-permisos";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Scale, ScrollText, Plus, Upload } from "lucide-react";
import { getAuth } from "@/lib/auth";
import { DictaminadorPosicion, type VistaPosicion } from "@/components/dictaminador-posicion";
import { SolicitudesURRJ } from "@/components/solicitudes-urrj";
import { DictamenRegistral } from "@/components/dictamen-registral";
import { type SolicitudPredictamen } from "@/lib/solicitud-predictamen";
import { HistorialPredictamen } from "@/components/historial-predictamen";
import { RegistroURRJ } from "@/components/registro-urrj";
import { FichaURRJ, type RefGarantia } from "@/components/ficha-urrj";
import { ImportarCarteraURRJ } from "@/components/importar-cartera-urrj";

export const Route = createFileRoute("/urrj")({
  head: () => ({ meta: [{ title: "URRJ — Pre-dictamen — JusticiaFácil" }] }),
  validateSearch: (s: Record<string, unknown>): { soloRegistro?: boolean; registral?: boolean; exp?: string; cliente?: string; caso?: string } => ({
    soloRegistro: s.soloRegistro === true || s.soloRegistro === "true",
    registral: s.registral === true || s.registral === "true",
    exp: typeof s.exp === "string" ? s.exp : undefined,
    cliente: typeof s.cliente === "string" ? s.cliente : undefined,
    caso: typeof s.caso === "string" ? s.caso : undefined,
  }),
  component: URRJ,
});

const NAVY = "#0B1E3A";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

function URRJ() {
  const [casos, setCasos] = useState<any[]>([]);
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [vista, setVista] = useState<VistaPosicion>("elegir");
  const { soloRegistro, registral, exp, cliente, caso } = Route.useSearch();
  const [precargar, setPrecargar] = useState<Precarga | null>(null);
  const [solicitudActiva, setSolicitudActiva] = useState<SolicitudPredictamen | null>(null);
  const [crearNuevo, setCrearNuevo] = useState(false);
  const [permisos, setPermisos] = useState<string[]>([]);
  const [fichaGar, setFichaGar] = useState<RefGarantia | null>(null);
  const [subVista, setSubVista] = useState<"solicitudes" | "historial">("solicitudes");
  const [importarAbierto, setImportarAbierto] = useState(false);
  useEffect(() => { cargarPermisosURRJ().then((p) => setPermisos(p.acciones)); }, []);
  const puede = (a: string) => permisos.length === 0 || permisos.includes(a);
  const volver = () => { setPrecargar(null); setSolicitudActiva(null); setCrearNuevo(false); setVista("elegir"); };

  const dictaminarSolicitud = async (sol: SolicitudPredictamen) => {
    setSolicitudActiva(sol);
    // Antes de arrancar: ¿esta garantía YA tiene un pre-dictamen vigente en el
    // historial? Si sí, se enlaza como antecedente — así al guardar el nuevo
    // se marca el viejo como versión anterior, en vez de dejar dos filas
    // "vigente" del mismo expediente (que se verían como repetidas).
    const previo = await buscarPredictamenVigenteCompleto(sol.expediente, sol.caso_id);
    if (previo) {
      setPrecargar({
        datos: {
          ...(previo.datos || {}),
          caso_id: sol.caso_id || previo.caso_id || "",
          expediente: sol.expediente || previo.expediente || "",
          juzgado: sol.juzgado || previo.datos?.juzgado || "",
          deudor: sol.cliente || previo.datos?.deudor || "",
        },
        antecedenteId: previo.id,
        version: previo.version || 1,
        cambios: "Re-dictaminado desde Solicitudes URRJ",
      });
    } else {
      setPrecargar({
        datos: {
          caso_id: sol.caso_id || "",
          expediente: sol.expediente || "",
          juzgado: sol.juzgado || "",
          deudor: sol.cliente || "",
        },
      });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const reDictaminar = (fila: any) => {
    const map: Record<string, VistaPosicion> = { Actor: "Actor", Demandado: "Demandado", Sucesorio: "Sucesorio", Contingencia: "Contingencia", "Trámite administrativo": "Tramites" };
    const v = map[fila.posicion];
    if (!v) { alert("No se pudo identificar la posición de este pre-dictamen."); return; }
    const nota = prompt("Nota de cambios (opcional): ¿qué cambió o qué vas a agregar en esta nueva versión?") || "";
    setPrecargar({ datos: fila.datos || {}, antecedenteId: fila.id, version: fila.version || 1, cambios: nota });
    setVista(v);
  };
  const puedeAdmin = ["GAD", "Super_Admin", "DGE"].includes(rolUsuario || "");
  const puedePrecioPiso = ["DGE", "Super_Admin"].includes(rolUsuario || "");
  const navigate = useNavigate();
  const verFichaVieja = (f: any) => {
    // La solicitud/pre-dictamen YA trae su información (expediente, cliente).
    // Aquí arranca el proceso (cuando llegan los documentos): NO se exige vincular
    // una garantía. Abrimos la ficha por expediente; el FichaURRJ se alimenta del
    // pre-dictamen y del registral por expediente o por caso_id.
    setFichaGar({
      id: f.caso_id || undefined,
      expediente: f.expediente || "",
      direccion_garantia: f.datos?.ubicacion || "",
      juzgado: f.datos?.juzgado || f.juzgado || "",
      cliente_nombre: f.datos?.deudor || f.cliente || "",
      deudor: f.datos?.deudor || "",
      entidad: f.datos?.estado || "",
    });
  };
  const reDictaminarRegistral = (f: any) => {
    setSolicitudActiva({ tipo_dictamen: "Registral", cliente: f.datos?.deudor || "", expediente: f.expediente || "", caso_id: f.caso_id || "" } as any);
    setPrecargar({ datos: { caso_id: f.caso_id || "", expediente: f.expediente || "" } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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

  // Si llegamos desde "Continuar con el registral" (del recorrido jurídico),
  // abrimos directo el dictamen registral con el expediente ya cargado.
  useEffect(() => {
    if (registral) {
      setSolicitudActiva({ tipo_dictamen: "Registral", expediente: exp || "", cliente: cliente || "", caso_id: caso || "" } as any);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registral]);

  const dictaminacion = (
    <div className="space-y-5">
      {vista === "elegir" && solicitudActiva?.tipo_dictamen === "Registral" ? (
        <DictamenRegistral
          precarga={{ acreditado: solicitudActiva.cliente || "", numeroCredito: solicitudActiva.expediente || "", direccion: "" }}
          casoId={solicitudActiva.caso_id || ""}
          onVolver={volver}
          puedeFirmarElabora={puede("firmar_elabora")}
          puedeValidar={puede("validar")}
          puedePrecioPiso={puedePrecioPiso}
        />
      ) : vista === "elegir" ? (
        <>
          {solicitudActiva && (
            <div className="rounded-xl border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-4">
              <p className="text-sm font-semibold text-[color:var(--teal)]">
                Dictaminando la solicitud · Exp. {solicitudActiva.expediente || "\u2014"}
                {solicitudActiva.tipo_dictamen ? ` · Dictamen ${solicitudActiva.tipo_dictamen}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Ya cargué el expediente. Revisa primero los documentos y luego elige la <b>posición</b> (Actor, Demandado, etc.) para abrir el recorrido.</p>
              <button onClick={volver} className="mt-2 text-xs font-medium text-muted-foreground underline">Cancelar y elegir otra solicitud</button>
            </div>
          )}
          {solicitudActiva && (solicitudActiva.documentos?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-border bg-white p-4">
              <p className="text-sm font-semibold">📎 Documentos de esta solicitud ({solicitudActiva.documentos!.length})</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Revísalos antes de elegir la posición — de ahí sale el criterio para el pre-dictamen.</p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {solicitudActiva.documentos!.map((d, i) => (
                  <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 truncate rounded-md border border-border bg-muted/20 px-2 py-1.5 text-xs text-[color:var(--teal)] hover:bg-muted">
                    <span className="truncate">📄 {d.nombre}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {solicitudActiva && (solicitudActiva.documentos?.length ?? 0) === 0 && (
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              Esta solicitud llegó sin documentos adjuntos. Verifica con la Dirección antes de dictaminar.
            </div>
          )}
          {!solicitudActiva && !crearNuevo && (
            <>
              <div className="flex flex-wrap justify-end gap-2">
                <button onClick={() => setCrearNuevo(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--teal)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                  <Plus className="h-3.5 w-3.5" /> Crear pre-dictamen (boletín → posición)
                </button>
                <button onClick={() => setSolicitudActiva({ tipo_dictamen: "Registral" } as any)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  <ScrollText className="h-3.5 w-3.5" /> Dictamen Registral
                </button>
                <button onClick={() => setImportarAbierto(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" /> Importar cartera (Excel)
                </button>
              </div>

              {importarAbierto && (
                <ImportarCarteraURRJ onCerrar={() => setImportarAbierto(false)} onImportado={() => setSubVista("historial")} />
              )}

              {/* Sub-módulos: Solicitudes por dictaminar / Historial de pre-dictámenes.
                  Se ven uno a la vez para no amontonar la pantalla. */}
              <div className="flex gap-2 border-b border-border pt-1">
                <button onClick={() => setSubVista("solicitudes")}
                  className={`rounded-t-md px-3 py-2 text-sm font-semibold ${subVista === "solicitudes" ? "border-b-2 border-[color:var(--teal)] text-[color:var(--teal)]" : "text-muted-foreground hover:text-foreground"}`}>
                  Solicitudes por dictaminar
                </button>
                <button onClick={() => setSubVista("historial")}
                  className={`rounded-t-md px-3 py-2 text-sm font-semibold ${subVista === "historial" ? "border-b-2 border-[color:var(--teal)] text-[color:var(--teal)]" : "text-muted-foreground hover:text-foreground"}`}>
                  Historial de pre-dictámenes
                </button>
              </div>

              {subVista === "solicitudes" ? (
                <SolicitudesURRJ onDictaminar={dictaminarSolicitud} />
              ) : (
                <HistorialPredictamen onReDictaminar={reDictaminar} onReDictaminarRegistral={reDictaminarRegistral} onVerFichaVieja={verFichaVieja} />
              )}
            </>
          )}
          {crearNuevo && (
            <div>
              <button onClick={volver} className="text-xs font-medium text-muted-foreground underline">← Cancelar y volver a solicitudes</button>
            </div>
          )}
        </>
      ) : null}

      {solicitudActiva?.tipo_dictamen !== "Registral" && (solicitudActiva || vista !== "elegir" || crearNuevo) && (
        <DictaminadorPosicion
          casos={casos}
          vista={vista}
          onVista={setVista}
          precargar={precargar}
          onVolver={volver}
          puedeElaborar={puede("elaborar")}
          puedeFirmarElabora={puede("firmar_elabora")}
          puedeValidar={puede("validar")}
          puedeAdmin={puedeAdmin}
          puedePrecioPiso={puedePrecioPiso}
        />
      )}
    </div>
  );

  // Ficha del pre-dictamen abierta desde el historial (se alimenta de sus dictámenes)
  if (fichaGar) {
    return <FichaURRJ garantia={fichaGar} onVolver={() => setFichaGar(null)} />;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, #0C5C46)` }}>
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6" style={{ color: "#C2A24C" }} />
          <div>
            <h1 className="text-xl font-bold">URRJ · Dictaminación</h1>
            <p className="text-sm text-white/70">Unidad de Resolución Jurídica · dictaminación y registro de garantías</p>
          </div>
        </div>
      </div>

      <RegistroURRJ onReDictaminar={reDictaminar} dictaminar={dictaminacion} />
    </div>
  );
}
