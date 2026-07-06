import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAuth } from "@/lib/auth";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { Loader2, Lock, CheckCircle2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/firmar")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : undefined }),
  head: () => ({ meta: [{ title: "Firmar dictamen — JusticiaFácil" }] }),
  component: Firmar,
});

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const NAVY = "#0B1E3A";
const AZUL = "#0C447C";

const SLOT_TITULO: Record<string, string> = {
  elabora: "Elabora · UCP",
  dil: "Valida jurídico · Director Legal (DIL)",
  gad: "Administrativo · Gerencia (GAD)",
  dgc: "Comercial · Dirección Comercial (DGC)",
  dge: "Dirección · Dirección General (DGE)",
  ucm: "UCM · Seguimiento",
};

function Firmar() {
  const { token } = Route.useSearch();
  const [correo, setCorreo] = useState<string | null>(null);
  const [sol, setSol] = useState<any>(null);   // fila de firma_solicitud
  const [caso, setCaso] = useState<any>(null);
  const [dict, setDict] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!token) { setErr("Link inválido (sin token)."); setCargando(false); return; }
        const auth = await getAuth();
        const { data } = await auth.auth.getSession();
        setCorreo(data?.session?.user?.email ?? null);

        const sres = await fetch(`${SUPABASE_URL}/rest/v1/firma_solicitud?select=*&token=eq.${encodeURIComponent(token)}&limit=1`, { headers });
        const s = (sres.ok ? await sres.json() : [])?.[0];
        if (!s) { setErr("Este link de firma no existe o fue cancelado."); setCargando(false); return; }
        setSol(s);
        if (s.firmado) setOk(true);

        const [cres, dres] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&id=eq.${s.caso_id}&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])),
          fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=*&id=eq.${s.dictamen_id}&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])),
        ]);
        setCaso(cres?.[0] || null);
        setDict(dres?.[0] || null);
      } catch (e: any) {
        setErr("No se pudo cargar: " + (e?.message || ""));
      } finally {
        setCargando(false);
      }
    })();
  }, [token]);

  const firmar = async (f: DatosFirma) => {
    if (!f.fecha || !sol || !dict || !token) return;
    setGuardando(true); setErr(null);
    try {
      const firmas = { ...(dict.firmas || {}), [sol.slot]: f };
      const r1 = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${dict.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ firmas, updated_at: new Date().toISOString() }),
      });
      if (!r1.ok) throw new Error(`dictamen ${r1.status}`);
      await fetch(`${SUPABASE_URL}/rest/v1/firma_solicitud?token=eq.${encodeURIComponent(token)}`, {
        method: "PATCH", headers, body: JSON.stringify({ firmado: true, firmado_por: correo, firmado_at: new Date().toISOString() }),
      });
      setDict({ ...dict, firmas });
      setOk(true);
    } catch (e: any) {
      setErr("No se pudo firmar: " + (e?.message || ""));
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const Wrap = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-muted/30 px-4 py-8"><div className="mx-auto max-w-lg space-y-4">{children}</div></div>
  );

  if (err) return <Wrap><Aviso icon={Lock} color="#A32D2D" titulo="No se puede firmar">{err}</Aviso></Wrap>;

  const correoEsperado = sol?.correo_esperado || "";
  const identidadOK = !!correo && !!correoEsperado && correo.toLowerCase() === correoEsperado.toLowerCase();
  if (!identidadOK && !ok) {
    return (
      <Wrap>
        <Aviso icon={Lock} color="#B26B00" titulo="Este link es para otra persona">
          Este link de firma es para <b>{correoEsperado || "—"}</b>. Entraste como <b>{correo || "sin sesión"}</b>. Entra con la cuenta correcta para poder firmar.
        </Aviso>
      </Wrap>
    );
  }

  const titulo = SLOT_TITULO[sol?.slot] || sol?.slot || "Firma";
  const vReg = typeof dict?.registral?.veredicto === "string" ? dict.registral.veredicto : "—";

  return (
    <Wrap>
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${AZUL})` }}>
        <p className="text-xs uppercase tracking-wide text-white/60">Firma de dictamen · UCP</p>
        <p className="text-xl font-bold">{caso?.expediente || "Sin expediente"}</p>
        <p className="text-sm text-white/80">{caso?.direccion_garantia || caso?.cliente_nombre || "—"}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="mb-2 flex items-center gap-1.5 font-semibold" style={{ color: NAVY }}><ShieldCheck className="h-4 w-4" /> Lo que vas a firmar</p>
        <Dato k="Firma" v={titulo} />
        <Dato k="Cliente" v={caso?.cliente_nombre || "—"} />
        <Dato k="Juzgado" v={caso?.juzgado || "—"} />
        <Dato k="Veredicto jurídico" v={dict?.juridico?.veredicto || "—"} />
        <Dato k="Veredicto registral" v={vReg} />
        <Dato k="Veredicto final" v={dict?.veredicto || "—"} />
      </div>

      {ok ? (
        <Aviso icon={CheckCircle2} color="#0C5C46" titulo="Firma registrada ✓">
          Gracias, tu firma quedó guardada. Ya puedes cerrar esta ventana.
        </Aviso>
      ) : (
        <div className="rounded-xl border-2 border-[color:var(--teal)]/40 bg-[color:var(--teal)]/5 p-4">
          <p className="mb-2 text-sm font-semibold" style={{ color: "#0C5C46" }}>Tu firma · {titulo}</p>
          <FirmaParte titulo={titulo} valor={dict?.firmas?.[sol.slot] || null} onFirmar={firmar} cargoSugerido={titulo} />
          {guardando && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</p>}
        </div>
      )}
    </Wrap>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-1 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function Aviso({ icon: Ic, color, titulo, children }: { icon: any; color: string; titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl" style={{ background: color + "22", color }}><Ic className="h-6 w-6" /></div>
      <p className="font-display text-lg font-semibold">{titulo}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
