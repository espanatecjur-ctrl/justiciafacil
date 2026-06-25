import { useEffect, useState, type ReactNode } from "react";
import { getAuth, correoPermitido } from "@/lib/auth";

const NAVY = "#0B1E3A";

export function LoginGate({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => {};
    getAuth()
      .then(async (auth) => {
        const { data } = await auth.auth.getSession();
        setEmail(data.session?.user?.email ?? null);
        setCargando(false);
        const { data: sub } = auth.auth.onAuthStateChange((_e: any, session: any) => {
          setEmail(session?.user?.email ?? null);
        });
        unsub = () => sub.subscription.unsubscribe();
      })
      .catch(() => setCargando(false));
    return () => unsub();
  }, []);

  const entrar = async () => {
    const auth = await getAuth();
    await auth.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const salir = async () => {
    const auth = await getAuth();
    await auth.auth.signOut();
    setEmail(null);
  };

  if (cargando) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Cargando…</div>;
  }

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
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
