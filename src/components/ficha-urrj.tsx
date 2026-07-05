// ============================================================
//  FichaURRJ · ficha 360 de una garantía — estilo UCP
//  Cabecera con veredictos + folio · pestañas:
//   Jurídico · Registral (RPPC) · Dictamen legal final · Documentos · Línea de avance
//  Reusa los motores existentes (DictaminadorPosicion + DictamenRegistral + LineaVidaAreas).
// ============================================================
import { useEffect, useState } from "react";
import { BotonVerDoc } from "@/components/visor-documento";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LineaVidaAreas } from "@/components/linea-vida-areas";
import { DictaminadorPosicion, type VistaPosicion } from "@/components/dictaminador-posicion";
import { DictamenRegistral } from "@/components/dictamen-registral";
import { cargarPermisosURRJ } from "@/lib/urrj-permisos";
import { getAuth } from "@/lib/auth";
import { obtenerRecorrido, textoDictamen, type Dictamen } from "@/lib/recorrido";
import { type Precarga } from "@/lib/predictamen-guardar";
import { ArrowLeft, Scale, Landmark, Gavel, Paperclip, Activity, ExternalLink } from "lucide-react";

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

export function FichaURRJ({ garantia, onVolver }: { garantia: RefGarantia; onVolver: () => void }) {
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
    fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=folio,posicion,version,dictamen_sugerido,dictamen_final,pasa_a_ucp,firma_elabora,firma_valida,created_at&${filtro}&vigente=eq.true&order=created_at.desc&limit=1`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((rows: any[]) => { const pr = rows?.[0] || null; setPredJur(pr); setFolio(pr?.folio || ""); setDecision(pr?.dictamen_final || ""); })
      .catch(() => {});
    const filtroReg = garantia.expediente ? `expediente=eq.${encodeURIComponent(garantia.expediente)}` : "id=eq.0";
    fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral?select=resultado,acreditado,hay_adicional,firma_elabora,firma_valida,created_at&${filtroReg}&order=created_at.desc&limit=1`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((rows: any[]) => setPredReg(rows?.[0] || null))
      .catch(() => {});
  };
  useEffect(recargarEstado, [garantia.id, garantia.expediente]);

  useEffect(() => {
    const filtro = garantia.id ? `caso_id=eq.${garantia.id}` : garantia.expediente ? `expediente=eq.${encodeURIComponent(garantia.expediente)}` : "id=eq.0";
    fetch(`${SUPABASE_URL}/rest/v1/solicitud_predictamen?select=documentos,created_at&${filtro}&order=created_at.desc&limit=50`, { headers })
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
    },
  };

  const casoLV: CasoJuridico = {
    id: garantia.id || "",
    expediente: garantia.expediente || "",
    direccion_garantia: garantia.direccion_garantia,
    juzgado: garantia.juzgado,
    cliente_nombre: garantia.cliente_nombre,
  } as CasoJuridico;

  const decisionCls = /pasa a ucp/i.test(decision)
    ? "bg-[color:var(--teal)]/10 text-[color:var(--teal)] border-[color:var(--teal)]/30"
    : /no pasa/i.test(decision) ? "bg-red-50 text-red-800 border-red-200"
    : /pasa/i.test(decision) ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : "bg-muted text-muted-foreground border-border";

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onVolver} className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Volver al registro</button>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">Ficha · {garantia.expediente || garantia.direccion_garantia || "Garantía"}</h2>
          <p className="truncate text-xs text-muted-foreground">{garantia.juzgado || "—"}{garantia.cliente_nombre ? " · " + garantia.cliente_nombre : ""}</p>
        </div>
      </div>

      {/* Veredictos + folio */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <VeredictoBadge label="Jurídico" dic={jur} />
        <VeredictoBadge label="Registral" dic={reg} />
        {decision && <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${decisionCls}`}>Dictamen final: {decision}</span>}
        {folio && <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">Folio {folio}</span>}
      </div>

      {/* Modulitos de estado de dictamen */}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Estado de los dictámenes de esta garantía</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Jurídico */}
          {predJur ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800"><Scale className="h-4 w-4" /> Jurídico</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-emerald-800">✓ tiene</span>
              </div>
              <p className="mt-1.5 text-xs text-emerald-800">Resultado: <b>{predJur.dictamen_sugerido || "—"}</b> · versión {predJur.version || 1}</p>
              <p className="text-xs text-emerald-800">Firmas: Elabora {predJur.firma_elabora ? "✓" : "—"} · Valida {predJur.firma_valida ? "✓" : "—"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => setPreview(preview === "juridico" ? null : "juridico")} className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-1.5 text-xs hover:bg-muted">👁 Vista previa</button>
                <button onClick={() => setTab("juridico")} className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-1.5 text-xs hover:bg-muted">Abrir en Jurídico</button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold"><Scale className="h-4 w-4" /> Jurídico</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">— sin dictamen</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Aún no se ha dictaminado el jurídico de esta garantía.</p>
              <button onClick={() => setTab("juridico")} className="mt-2 inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-[color:var(--teal)] hover:bg-muted">Ir al proceso →</button>
            </div>
          )}

          {/* Registral */}
          {predReg ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800"><Landmark className="h-4 w-4" /> Registral (RPPC)</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-emerald-800">✓ tiene</span>
              </div>
              <p className="mt-1.5 text-xs text-emerald-800">Resultado: <b>{predReg.resultado || "—"}</b>{predReg.hay_adicional ? " · con gravamen adicional" : ""}</p>
              <p className="text-xs text-emerald-800">Firmas: Elabora {predReg.firma_elabora?.nombre ? "✓" : "—"} · Valida {predReg.firma_valida?.nombre ? "✓" : "—"}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => setPreview(preview === "registral" ? null : "registral")} className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-1.5 text-xs hover:bg-muted">👁 Vista previa</button>
                <button onClick={() => setTab("registral")} className="inline-flex items-center gap-1 rounded-md border border-input bg-white px-3 py-1.5 text-xs hover:bg-muted">Abrir en Registral</button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold"><Landmark className="h-4 w-4" /> Registral (RPPC)</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">— sin dictamen</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Aún no se ha dictaminado el registral de esta garantía.</p>
              <button onClick={() => setTab("registral")} className="mt-2 inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-[color:var(--teal)] hover:bg-muted">Ir al proceso →</button>
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
