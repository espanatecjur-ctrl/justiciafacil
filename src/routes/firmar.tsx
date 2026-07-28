import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAuth } from "@/lib/auth";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { BloquePrecioURRJ, PRECIO_VACIO, type PrecioURRJ } from "@/components/bloque-precio-urrj";
import { rechazarSolicitud } from "@/lib/firma-solicitud";
import { avanzarCadena, rechazarYRetroceder, TITULO_ETAPA, type EtapaFirma } from "@/lib/cadena-firmas-urrj";
import { BotonVerDoc } from "@/components/visor-documento";
import { Loader2, Lock, CheckCircle2, ShieldCheck, XCircle, FileText, StickyNote } from "lucide-react";

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
  const [sol, setSol] = useState<any>(null);
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
  const [precio, setPrecio] = useState<PrecioURRJ>(PRECIO_VACIO);
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);
  const [docs, setDocs] = useState<{ nombre: string; url: string }[]>([]);
  const [nota, setNota] = useState("");
  const [registral, setRegistral] = useState<any>(null);

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
        if (dres?.[0]?.datos?.precio) setPrecio((p) => ({ ...p, ...dres[0].datos.precio }));

        const numeroCredito = dres?.[0]?.datos?.numeroCredito || "";
        const condiciones = [
          cres?.[0]?.id ? `caso_id.eq.${cres[0].id}` : null,
          cres?.[0]?.expediente ? `expediente.eq.${encodeURIComponent(cres[0].expediente)}` : null,
          numeroCredito ? `numero_credito.eq.${encodeURIComponent(numeroCredito)}` : null,
        ].filter(Boolean) as string[];
        if (condiciones.length) {
          const filtro = condiciones.length === 1 ? condiciones[0].replace(".eq.", "=eq.") : `or=(${condiciones.join(",")})`;
          fetch(`${SUPABASE_URL}/rest/v1/solicitud_predictamen?select=documentos&${filtro}&order=created_at.desc&limit=50`, { headers })
            .then((r) => (r.ok ? r.json() : []))
            .then((rows: any[]) => {
              const vistos = new Set<string>();
              const todos: { nombre: string; url: string }[] = [];
              for (const row of rows) for (const d of row.documentos || []) {
                if (d?.url && !vistos.has(d.url)) { vistos.add(d.url); todos.push({ nombre: d.nombre || "documento", url: d.url }); }
              }
              setDocs(todos);
            }).catch(() => setDocs([]));
        }

        const claveExp = (cres?.[0]?.expediente || dres?.[0]?.expediente || "").trim();
        if (claveExp) {
          fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral?select=resultado,firma_elabora,firma_valida,terminado,conclusion&expediente=eq.${encodeURIComponent(claveExp)}&order=created_at.desc&limit=1`, { headers })
            .then((r) => (r.ok ? r.json() : [])).then((rows) => setRegistral(rows?.[0] || null)).catch(() => setRegistral(null));
        }
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
        const firmas = { ...(dict.firmas || {}), [sol.slot]: f };
        const r1 = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${dict.id}`, {
          method: "PATCH", headers, body: JSON.stringify({ firmas, updated_at: new Date().toISOString() }),
        });
        if (!r1.ok) throw new Error(`dictamen ${r1.status}`);
        setDict({ ...dict, firmas });
      } else if (sol.predictamen_id) {
        const COLUMNA: Record<string, string> = { elabora: "firma_elabora", dil: "firma_dil", ucm: "firma_ucm", dge: "firma_dge" };
        const campo = COLUMNA[sol.slot] || "firma_valida";
        const campoFecha = campo + "_fecha";
        const notasPrevias: any[] = Array.isArray(dict.datos?.notas_validacion) ? dict.datos.notas_validacion : [];
        const datosNuevos = nota.trim()
          ? { ...(dict.datos || {}), notas_validacion: [...notasPrevias, { slot: sol.slot, quien: f.nombre, nota: nota.trim(), fecha: f.fecha }] }
          : dict.datos;
        const patch: any = { [campo]: f.nombre, [campoFecha]: f.fecha };
        if (nota.trim()) patch.datos = datosNuevos;
        const r1 = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${dict.id}`, {
          method: "PATCH", headers, body: JSON.stringify(patch),
        });
        if (!r1.ok) throw new Error(`predictamen ${r1.status}`);
        const dictActualizado = { ...dict, [campo]: f.nombre, [campoFecha]: f.fecha, ...(nota.trim() ? { datos: datosNuevos } : {}) };
        setDict(dictActualizado);
        if (sol.slot !== "elabora") {
          const av = await avanzarCadena({
            predictamenId: dict.id, casoId: caso?.id, expedienteTexto: caso?.expediente || "el expediente",
            etapaQueAcabaDeFirmar: sol.slot as EtapaFirma, dictamenFinal: dict.dictamen_final || null,
          });
          setSiguienteInfo(av);
        }
        regenerarPDF(dictActualizado);
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

  const regenerarPDF = async (d: any) => {
    try {
      const { descargarPredictamenPDF } = await import("@/lib/predictamen-pdf");
      const dd = d.datos || {};
      const res = d.resultados || {};
      const riesgos = Object.entries(res).filter(([, v]: any) => v && typeof v === "object" && v.semaforo).map(([k, v]: any) => ({ nombre: k, r: v }));
      const fin = res.financiero;
      const url = await descargarPredictamenPDF({
        expediente: d.expediente || "", juzgado: d.juzgado || "", estado: d.estado || "", tipoJuicio: d.tipo_juicio || "", posicion: d.posicion || "",
        ubicacion: dd.ubicacion || "", deudor: dd.deudor || dd.deCujus || "", quienCede: dd.quienCede || dd.acreedor || dd.heredero || "", queCede: dd.queCede || "Derechos",
        dictamen: d.dictamen_sugerido || "", riesgos,
        intereses: fin ? { ordinarios: fin.ordinarios, moratorios: fin.moratorios, iva: fin.iva, total: fin.totalDeuda, udis: fin.udis, usura: fin.alertaUsura } : { ordinarios: 0, moratorios: 0, iva: 0, total: 0, usura: false },
        anotaciones: dd.anotacionesHumanas || dd.anotaciones || "",
        firmaElabora: d.firma_elabora ? { nombre: d.firma_elabora, cargo: "", fecha: d.firma_elabora_fecha || "", dibujo: null } : null,
        firmaValida: d.firma_dil ? { nombre: d.firma_dil, cargo: "", fecha: d.firma_dil_fecha || "", dibujo: null } : null,
        decision: d.dictamen_final || "",
      }, "archivar");
      if (typeof url === "string") {
        await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${d.id}`, { method: "PATCH", headers, body: JSON.stringify({ pdf_url: url }) });
        setDict((p: any) => (p ? { ...p, pdf_url: url } : p));
      }
    } catch { /* el PDF se puede volver a generar después desde el Historial */ }
  };

  const guardarPrecio = async () => {
    if (!sol || !dict || !token) return;
    setGuardandoPrecio(true); setErr(null);
    try {
      const nuevosDatos = { ...(dict.datos || {}), precio };
      const r1 = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?id=eq.${dict.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ datos: nuevosDatos }),
      });
      if (!r1.ok) throw new Error(`predictamen ${r1.status}`);
      setDict({ ...dict, datos: nuevosDatos });
      const av = await avanzarCadena({
        predictamenId: dict.id, casoId: caso?.id || "", expedienteTexto: caso?.expediente || dict?.expediente || "el expediente",
        etapaQueAcabaDeFirmar: "precio", dictamenFinal: dict.dictamen_final || null,
      });
      setSiguienteInfo(av);
      await fetch(`${SUPABASE_URL}/rest/v1/firma_solicitud?token=eq.${encodeURIComponent(token)}`, {
        method: "PATCH", headers, body: JSON.stringify({ firmado: true, firmado_por: correo, firmado_at: new Date().toISOString() }),
      });
      setOk(true);
    } catch (e: any) {
      setErr("No se pudo guardar el precio: " + (e?.message || ""));
    } finally {
      setGuardandoPrecio(false);
    }
  };

  const rechazar = async () => {
    if (!motivoRechazo.trim() || !token) return;
    setRechazando(true); setErr(null);
    const r = await rechazarSolicitud(token, motivoRechazo.trim(), correo);
    if (!r.ok) { setRechazando(false); setErr("No se pudo registrar el rechazo — intenta de nuevo."); return; }
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
  const resURRJ = dict?.resultados || {};
  const riesgos = Object.entries(resURRJ).filter(([, v]: any) => v && typeof v === "object" && v.semaforo).map(([k, v]: any) => ({ k, v }));
  const fin = resURRJ.financiero;
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

      {esURRJ && riesgos.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="mb-2 font-semibold" style={{ color: NAVY }}>Auditores / riesgos</p>
          <div className="space-y-2">
            {riesgos.map(({ k, v }: any) => (
              <div key={k} className="rounded-lg border border-border p-2.5">
                <div className="flex items-center gap-2 font-medium"><span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: semColor(v.semaforo) }} />{v.etiqueta}{v.dato ? <span className="font-normal text-muted-foreground"> · {v.dato}</span> : null}</div>
                {v.detalle && <p className="mt-1 text-[13px] text-muted-foreground">{v.detalle}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {esURRJ && fin && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="mb-2 font-semibold" style={{ color: NAVY }}>Intereses</p>
          <div className="space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Ordinarios</span><b>{fmtMXN(fin.ordinarios)}</b></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Moratorios</span><b>{fmtMXN(fin.moratorios)}</b></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total deuda</span><b>{fmtMXN(fin.totalDeuda)}</b></div>
          </div>
        </div>
      )}

      {esURRJ && (dict?.datos?.anotacionesHumanas || dict?.datos?.anotaciones) && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="mb-1 font-semibold" style={{ color: NAVY }}>Anotaciones del abogado que elaboró</p>
          <p className="whitespace-pre-wrap text-muted-foreground">{dict?.datos?.anotacionesHumanas || dict?.datos?.anotaciones}</p>
        </div>
      )}

      {esURRJ && registral && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="mb-2 flex items-center justify-between font-semibold" style={{ color: NAVY }}>
            Dictamen registral
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${registral.terminado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{registral.terminado ? "Terminado" : "En curso"}</span>
          </p>
          <Dato k="Resultado" v={registral.resultado || "—"} />
          <Dato k="Elabora" v={registral.firma_elabora?.nombre || "Sin firmar"} />
          <Dato k="Valida (DIL)" v={registral.firma_valida?.nombre || "Sin firmar"} />
          {registral.conclusion && <p className="mt-1.5 whitespace-pre-wrap text-muted-foreground">{registral.conclusion}</p>}
        </div>
      )}

      {docs.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <p className="mb-2 flex items-center gap-1.5 font-semibold" style={{ color: NAVY }}><FileText className="h-4 w-4" /> Documentos del caso</p>
          <div className="divide-y divide-border">
            {docs.map((doc, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground"><FileText className="h-3.5 w-3.5 shrink-0" />{doc.nombre}</span>
                <BotonVerDoc url={doc.url} nombre={doc.nombre} label="ver" />
              </div>
            ))}
          </div>
        </div>
      )}

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
      ) : sol?.slot === "precio" ? (
        <div className="rounded-xl border-2 border-[color:var(--teal)]/40 bg-[color:var(--teal)]/5 p-4">
          <p className="mb-2 text-sm font-semibold" style={{ color: "#0C5C46" }}>Llena el precio · {titulo}</p>
          <BloquePrecioURRJ valor={precio} onChange={setPrecio} puedePrecioPiso />
          {guardandoPrecio && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</p>}
          <button onClick={guardarPrecio} disabled={guardandoPrecio || !precio.precioPiso.trim()} className="mt-3 flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#0C5C46" }}>
            {guardandoPrecio ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Guardar precio y avisar a DGE
          </button>
          {!precio.precioPiso.trim() && <p className="mt-1 text-[11px] text-amber-700">Falta capturar el precio piso para poder guardar.</p>}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-[color:var(--teal)]/40 bg-[color:var(--teal)]/5 p-4">
          <p className="mb-2 text-sm font-semibold" style={{ color: "#0C5C46" }}>Tu firma · {titulo}</p>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><StickyNote className="h-3.5 w-3.5" /> Tus anotaciones (opcional)</label>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder="Algo que quieras dejar anotado sobre tu revisión…"
            className="mb-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <FirmaParte titulo={titulo} valor={valorFirma} onFirmar={firmar} cargoSugerido={titulo} />
          {guardando && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…</p>}
          <button onClick={() => setModoRechazo(true)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-700 hover:underline"><XCircle className="h-3.5 w-3.5" /> No estoy de acuerdo — rechazar y regresar</button>
        </div>
      )}
    </Wrap>
  );
}

function semColor(s: string) {
  return s === "verde" ? "#0C5C46" : s === "amarillo" ? "#C2A24C" : s === "naranja" ? "#D97706" : s === "rojo" ? "#DC2626" : "#9CA3AF";
}
const fmtMXN = (v: number) => (v || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

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
