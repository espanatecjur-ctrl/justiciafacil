// ============================================================
//  FichaURRJ · ficha 360 de una garantía — MISMO esqueleto que la
//  ficha de expediente (encabezado, línea de vida, Antecedente +
//  Estatus, Documentos), pero alimentada de SU propio dictamen URRJ.
//   · Overview (modo "ficha"): veredictos + fases + cronómetro + PDF
//   · Proceso (modo "dictaminar"): pestañas con los motores existentes
//  Reusa DictaminadorPosicion + DictamenRegistral + LineaVidaAreas +
//  DocumentosGarantia + BotonCarpetaDrive (sin motores nuevos).
// ============================================================
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BotonVerDoc } from "@/components/visor-documento";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LineaVidaAreas } from "@/components/linea-vida-areas";
import { DocumentosGarantia } from "@/components/documentos-garantia";
import { CarpetaDriveVinculada } from "@/components/carpeta-drive-vinculada";
import { DocumentosFijos } from "@/components/documentos-fijos";
import { SubJuicios } from "@/components/sub-juicios";
import { BoletinExpediente } from "@/components/boletin-expediente";
import { IndicadorRepetido } from "@/components/indicador-repetido";
import { LayoutGrid, GitBranch, FolderOpen, Megaphone } from "lucide-react";
import { DictaminadorPosicion, type VistaPosicion } from "@/components/dictaminador-posicion";
import { DictamenRegistral } from "@/components/dictamen-registral";
import { cargarPermisosURRJ } from "@/lib/urrj-permisos";
import { getAuth } from "@/lib/auth";
import { obtenerRecorrido, textoDictamen, type Dictamen } from "@/lib/recorrido";
import { TIPOS_TRAMITE } from "@/lib/urrj-tramites";
import { diasHabiles } from "@/lib/urrj-motores";
import { type Precarga } from "@/lib/predictamen-guardar";
import { ArrowLeft, Scale, Landmark, Gavel, Paperclip, Activity, Clock, ArrowRight, PenLine, Loader2 } from "lucide-react";
import { VincularClienteModal } from "@/components/vincular-cliente";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";
const PURPLE = "#0F6E6E";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface RefGarantia {
  id?: string;
  expediente?: string;
  direccion_garantia?: string;
  juzgado?: string;
  cliente_nombre?: string;
  deudor?: string;
  entidad?: string;
}

function VeredictoBadge({ label, dic }: { label: string; dic: Dictamen }) {
  const cls = dic === "positivo"
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : dic === "negativo"
    ? "bg-red-50 text-red-800 border-red-200"
    : "bg-muted text-muted-foreground border-border";
  return <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>{label}: {textoDictamen(dic)}</span>;
}

// Fila de dato (label + valor); marca ⚠️ si vacío y es importante
const inp = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm";
function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Dato({ label, valor, importante }: { label: string; valor?: string | null; importante?: boolean }) {
  const vacio = !valor || !String(valor).trim();
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{vacio ? (importante ? <span className="text-red-600">falta</span> : "—") : valor}</span>
    </div>
  );
}

// Tarjeta de sección reutilizable (mismo estilo que la ficha de expediente)
function Seccion({ icon, titulo, accion, children }: { icon: ReactNode; titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}>{icon} {titulo}</p>
        {accion}
      </div>
      {children}
    </div>
  );
}

