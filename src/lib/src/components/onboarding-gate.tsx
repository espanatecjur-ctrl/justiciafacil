// ============================================================
//  OnboardingGate · Registro y aprobación de entrada
// ------------------------------------------------------------
//  Se ejecuta DESPUÉS del login (dentro de LoginGate). Si el
//  correo ya tiene rol en `colaboradores`, deja pasar a la app.
//  Si no, muestra el formulario de registro; y si ya se registró,
//  la pantalla de "esperando aprobación".
// ============================================================
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getAuth, rolActual } from "@/lib/auth";
import {
  solicitudDeCorreo, crearSolicitudEntrada,
  TIPOS_ENTRADA, TIPOS_CON_CEDULA, type SolicitudEntrada,
} from "@/lib/solicitud-entrada";

const NAVY = "#0B1E3A";
const fondo = { background: `linear-gradient(135deg, ${NAVY} 0%, #103A3A 60%, #0C5C46 100%)` };

async function cerrarSesion() {
  const auth = await getAuth();
  await auth.auth.signOut();
  window.location.reload();
}

export function OnboardingGate({ email, children }: { email: string; children: ReactNode }) {
  const [estado, setEstado] = useState<"cargando" | "registro" | "pendiente" | "rechazado" | "ok">("cargando");
  const [nombreGoogle, setNombreGoogle] = useState("");
  const [solicitud, setSolicitud] = useState<SolicitudEntrada | null>(null);

  const revisar = useCallback(async () => {
    const rol = await rolActual();
    if (rol) { setEstado("ok"); return; }
    const s = await solicitudDeCorreo(email);
    setSolicitud(s);
    if (!s) setEstado("registro");
    else if (s.estado === "rechazado") setEstado("rechazado");
    else if (s.estado === "aprobado") setEstado("ok");
    else setEstado("pendiente");
  }, [email]);

  useEffect(() => {
    getAuth().then(async (auth) => {
      const { data } = await auth.auth.getSession();
      const meta = data.session?.user?.user_metadata as { full_name?: string; name?: string } | undefined;
      setNombreGoogle(meta?.full_name || meta?.name || "");
    });
    revisar();
  }, [revisar]);

  if (estado === "cargando") {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Revisando tu acceso…</div>;
  }
  if (estado === "ok") return <>{children}</>;
  if (estado === "pendiente") return <PantallaEspera correo={email} />;
  if (estado === "rechazado") return <PantallaRechazado nota={solicitud?.nota} />;
  return <FormularioRegistro correo={email} nombreInicial={nombreGoogle} onListo={revisar} />;
}

// ————————————————————————— Formulario —————————————————————————
function FormularioRegistro({ correo, nombreInicial, onListo }: { correo: string; nombreInicial: string; onListo: () => void }) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState("");
  const [cedula, setCedula] = useState("");
  const [tipo, setTipo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (nombreInicial && !nombre) setNombre(nombreInicial); }, [nombreInicial]); // eslint-disable-line

  const cedulaObligatoria = TIPOS_CON_CEDULA.includes(tipo);

  const enviar = async () => {
    setError(null);
    if (!nombre.trim()) return setError("Escribe tu nombre completo.");
    if (!telefono.trim()) return setError("Escribe tu teléfono.");
    if (!tipo) return setError("Selecciona qué eres (abogado, apoderado, gestor o pasante).");
    if (cedulaObligatoria && !cedula.trim()) return setError("La cédula profesional es obligatoria para tu tipo.");
    setEnviando(true);
    const r = await crearSolicitudEntrada({
      correo, nombre: nombre.trim(), telefono: telefono.trim(),
      cedula_profesional: cedula.trim() || null, tipo,
    });
    setEnviando(false);
    if (r.ok) onListo();
    else setError("No se pudo registrar: " + (r.error || "") + " (¿se corrió el SQL de solicitud_entrada?)");
  };

  return (
    <div className="grid min-h-screen place-items-center p-6" style={fondo}>
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="font-display text-xl font-bold" style={{ color: NAVY }}>Regístrate para entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu correo <b>{correo}</b> aún no tiene acceso. Completa tus datos y un responsable te asignará tu rol.
        </p>

        <div className="mt-5 space-y-3">
          <Campo label="Nombre completo *">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="ip" placeholder="Tu nombre" />
          </Campo>
          <Campo label="Teléfono *">
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="ip" placeholder="10 dígitos" />
          </Campo>
          <Campo label="¿Qué eres? *">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="ip capitalize">
              <option value="">— Selecciona —</option>
              {TIPOS_ENTRADA.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
          </Campo>
          <Campo label={`Cédula profesional ${cedulaObligatoria ? "*" : "(opcional)"}`}>
            <input value={cedula} onChange={(e) => setCedula(e.target.value)} className="ip" placeholder={cedulaObligatoria ? "Obligatoria" : "Si tienes"} />
          </Campo>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <button onClick={enviar} disabled={enviando}
          className="mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: NAVY }}>
          {enviando ? "Enviando…" : "Enviar solicitud"}
        </button>
        <button onClick={cerrarSesion} className="mt-2 w-full text-center text-xs text-muted-foreground hover:underline">
          Cambiar de cuenta
        </button>
      </div>
      <style>{`.ip{width:100%;height:38px;border:1px solid #e2e2e2;border-radius:8px;padding:0 12px;font-size:14px;background:#fff}`}</style>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

// ————————————————————————— Estados —————————————————————————
function PantallaEspera({ correo }: { correo: string }) {
  return (
    <div className="grid min-h-screen place-items-center p-6" style={fondo}>
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-2xl">⏳</div>
        <h1 className="font-display text-xl font-bold" style={{ color: NAVY }}>Solicitud enviada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gracias. Tu registro con <b>{correo}</b> quedó <b>pendiente de aprobación</b>. Un responsable revisará tus datos y te asignará tu rol. Cuando te aprueben, entrarás automáticamente.
        </p>
        <button onClick={() => window.location.reload()} className="mt-5 rounded-lg border px-4 py-2 text-sm">Ya me aprobaron — reintentar</button>
        <button onClick={cerrarSesion} className="mt-2 block w-full text-center text-xs text-muted-foreground hover:underline">Salir</button>
      </div>
    </div>
  );
}

function PantallaRechazado({ nota }: { nota?: string | null }) {
  return (
    <div className="grid min-h-screen place-items-center p-6" style={fondo}>
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-red-100 text-2xl">🚫</div>
        <h1 className="font-display text-xl font-bold" style={{ color: NAVY }}>Solicitud no aprobada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu solicitud de acceso no fue aprobada.{nota ? <> Motivo: <b>{nota}</b>.</> : null} Si crees que es un error, contacta a tu responsable.
        </p>
        <button onClick={cerrarSesion} className="mt-5 rounded-lg border px-4 py-2 text-sm">Salir</button>
      </div>
    </div>
  );
}
