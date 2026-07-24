import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAuth } from "@/lib/auth";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { rechazarSolicitud } from "@/lib/firma-solicitud";
import { avanzarCadena, rechazarYRetroceder, TITULO_ETAPA, type EtapaFirma } from "@/lib/cadena-firmas-urrj";
import { Loader2, Lock, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";

export const Route = createFileRoute("/firmar")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : undefined }),
  head: () => ({ meta: [{ title: "Firmar dictamen — JusticiaFácil" }] }),
  component: Firmar,
});

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const NAVY = "#0B1E3A";
const AZUL = "#0C447C";

const SLOT_TITULO: Record<string, string> = {
  elabora: "Elabora",
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
  const [yaRechazado, setYaRechazado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [modoRechazo, setModoRechazo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [siguienteInfo, setSiguienteInfo] = useState<{ ok: boolean; siguiente: EtapaFirma; correo?: string; link?: string; error?: string } | null>(null);

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
        if (s.rechazado) setYaRechazado(true);

        const proms: Promise<any>[] = [
          fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&id=eq.${s.caso_id}&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])),
        ];
        if (s.dictamen_id) proms.push(fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=*&id=eq.${s.dictamen_id}&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])));
        else if (s.predictamen_id) proms.push(fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=*&id=eq.${s.predictamen_id}&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])));
        else proms.push(Promise.resolve([]));
        const [cres, dres] = await Promise.all(proms);
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
      if (sol.dictamen_id) {
        // UCP: las firmas viven en dictamen.firmas[slot]
        const firmas = { ...(dict.firmas || {}), [sol.slot]: f };
        const r1 = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${dict.id}`, {
          method: "PATCH", headers, body: JSON.stringify({ firmas, updated_at: new Date().toISOString() }),
        });
        if (!r1.ok) throw new Error(`dictamen ${r1.status}`);
        setDict({ ...dict, firmas });
      } else if (sol.predictamen_id) {
        // URRJ: cadena de 4 etapas — cada una en su propia columna.
        const COLUMNA: Record<string, string> = { elabora: "firma_elabora", dil: "firma_dil", ucm: "firma_ucm", dge: "firma_dge" };
        const campo = COLUMNA[sol.slot] || "firma_valida";
        const campoFecha = campo + "_fecha";
        const r1 = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${dict.id}`, {
          method: "PATCH", headers, body: JSON.stringify({ [campo]: f.nombre, [campoFecha]: f.fecha }),
        });
        if (!r1.ok) throw new Error(`predictamen ${r1.status}`);
        setDict({ ...dict, [campo]: f.nombre, [campoFecha]: f.fecha });
        // Encadena sola a la siguiente etapa (DGE se salta si no quedó Positivo).
        if (sol.slot !== "elabora") {
          const av = await avanzarCadena({
            predictamenId: dict.id, casoId: caso?.id, expedienteTexto: caso?.expediente || "el expediente",
            etapaQueAcabaDeFirmar: sol.slot as EtapaFirma, dictamenFinal: dict.dictamen_final || null,
          });
          setSiguienteInfo(av);
        }
      }
      await fetch(`${SUPABASE_URL}/rest/v1/firma_solicitud?token=eq.${encodeURIComponent(token)}`, {
        method: "PATCH", headers, body: JSON.stringify({ firmado: true, firmado_por: correo, firmado_at: new Date().toISOString() }),
      });
      setOk(true);
    } catch (e: any) {
      setErr("No se pudo firmar: " + (e?.message || ""));
    } finally {
      setGuardando(false);
    }
  };

  const rechazar = async () => {
    if (!motivoRechazo.trim() || !token) return;
    setRechazando(true); setErr(null);
    const r = await rechazarSolicitud(token, motivoRechazo.trim(), correo);
    if (!r.ok) { setRechazando(false); setErr("No se pudo registrar el rechazo — intenta de nuevo."); return; }
    // URRJ: además de marcar esta solicitud como rechazada, la cadena
    // retrocede UN PASO (no hasta el inicio) y se avisa a esa persona.
    if (sol?.predictamen_id && sol.slot !== "elabora") {
      const rb = await rechazarYRetroceder({
        predictamenId: dict.id, casoId: caso?.id, expedienteTexto: caso?.expediente || "el expediente",
        etapaQueRechaza: sol.slot as EtapaFirma, motivo: motivoRechazo.trim(),
      });
      setSiguienteInfo({ ok: rb.ok, siguiente: rb.anterior, correo: rb.correo, error: rb.error });
    }
    setRechazando(false);
    setYaRechazado(true);
    setModoRechazo(false);
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

  const esURRJ = !!sol?.predictamen_id;
  const titulo = TITULO_ETAPA[sol?.slot] || SLOT_TITULO[sol?.slot] || sol?.slot || "Firma";
  const vReg = typeof dict?.registral?.veredicto === "string" ? dict.registral.veredicto : "—";
  const COLUMNA_URRJ: Record<string, string> = { elabora: "firma_elabora", dil: "firma_dil", ucm: "firma_ucm", dge: "firma_dge" };
  const valorFirma: DatosFirma | null = esURRJ
    ? (() => {
        const campo = COLUMNA_URRJ[sol?.slot] || "firma_valida";
        const nombre = dict?.[campo];
        return nombre ? { nombre, cargo: "", fecha: dict?.[campo + "_fecha"] || "", dibujo: null } : null;
      })()
    : (dict?.firmas?.[sol?.slot] || null);

  if (yaRechazado) return (
    <Wrap>
      <Aviso icon={XCircle} color="#A32D2D" titulo="Rechazado">
        Registraste el rechazo. {siguienteInfo?.siguiente === "elabora"
          ? "El caso se regresa a quien elaboró para que lo corrija."
          : siguienteInfo?.siguiente
          ? `El caso regresa un paso: le toca revisar de nuevo a ${TITULO_ETAPA[siguienteInfo.siguiente] || siguienteInfo.siguiente}.`
          : "El caso se regresa un paso."}
        {siguienteInfo?.correo && <> Se preparó un correo para <b>{siguienteInfo.correo}</b> — si no se abrió tu correo solo, avísale tú por tu cuenta.</>}
        {siguienteInfo?.error && <> ⚠️ {siguienteInfo.error}</>}
      </Aviso>
    </Wrap>
  );

  return (
    <Wrap>
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${AZUL})` }}>
        <p className="text-xs uppercase tracking-wide text-white/60">Firma / validación de dictamen · {esURRJ ? "URRJ" : sol?.area === "UCM" ? "UCM" : "UCP"}</p>
        <p className="text-xl font-bold">{caso?.expediente || "Sin expediente"}</p>
        <p className="text-sm text-white/80">{caso?.direccion_garantia || caso?.cliente_nombre || "—"}</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="mb-2 flex items-center gap-1.5 font-semibold" style={{ color: NAVY }}><ShieldCheck className="h-4 w-4" /> Lo que vas a validar</p>
        <Dato k="Firma" v={titulo} />
        <Dato k="Cliente" v={caso?.cliente_nombre || "—"} />
        <Dato k="Juzgado" v={caso?.juzgado || "—"} />
        {esURRJ ? (
          <Dato k="Decisión (Sí/No pasa)" v={dict?.dictamen_final || "—"} />
        ) : (
          <>
            <Dato k="Veredicto jurídico" v={dict?.juridico?.veredicto || "—"} />
            <Dato k="Veredicto registral" v={vReg} />
            <Dato k="Veredicto final" v={dict?.veredicto || "—"} />
          </>
        )}
        {dict?.pdf_url && (
          <a href={dict.pdf_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--teal)] hover:underline">📄 Ver el PDF completo del dictamen →</a>
        )}
      </div>

      {ok ? (
        <Aviso icon={CheckCircle2} color="#0C5C46" titulo="Firma registrada ✓">
          Gracias, tu firma quedó guardada.
          {siguienteInfo?.siguiente === "completo" && " La cadena de firmas ya se completó."}
          {siguienteInfo?.siguiente && siguienteInfo.siguiente !== "completo" && (
            <> Le toca ahora a <b>{TITULO_ETAPA[siguienteInfo.siguiente] || siguienteInfo.siguiente}</b>{siguienteInfo.correo ? ` (${siguienteInfo.correo})` : ""} — se preparó su correo con el link.</>
          )}
          {siguienteInfo?.error && <> ⚠️ {siguienteInfo.error}</>}
          {" "}Ya puedes cerrar esta ventana.
        </Aviso>
      ) : modoRechazo ? (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <p className="mb-2 text-sm font-semibold text-red-900">¿Por qué se rechaza?</p>
          <textarea value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)} rows={4}
            placeholder="Explica qué falta corregir — se regresa a quien elaboró el dictamen." className="w-full rounded-md border border-red-300 px-3 py-2 text-sm" />
          <div className="mt-2 flex gap-2">
            <button onClick={() => setModoRechazo(false)} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={rechazar} disabled={!motivoRechazo.trim() || rechazando} className="flex items-center gap-1.5 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {rechazando ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Confirmar rechazo
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-[color:var(--teal)]/40 bg-[color:var(--teal)]/5 p-4">
          <p className="mb-2 text-sm font-semibold" style={{ color: "#0C5C46" }}>Tu firma · {titulo}</p>
          <FirmaParte titulo={titulo} valor={valorFirma} onFirmar={firmar} cargoSugerido={titulo} />
          {guardando && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</p>}
          <button onClick={() => setModoRechazo(true)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-700 hover:underline"><XCircle className="h-3.5 w-3.5" /> No estoy de acuerdo — rechazar y regresar</button>
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