export function FichaURRJ({ garantia, onVolver }: { garantia: RefGarantia; onVolver: () => void }) {
  const [modo, setModo] = useState<"ficha" | "dictaminar">("ficha");
  const [tab, setTab] = useState("juridico");
  const [vista, setVista] = useState<VistaPosicion>("elegir");
  const [permisos, setPermisos] = useState<string[]>([]);
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [docs, setDocs] = useState<{ nombre: string; url: string }[]>([]);
  const [jur, setJur] = useState<Dictamen>(null);
  const [reg, setReg] = useState<Dictamen>(null);
  const [folio, setFolio] = useState<string>("");
  const [decision, setDecision] = useState<string>("");
  const [predJur, setPredJur] = useState<any>(null);
  const [predReg, setPredReg] = useState<any>(null);
  const [preview, setPreview] = useState<null | "juridico" | "registral">(null);
  const [editAnt, setEditAnt] = useState(false);
  const [editEst, setEditEst] = useState(false);
  const [verVincular, setVerVincular] = useState(false);
  const [override, setOverride] = useState<Partial<RefGarantia>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);

  // pestañas superiores (como UCM): general / sub-juicios / documentos / boletín
  const [modulo, setModulo] = useState<"general" | "subjuicios" | "documentos" | "boletin">("general");
  const [acuerdos, setAcuerdos] = useState<any[]>([]);
  const [cargandoAc, setCargandoAc] = useState(false);
  useEffect(() => {
    if (!garantia.expediente) { setAcuerdos([]); return; }
    setCargandoAc(true);
    fetch(`${SUPABASE_URL}/rest/v1/acuerdo_judicial?select=*&expediente=eq.${encodeURIComponent(garantia.expediente)}&order=fecha_acuerdo.desc&limit=200`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((rows: any[]) => setAcuerdos(rows || []))
      .catch(() => setAcuerdos([]))
      .finally(() => setCargandoAc(false));
  }, [garantia.expediente]);

  useEffect(() => { cargarPermisosURRJ().then((p) => setPermisos(p.acciones)); }, []);

  // veredictos de la línea de vida (área URRJ) + folio/decisión del último pre-dictamen
  const recargarEstado = () => {
    const casoRef = { id: garantia.id || "", expediente: garantia.expediente || "" } as CasoJuridico;
    obtenerRecorrido(casoRef).then((rec) => {
      const u = rec["URRJ"];
      setJur(u?.dic_juridico ?? null);
      setReg(u?.dic_registral ?? null);
    }).catch(() => {});
    const filtro = garantia.id ? `caso_id=eq.${garantia.id}` : garantia.expediente ? `expediente=eq.${encodeURIComponent(garantia.expediente)}` : "id=eq.0";
    fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=folio,posicion,version,dictamen_sugerido,dictamen_final,pasa_a_ucp,firma_elabora,firma_valida,terminado,datos,pdf_url,created_at&${filtro}&vigente=eq.true&order=created_at.desc&limit=1`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((rows: any[]) => { const pr = rows?.[0] || null; setPredJur(pr); setFolio(pr?.folio || ""); setDecision(pr?.dictamen_final || ""); })
      .catch(() => {});
    const filtroReg = garantia.expediente ? `expediente=eq.${encodeURIComponent(garantia.expediente)}` : "id=eq.0";
    fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral?select=resultado,acreditado,hay_adicional,firma_elabora,firma_valida,terminado,pdf_url,created_at&${filtroReg}&order=created_at.desc&limit=1`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((rows: any[]) => setPredReg(rows?.[0] || null))
      .catch(() => {});
  };
  useEffect(recargarEstado, [garantia.id, garantia.expediente]);

  useEffect(() => {
    const filtro = garantia.id ? `caso_id=eq.${garantia.id}` : garantia.expediente ? `expediente=eq.${encodeURIComponent(garantia.expediente)}` : "id=eq.0";
    // Solo el registro de ESTA área (URRJ). Lo que la Dirección mandó a otras áreas no se mezcla aquí.
    fetch(`${SUPABASE_URL}/rest/v1/solicitud_predictamen?select=documentos,created_at&${filtro}&area=eq.URRJ&order=created_at.desc&limit=50`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((rows: any[]) => {
        const todos: { nombre: string; url: string }[] = [];
        for (const row of rows) for (const d of (row.documentos || [])) if (d?.url) todos.push({ nombre: d.nombre || "documento", url: d.url });
        setDocs(todos);
      }).catch(() => setDocs([]));
  }, [garantia.id, garantia.expediente]);

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
      } catch { /* sin rol admin */ }
    })();
  }, []);
  const puede = (a: string) => permisos.length === 0 || permisos.includes(a);
  const puedeAdmin = ["GAD", "Super_Admin", "DGE"].includes(rolUsuario || "");

  const precargaJuridico: Precarga = {
    datos: {
      caso_id: garantia.id || "",
      expediente: garantia.expediente || "",
      juzgado: garantia.juzgado || "",
      deudor: garantia.deudor || garantia.cliente_nombre || "",
      ubicacion: garantia.direccion_garantia || "",
      numeroCredito: predJur?.datos?.numeroCredito || (garantia as any).no_credito || (garantia as any).credito || "",
      quienCede: predJur?.datos?.quienCede || (garantia as any).administradora || "",
    },
  };

  const casoLV: CasoJuridico = {
    id: garantia.id || "",
    expediente: garantia.expediente || "",
    direccion_garantia: garantia.direccion_garantia,
    juzgado: garantia.juzgado,
    cliente_nombre: garantia.cliente_nombre,
  } as CasoJuridico;

  // garantía con las ediciones locales aplicadas (para reflejarlas sin recargar)
  const g = { ...garantia, ...override };
  const guardarDatos = async (campos: Partial<RefGarantia>, cerrar: () => void) => {
    if (!garantia.id) { setErrorDatos("El caso no tiene id para guardar."); return; }
    setGuardandoDatos(true); setErrorDatos(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${garantia.id}`, {
        method: "PATCH", headers, body: JSON.stringify(campos),
      });
      if (!r.ok) throw new Error(String(r.status));
      setOverride((p) => ({ ...p, ...campos }));
      cerrar();
    } catch {
      setErrorDatos("No se pudo guardar. Revisa las columnas del caso.");
    } finally { setGuardandoDatos(false); }
  };

  const decisionCls = /pasa a ucp/i.test(decision)
    ? "bg-[color:var(--teal)]/10 text-[color:var(--teal)] border-[color:var(--teal)]/30"
    : /no pasa/i.test(decision) ? "bg-red-50 text-red-800 border-red-200"
    : /pasa/i.test(decision) ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : "bg-muted text-muted-foreground border-border";

  // Cronómetro de plazo (solo aplica a pre-dictámenes de trámite con fecha de
  // notificación): reusa TIPOS_TRAMITE y diasHabiles del motor de pre-dictaminar.
  const crono = useMemo(() => {
    const d = predJur?.datos;
    const pos = String(predJur?.posicion || "").toLowerCase();
    const esTramite = pos.includes("trámite") || pos.includes("tramite");
    if (!esTramite || !d?.fechaNotificacion) return null;
    const tipo = TIPOS_TRAMITE.find((t) => t.clave === d.tipoTramite);
    const plazo = d.plazoManual && Number(d.plazoManual) > 0 ? Number(d.plazoManual) : tipo?.plazo ?? 15;
    const hoy = new Date().toISOString().slice(0, 10);
    const transcurridos = diasHabiles(d.fechaNotificacion, hoy);
    const restantes = plazo - transcurridos;
    return { restantes, plazo, tipoNombre: tipo?.nombre || d.tipoTramite || "trámite" };
  }, [predJur]);

  // Estatus general y badge de fase (para el encabezado y la tarjeta Estatus)
  const estatusGeneral = predJur?.terminado ? "Dictamen terminado" : predJur ? "En proceso" : "Sin dictamen";
  const ambosTerminados = predJur?.terminado && predReg?.terminado;
  const fase = ambosTerminados
    ? { txt: "Dictamen terminado", cls: "bg-emerald-600 text-white" }
    : (predJur || predReg)
    ? { txt: "Pre-dictamen abierto", cls: "bg-amber-100 text-amber-800" }
    : { txt: "Sin dictamen", cls: "bg-muted text-muted-foreground" };

  // -------------------- MODO DICTAMINAR (proceso con pestañas) --------------------
  if (modo === "dictaminar") {
    return (
      <div className="space-y-4">
        <button onClick={() => { setModo("ficha"); recargarEstado(); }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a la ficha
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">Proceso de dictaminación · {garantia.expediente || "Garantía"}</h2>
          <p className="truncate text-xs text-muted-foreground">{garantia.juzgado || "—"}{garantia.cliente_nombre ? " · " + garantia.cliente_nombre : ""}</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => { setTab(v); setVista("elegir"); }}>
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="juridico"><Scale className="mr-1 h-4 w-4" /> Jurídico</TabsTrigger>
            <TabsTrigger value="registral"><Landmark className="mr-1 h-4 w-4" /> Registral (RPPC)</TabsTrigger>
            <TabsTrigger value="final"><Gavel className="mr-1 h-4 w-4" /> Dictamen legal final</TabsTrigger>
            <TabsTrigger value="documentos"><Paperclip className="mr-1 h-4 w-4" /> Documentos{docs.length ? ` (${docs.length})` : ""}</TabsTrigger>
            <TabsTrigger value="avances"><Activity className="mr-1 h-4 w-4" /> Línea de avance</TabsTrigger>
          </TabsList>

          <TabsContent value="juridico" className="mt-4">
            <DictaminadorPosicion
              casos={[]}
              vista={vista}
              onVista={setVista}
              precargar={precargaJuridico}
              onVolver={() => { setVista("elegir"); recargarEstado(); }}
              puedeElaborar={puede("elaborar")}
              puedeFirmarElabora={puede("firmar_elabora")}
              puedeValidar={puede("validar")}
              puedeAdmin={puedeAdmin}
            />
          </TabsContent>

          <TabsContent value="registral" className="mt-4">
            <DictamenRegistral
              precarga={{ acreditado: garantia.cliente_nombre || garantia.deudor || "", numeroCredito: garantia.expediente || "", direccion: garantia.direccion_garantia || "" }}
              casoId={garantia.id || ""}
              onVolver={recargarEstado}
              puedeFirmarElabora={puede("firmar_elabora")}
              puedeValidar={puede("validar")}
              puedePrecioPiso={puede("precio_piso")}
            />
          </TabsContent>

          <TabsContent value="final" className="mt-4">
            <div className="rounded-xl border border-border p-5 space-y-3">
              <p className="text-sm font-semibold">Dictamen legal final de la garantía</p>
              <div className="flex flex-wrap gap-2">
                <VeredictoBadge label="Jurídico" dic={jur} />
                <VeredictoBadge label="Registral" dic={reg} />
                {decision && <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${decisionCls}`}>Decisión: {decision}</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                {jur === "positivo" && reg === "positivo"
                  ? "Ambos dictámenes son positivos: la garantía está lista para continuar el proceso (pasa a UCP)."
                  : "Para pasar a UCP se necesita que el jurídico y el registral queden positivos. Complétalos en sus pestañas."}
              </p>
              {folio && <p className="text-xs text-muted-foreground">Folio del pre-dictamen: <b>{folio}</b>. El PDF y las firmas se generan dentro de la pestaña Jurídico.</p>}
            </div>
          </TabsContent>

          <TabsContent value="documentos" className="mt-4">
            <div className="rounded-xl border border-border p-5">
              <p className="mb-3 text-sm font-semibold">Documentos que envió la Dirección para dictaminar</p>
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay documentos para esta garantía. La Dirección los envía desde “Documentos → pre-dictamen”.</p>
              ) : (
                <div className="divide-y divide-border">
                  {docs.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 py-2.5 text-sm hover:bg-muted/40">
                      <span className="flex items-center gap-2 truncate"><Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" /> {d.nombre}</span>
                      <BotonVerDoc url={d.url} nombre={d.nombre} label="ver" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="avances" className="mt-4">
            <div className="rounded-xl border border-border p-5"><LineaVidaAreas caso={casoLV} /></div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // -------------------- MODO FICHA (overview, mismo esqueleto que expediente) --------------------
  const abrirProceso = (t: string) => { setTab(t); setModo("dictaminar"); };

  return (
    <div className="space-y-4">
      {/* Barra superior: volver + área + fase + carpeta Drive */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={onVolver} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al registro
          </button>
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: PURPLE }}>URRJ</span>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${fase.cls}`}>{fase.txt}</span>
        </div>
      </div>

      {/* Encabezado */}
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${PURPLE})` }}>
        <p className="text-xs uppercase tracking-wider text-white/60">Ficha del expediente · URRJ</p>
        <h1 className="mt-0.5 text-2xl font-bold">{garantia.expediente || garantia.direccion_garantia || "Garantía"}</h1>
        <p className="mt-1 text-sm text-white/85">
          {garantia.cliente_nombre || garantia.deudor || "—"}
          {garantia.deudor && garantia.cliente_nombre && garantia.deudor !== garantia.cliente_nombre ? <> <span className="text-white/50">vs</span> {garantia.deudor}</> : null}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {garantia.entidad && <span className="rounded-full bg-white/15 px-2.5 py-0.5">{garantia.entidad}</span>}
          {predJur?.posicion && <span className="rounded-full bg-white/15 px-2.5 py-0.5">{predJur.posicion}</span>}
        </div>
        <p className="mt-2 text-xs text-white/70">{garantia.juzgado || "Juzgado sin asignar"}</p>
      </div>

      {/* Pestañas (como UCM) */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1">
        {([
          { k: "general", t: "General", icon: LayoutGrid },
          { k: "subjuicios", t: "Sub-juicios", icon: GitBranch },
          { k: "documentos", t: "Documentos", icon: FolderOpen },
          { k: "boletin", t: "Boletín", icon: Megaphone },
        ] as const).map(({ k, t, icon: Icon }) => (
          <button key={k} onClick={() => setModulo(k)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${modulo === k ? "text-white" : "text-muted-foreground hover:bg-muted"}`}
            style={modulo === k ? { background: PURPLE } : undefined}>
            <Icon className="h-4 w-4" /> {t}
            {k === "documentos" && docs.length > 0 && (
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${modulo === k ? "bg-white/25 text-white" : "bg-[color:var(--teal)]/15 text-[color:var(--teal)]"}`}>{docs.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ===== GENERAL ===== */}
      {modulo === "general" && (
      <div className="space-y-4">
      <IndicadorRepetido casoId={garantia.id || ""} />
      {/* Línea de vida: recorrido por áreas */}
      <LineaVidaAreas caso={casoLV} />

      {/* Antecedente + Estatus */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion
          icon={<Landmark className="h-4 w-4" style={{ color: TEAL }} />}
          titulo="Antecedente de la garantía"
          accion={
            <button onClick={() => { setForm({ direccion_garantia: g.direccion_garantia || "", entidad: g.entidad || "" }); setErrorDatos(null); setEditAnt(true); }} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: TEAL }}>
              <PenLine className="h-3 w-3" /> Editar / validar
            </button>
          }
        >
          {editAnt ? (
            <div className="space-y-2">
              <Campo label="Dirección de la garantía"><input className={inp} value={form.direccion_garantia} onChange={(e) => setForm({ ...form, direccion_garantia: e.target.value })} /></Campo>
              <Campo label="Entidad"><input className={inp} value={form.entidad} onChange={(e) => setForm({ ...form, entidad: e.target.value })} /></Campo>
              <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
                <span className="text-[11px] text-muted-foreground">Cliente: <b className="text-foreground">{g.cliente_nombre || "sin vincular"}</b></span>
                <button onClick={() => setVerVincular(true)} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: TEAL }}><Scale className="h-3 w-3" /> {g.cliente_nombre ? "Cambiar" : "Vincular"} cliente</button>
              </div>
              {errorDatos && <p className="text-[11px] text-red-600">{errorDatos}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => guardarDatos({ direccion_garantia: form.direccion_garantia, entidad: form.entidad }, () => setEditAnt(false))} disabled={guardandoDatos} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: TEAL }}>{guardandoDatos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Guardar</button>
                <button onClick={() => setEditAnt(false)} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <Dato label="ID garantía" valor={g.id} />
              <Dato label="No. de crédito" valor={predJur?.datos?.numeroCredito || (g as any).no_credito || (g as any).credito} importante />
              <Dato label="Dirección de la garantía" valor={g.direccion_garantia || predJur?.datos?.ubicacion} importante />
              <Dato label="Cliente / deudor" valor={g.cliente_nombre || g.deudor || predJur?.datos?.deudor} importante />
              <Dato label="Entidad" valor={g.entidad || predJur?.datos?.estado} />
            </>
          )}
        </Seccion>

        <Seccion
          icon={<Scale className="h-4 w-4" style={{ color: TEAL }} />}
          titulo="Estatus actual"
          accion={
            <button onClick={() => { setForm({ expediente: g.expediente || "", juzgado: g.juzgado || "" }); setErrorDatos(null); setEditEst(true); }} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: TEAL }}>
              <PenLine className="h-3 w-3" /> Editar / validar
            </button>
          }
        >
          {editEst ? (
            <div className="space-y-2">
              <Campo label="No. de expediente / juicio"><input className={inp} value={form.expediente} onChange={(e) => setForm({ ...form, expediente: e.target.value })} placeholder="Ej. 1393/2017" /></Campo>
              <Campo label="No. de juzgado"><input className={inp} value={form.juzgado} onChange={(e) => setForm({ ...form, juzgado: e.target.value })} placeholder="Ej. Juzgado Primero Civil…" /></Campo>
              <p className="text-[11px] text-muted-foreground">Con el expediente y el juzgado, el Boletín ya puede jalar las actuaciones.</p>
              {errorDatos && <p className="text-[11px] text-red-600">{errorDatos}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => guardarDatos({ expediente: form.expediente, juzgado: form.juzgado }, () => setEditEst(false))} disabled={guardandoDatos} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: TEAL }}>{guardandoDatos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Guardar</button>
                <button onClick={() => setEditEst(false)} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <Dato label="Etapa actual" valor="Pre-dictamen (URRJ)" />
              <Dato label="Estatus general" valor={estatusGeneral} />
              <Dato label="No. de expediente / juicio" valor={g.expediente} />
              <Dato label="No. de juzgado" valor={g.juzgado} />
              <Dato label="Posición" valor={predJur?.posicion} />
              <Dato label="Unidad" valor="URRJ · Dictaminación" />
              <Dato label="Folio" valor={folio} />
            </>
          )}
        </Seccion>
      </div>

      {verVincular && (
        <VincularClienteModal
          caso={casoLV}
          onClose={() => setVerVincular(false)}
          onVinculado={(cl) => { setOverride((p) => ({ ...p, cliente_nombre: cl.nombre ?? undefined })); setVerVincular(false); }}
        />
      )}

      {/* Dictamen de la garantía · URRJ */}
      <Seccion
        icon={<Gavel className="h-4 w-4" style={{ color: PURPLE }} />}
        titulo="Dictamen de la garantía · URRJ"
        accion={
          <button onClick={() => abrirProceso("juridico")} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{ background: NAVY }}>
            <Gavel className="h-3.5 w-3.5" /> Abrir proceso de dictaminación
          </button>
        }
      >
        {/* Veredictos + cronómetro + folio */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <VeredictoBadge label="Jurídico" dic={jur} />
          <VeredictoBadge label="Registral" dic={reg} />
          {decision && <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${decisionCls}`}>Dictamen final: {decision}</span>}
          {crono && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${crono.restantes < 0 ? "bg-red-100 text-red-800" : crono.restantes <= 3 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
              <Clock className="h-3 w-3" />
              {crono.restantes < 0
                ? `Plazo vencido · ${crono.tipoNombre}`
                : `Quedan ${crono.restantes} de ${crono.plazo} días háb.${crono.restantes <= 3 ? " · URGENTE" : ""} · ${crono.tipoNombre}`}
            </span>
          )}
          {folio && <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">Folio {folio}</span>}
        </div>

        {/* Tarjetas por fase */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Jurídico */}
          {predJur ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800"><Scale className="h-4 w-4" /> Jurídico</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${predJur.terminado ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-800"}`}>{predJur.terminado ? "Dictamen jurídico terminado" : "Pre-dictamen abierto"}</span>
              </div>
              <p className="mt-1.5 text-xs text-emerald-800">Resultado: <b>{predJur.dictamen_sugerido || "—"}</b> · versión {predJur.version || 1}</p>
              <p className="text-xs text-emerald-800">Firmas: Elabora {predJur.firma_elabora ? "✓" : "—"} · Valida {predJur.firma_valida ? "✓" : "—"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => setPreview(preview === "juridico" ? null : "juridico")} className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-1.5 text-xs hover:bg-muted">👁 Vista previa</button>
                {predJur.pdf_url
                  ? <BotonVerDoc url={predJur.pdf_url} nombre={`Pre-dictamen jurídico ${folio || garantia.expediente || ""}.pdf`} label="Ver PDF" className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-1.5 text-xs hover:bg-muted" />
                  : <button onClick={() => abrirProceso("juridico")} className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-1.5 text-xs hover:bg-muted" title="El PDF se archiva al firmar el dictamen">PDF (en el proceso)</button>}
                <button onClick={() => abrirProceso("juridico")} className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-1.5 text-xs hover:bg-muted">Abrir en Jurídico</button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold"><Scale className="h-4 w-4" /> Jurídico</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">— sin dictamen</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Aún no se ha dictaminado el jurídico de esta garantía.</p>
              <button onClick={() => abrirProceso("juridico")} className="mt-2 inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-[color:var(--teal)] hover:bg-muted">Ir al proceso →</button>
            </div>
          )}

          {/* Registral */}
          {predReg ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800"><Landmark className="h-4 w-4" /> Registral (RPPC)</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${predReg.terminado ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-800"}`}>{predReg.terminado ? "Registral terminado" : "Registral abierto"}</span>
              </div>
              <p className="mt-1.5 text-xs text-emerald-800">Resultado: <b>{predReg.resultado || "—"}</b>{predReg.hay_adicional ? " · con gravamen adicional" : ""}</p>
              <p className="text-xs text-emerald-800">Firmas: Elabora {predReg.firma_elabora?.nombre ? "✓" : "—"} · Valida {predReg.firma_valida?.nombre ? "✓" : "—"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => setPreview(preview === "registral" ? null : "registral")} className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-1.5 text-xs hover:bg-muted">👁 Vista previa</button>
                {predReg.pdf_url
                  ? <BotonVerDoc url={predReg.pdf_url} nombre={`Dictamen registral ${garantia.expediente || ""}.pdf`} label="Ver PDF" className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-1.5 text-xs hover:bg-muted" />
                  : <button onClick={() => abrirProceso("registral")} className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-1.5 text-xs hover:bg-muted" title="El PDF se archiva al firmar el dictamen">PDF (en el proceso)</button>}
                <button onClick={() => abrirProceso("registral")} className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-1.5 text-xs hover:bg-muted">Abrir en Registral</button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold"><Landmark className="h-4 w-4" /> Registral (RPPC)</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">— sin dictamen</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Aún no se ha dictaminado el registral de esta garantía.</p>
              <button onClick={() => abrirProceso("registral")} className="mt-2 inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-[color:var(--teal)] hover:bg-muted">Ir al proceso →</button>
            </div>
          )}
        </div>

        {/* Vista previa (solo lectura) */}
        {preview === "juridico" && predJur && (
          <div className="mt-3 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            <p className="mb-1 text-sm font-medium text-foreground">👁 Vista previa · Jurídico (solo lectura)</p>
            <div>Posición: {predJur.posicion || "—"} · Exp. {garantia.expediente || "—"}</div>
            <div>Dictamen del sistema: <b>{predJur.dictamen_sugerido || "—"}</b></div>
            <div>Decisión: {predJur.dictamen_final || "—"}</div>
            <div>Elabora: {predJur.firma_elabora || "—"} · Valida: {predJur.firma_valida || "—"}</div>
          </div>
        )}
        {preview === "registral" && predReg && (
          <div className="mt-3 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            <p className="mb-1 text-sm font-medium text-foreground">👁 Vista previa · Registral (solo lectura)</p>
            <div>Acreditado: {predReg.acreditado || "—"} · Exp. {garantia.expediente || "—"}</div>
            <div>Resultado: <b>{predReg.resultado || "—"}</b>{predReg.hay_adicional ? " · con gravamen adicional" : ""}</div>
            <div>Elabora: {predReg.firma_elabora?.nombre || "—"} · Valida: {predReg.firma_valida?.nombre || "—"}</div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <ArrowRight className="h-3.5 w-3.5" style={{ color: PURPLE }} />
          Para dictaminar o cambiar la posición (Actor, Demandado, Trámites…), abre el proceso completo sin salir de la ficha.
        </div>
      </Seccion>

      </div>
      )}

      {/* ===== SUB-JUICIOS ===== */}
      {modulo === "subjuicios" && <SubJuicios casoId={garantia.id || ""} />}

      {/* ===== DOCUMENTOS (Drive + movimientos) ===== */}
      {modulo === "documentos" && (
        <div className="space-y-4">
          <CarpetaDriveVinculada
            caso={casoLV}
            area="URRJ"
            onGuardar={(campos) => guardarDatos(campos as Partial<RefGarantia>, () => {})}
          />
          <DocumentosFijos caso={casoLV} area="URRJ" />
          <DocumentosGarantia area="URRJ" caso={casoLV} />
        </div>
      )}

      {/* ===== BOLETÍN ===== */}
      {modulo === "boletin" && (
        <BoletinExpediente
          acuerdos={acuerdos}
          expediente={garantia.expediente || ""}
          sinJuzgado={!garantia.juzgado}
          cargando={cargandoAc}
        />
      )}
    </div>
  );
}
