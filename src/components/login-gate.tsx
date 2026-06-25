import { useEffect, useState } from "react";
import { auth, correoPermitido } from "@/lib/auth";

const NAVY = "#0B1E3A";
const GOLD = "#C2A24C";

export function LoginGate({ children }: { children: React.ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    auth.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
      setCargando(false);
    });
    const { data: sub } = auth.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const entrar = async () => {
    setError(null);
    await auth.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const salir = async () => { await auth.auth.signOut(); setEmail(null); };

  if (cargando) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Cargando…</div>;
  }

  // Entró pero con correo no permitido
  if (email && !correoPermitido(email)) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold">Acceso restringido</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu correo <b>{email}</b> no pertenece a <b>@diipadesarrollos.com</b>.
          </p>
          <button onClick={salir} className="mt-4 rounded-md border px-4 py-2 text-sm">Cambiar de cuenta</button>
        </div>
      </div>
    );
  }

  // No ha entrado → pantalla de bienvenida
  if (!email) {
    return (
      <div className="grid min-h-screen place-items-center p-6" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #103A3A 60%, #0C5C46 100%)` }}>
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
          <img src="/justiciafacil-logo.png" alt="JusticiaFácil" className="mx-auto h-24 w-auto" />
          <h1 className="mt-4 font-display text-2xl font-bold" style={{ color: NAVY }}>JusticiaFácil</h1>
          <p className="text-sm text-muted-foreground">DIIPA Desarrollos · Área Jurídica</p>
          <button
            onClick={entrar}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-gray-50"
            style={{ borderColor: "#dadce0" }}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="h-5 w-5" />
            Entrar con Google
          </button>
          <p className="mt-3 text-[11px] text-muted-foreground">Solo cuentas @diipadesarrollos.com</p>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  // Entró con correo permitido → muestra la app
  return <>{children}</>;
}
