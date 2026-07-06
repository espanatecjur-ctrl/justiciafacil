import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ScrollText, Landmark, Scale, CheckCircle2, XCircle, Clock, PenLine, Download, Eye } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { DocumentosGarantia } from "@/components/documentos-garantia";
import { LineaVidaAreas } from "@/components/linea-vida-areas";
import { VincularClienteModal } from "@/components/vincular-cliente";

export const Route = createFileRoute("/ucp-ficha")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
  head: () => ({ meta: [{ title: "Ficha UCP — JusticiaFácil" }] }),
  component: UCPFicha,
});

const NAVY = "#0B1E3A";
const AZUL = "#0C447C"; // color de UCP

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

function UCPFicha() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [c, setC] = useState<CasoJuridico | null>(null);
  const [dict, setDict] = useState<any>(null);
  const [pred, setPred] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [editAnt, setEditAnt] = useState(false);
  const [editEst, setEditEst] = useState(false);
  const [verVincular, setVerVincular] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setCargando(false); return; }
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&id=eq.${id}&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=*&caso_id=eq.${id}&vigente=eq.true&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=posicion,folio&caso_id=eq.${id}&vigente=eq.true&order=created_at.desc&limit=1`, { headers }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([cs, ds, ps]) => { setC(cs?.[0] || null); setDict(ds?.[0] || null); setPred(ps?.[0] || null); })
      .finally(() => setCargando(false));
  }, [id]);

  // guarda los campos editados del caso (antecedente / estatus)
  const guardarDatos = async (campos: Record<string, string>, cerrar: () => void) => {
    if (!c) return;
    setGuardandoDatos(true); setErrorDatos(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${c.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(campos),
      });
      if (!r.ok) throw new Error(String(r.status));
      setC({ ...c, ...(campos as any) });
      cerrar();
    } catch {
      setErrorDatos("No se pudo guardar. Revisa las columnas del caso.");
    } finally { setGuardandoDatos(false); }
  };

  // arma y descarga el PDF del dictamen usando la función que ya existe
  const descargarPDF = async () => {
    if (!c) return;
    const { descargarDictamenFinalPDF } = await import("@/lib/dictamen-final-pdf");
    const firmasArr: { titulo: string; firma: any }[] = [];
    const fj = dict?.firmas && typeof dict.firmas === "object" ? (dict.firmas.juridico || dict.firmas.juridico_firma) : null;
    const fr = dict?.firmas && typeof dict.firmas === "object" ? (dict.firmas.registral || dict.firmas.registral_firma) : null;
    if (fj) firmasArr.push({ titulo: "Dictamen jurídico", firma: typeof fj === "string" ? { nombre: fj } : fj });
    if (fr) firmasArr.push({ titulo: "Dictamen registral (RPPC)", firma: typeof fr === "string" ? { nombre: fr } : fr });
    await descargarDictamenFinalPDF({
      expediente: c.expediente || undefined,
      juzgado: c.juzgado || undefined,
      garantia: c.direccion_garantia || (c as any).gar_id || undefined,
      cliente: c.cliente_nombre || undefined,
      entidad: c.entidad || undefined,
      veredictoJuridico: dict?.juridico?.veredicto || undefined,
      veredictoRegistral: (typeof dict?.registral?.veredicto === "string" ? dict.registral.veredicto : undefined),
      veredictoFinal: dict?.veredicto || undefined,
      firmas: firmasArr,
    });
  };

  // ver el PDF en pestaña (ojo de vista) — usa la misma función en modo "ver"
  const verDictamenPDF = async (_cual: "juridico" | "registral") => {
    if (!c) return;
    const { descargarDictamenFinalPDF } = await import("@/lib/dictamen-final-pdf");
    const firmasArr: { titulo: string; firma: any }[] = [];
    const fj = dict?.firmas && typeof dict.firmas === "object" ? (dict.firmas.juridico || dict.firmas.juridico_firma) : null;
    const fr = dict?.firmas && typeof dict.firmas === "object" ? (dict.firmas.registral || dict.firmas.registral_firma) : null;
    if (fj) firmasArr.push({ titulo: "Dictamen jurídico", firma: typeof fj === "string" ? { nombre: fj } : fj });
    if (fr) firmasArr.push({ titulo: "Dictamen registral (RPPC)", firma: typeof fr === "string" ? { nombre: fr } : fr });
    await descargarDictamenFinalPDF({
      expediente: c.expediente || undefined,
      juzgado: c.juzgado || undefined,
      garantia: c.direccion_garantia || (c as any).gar_id || undefined,
      cliente: c.cliente_nombre || undefined,
      entidad: c.entidad || undefined,
      veredictoJuridico: dict?.juridico?.veredicto || undefined,
      veredictoRegistral: (typeof dict?.registral?.veredicto === "string" ? dict.registral.veredicto : undefined),
      veredictoFinal: dict?.veredicto || undefined,
      firmas: firmasArr,
    }, "ver");
  };

  if (cargando) return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando ficha…</div>;
  if (!c) return <div className="p-8 text-sm text-muted-foreground">No se encontró el caso. <button onClick={() => navigate({ to: "/ucp" })} className="underline">Volver a UCP</button></div>;

  return (
    <div className="space-y-4">
      {/* barra superior */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate({ to: "/ucp" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Volver a UCP</button>
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: AZUL }}>UCP</span>
        <button onClick={descargarPDF} className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted" style={{ borderColor: "#C2A24C" }}>
          <Download className="h-4 w-4" style={{ color: "#C2A24C" }} /> Descargar PDF
        </button>
      </div>

      {/* encabezado */}
      <div className="rounded-xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${AZUL})` }}>
        <p className="text-xs uppercase tracking-wide text-white/60">Ficha UCP · Consolidación Patrimonial</p>
        <p className="text-2xl font-bold">{c.expediente || "Sin expediente"}</p>
        <p className="text-sm text-white/80">{c.direccion_garantia || c.cliente_nombre || "—"}</p>
        <p className="mt-1 text-xs text-white/70">{c.juzgado || "Juzgado sin asignar"}{c.entidad ? ` · ${c.entidad}` : ""}</p>
      </div>

      {/* Línea de vida: recorrido por áreas (bolitas conectadas) */}
      <LineaVidaAreas caso={c} />

      {/* Antecedente de la garantía + Estatus actual (igual que la ficha de URRJ) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion
          icon={<Landmark className="h-4 w-4" style={{ color: AZUL }} />}
          titulo="Antecedente de la garantía"
          accion={
            <button onClick={() => { setForm({ direccion_garantia: c.direccion_garantia || "", entidad: c.entidad || "", no_credito: (c as any).no_credito || "" }); setErrorDatos(null); setEditAnt(true); }} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: AZUL }}>
              <PenLine className="h-3 w-3" /> Editar / validar
            </button>
          }
        >
          {editAnt ? (
            <div className="space-y-2">
              <Campo label="Dirección de la garantía"><input className={inp} value={form.direccion_garantia} onChange={(e) => setForm({ ...form, direccion_garantia: e.target.value })} /></Campo>
              <Campo label="Entidad"><input className={inp} value={form.entidad} onChange={(e) => setForm({ ...form, entidad: e.target.value })} /></Campo>
              <Campo label="No. de crédito"><input className={inp} value={form.no_credito} onChange={(e) => setForm({ ...form, no_credito: e.target.value })} /></Campo>
              <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
                <span className="text-[11px] text-muted-foreground">Cliente: <b className="text-foreground">{c.cliente_nombre || c.cliente_codigo || "sin vincular"}</b></span>
                <button onClick={() => setVerVincular(true)} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: AZUL }}><Scale className="h-3 w-3" /> {c.cliente_id ? "Cambiar" : "Vincular"} cliente</button>
              </div>
              {errorDatos && <p className="text-[11px] text-red-600">{errorDatos}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => guardarDatos({ direccion_garantia: form.direccion_garantia, entidad: form.entidad, no_credito: form.no_credito }, () => setEditAnt(false))} disabled={guardandoDatos} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>{guardandoDatos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Guardar</button>
                <button onClick={() => setEditAnt(false)} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <Dato label="ID garantía" valor={c.id} />
              <Dato label="No. de crédito" valor={(c as any).no_credito || c.expediente} />
              <Dato label="Dirección de la garantía" valor={c.direccion_garantia} importante />
              <Dato label="Cliente / deudor" valor={c.cliente_nombre || (c as any).demandado} importante />
              <Dato label="Entidad" valor={c.entidad} />
            </>
          )}
        </Seccion>

        <Seccion
          icon={<Scale className="h-4 w-4" style={{ color: AZUL }} />}
          titulo="Estatus actual"
          accion={
            <button onClick={() => { setForm({ estatus_general: (c as any).estatus_general || "", expediente: c.expediente || "", juzgado: c.juzgado || "", folio: (c as any).folio || "" }); setErrorDatos(null); setEditEst(true); }} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: AZUL }}>
              <PenLine className="h-3 w-3" /> Editar / validar
            </button>
          }
        >
          {editEst ? (
            <div className="space-y-2">
              <Campo label="Estatus general"><input className={inp} value={form.estatus_general} onChange={(e) => setForm({ ...form, estatus_general: e.target.value })} /></Campo>
              <Campo label="No. de expediente / juicio"><input className={inp} value={form.expediente} onChange={(e) => setForm({ ...form, expediente: e.target.value })} placeholder="Ej. 1393/2017" /></Campo>
              <Campo label="No. de juzgado"><input className={inp} value={form.juzgado} onChange={(e) => setForm({ ...form, juzgado: e.target.value })} placeholder="Ej. Juzgado Primero Civil…" /></Campo>
              <Campo label="Folio"><input className={inp} value={form.folio} onChange={(e) => setForm({ ...form, folio: e.target.value })} /></Campo>
              <p className="text-[11px] text-muted-foreground">Con el expediente y el juzgado, el Boletín ya puede jalar las actuaciones.</p>
              {errorDatos && <p className="text-[11px] text-red-600">{errorDatos}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => guardarDatos({ estatus_general: form.estatus_general, expediente: form.expediente, juzgado: form.juzgado, folio: form.folio }, () => setEditEst(false))} disabled={guardandoDatos} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>{guardandoDatos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Guardar</button>
                <button onClick={() => setEditEst(false)} className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <Dato label="Etapa actual" valor="Dictamen (UCP)" />
              <Dato label="Estatus general" valor={(c as any).estatus_general || "En proceso"} />
              <Dato label="No. de expediente / juicio" valor={c.expediente} />
              <Dato label="Juzgado" valor={c.juzgado} />
              <Dato label="Posición" valor={pred?.posicion} />
              <Dato label="Unidad" valor="UCP · Consolidación" />
              <Dato label="Folio" valor={pred?.folio || (c as any).folio} />
            </>
          )}
        </Seccion>
      </div>

      {/* dictámenes divididos: jurídico + registral, cada uno con su proceso y firmas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <BloqueDictamen
          titulo="Dictamen jurídico"
          icon={<ScrollText className="h-4 w-4" style={{ color: AZUL }} />}
          veredicto={dict?.juridico?.veredicto || dict?.veredicto || null}
          firmas={dict?.firmas}
          claveFirma="juridico"
          onAbrir={() => navigate({ to: "/ucp" })}
          onVer={() => verDictamenPDF("juridico")}
          onDescargar={() => descargarPDF()}
        />
        <BloqueDictamen
          titulo="Dictamen registral (RPPC)"
          icon={<Landmark className="h-4 w-4" style={{ color: AZUL }} />}
          veredicto={typeof dict?.registral?.veredicto === "string" ? dict.registral.veredicto : (dict?.rppc ? "registrado" : null)}
          firmas={dict?.firmas}
          claveFirma="registral"
          onAbrir={() => navigate({ to: "/ucp" })}
          onVer={() => verDictamenPDF("registral")}
          onDescargar={() => descargarPDF()}
        />
      </div>

      {/* Documentos y movimientos (reusa el módulo existente: actuaciones, evidencias, tareas, docs) */}
      <DocumentosGarantia area="UCP" caso={c} />

      {verVincular && (
        <VincularClienteModal
          caso={c}
          onClose={() => setVerVincular(false)}
          onVinculado={(cl) => { setC({ ...c, cliente_nombre: cl.nombre, cliente_codigo: cl.codigo, cliente_id: cl.id }); setVerVincular(false); }}
        />
      )}
    </div>
  );
}

// Panel de datos y renglón etiqueta/valor (mismo estilo que la ficha de URRJ).
const inp = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm";
function Seccion({ icon, titulo, accion, children }: { icon: React.ReactNode; titulo: string; accion?: React.ReactNode; children: React.ReactNode }) {
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
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
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
function BloqueDictamen({ titulo, icon, veredicto, firmas, claveFirma, onAbrir, onVer, onDescargar }: {
  titulo: string; icon: React.ReactNode; veredicto: string | null;
  firmas: any; claveFirma: string; onAbrir: () => void; onVer: () => void; onDescargar: () => void;
}) {
  // color del veredicto
  const v = (veredicto || "").toLowerCase();
  const positivo = v.includes("positiv") || v.includes("proceden") || v.includes("registrad") || v.includes("favorable");
  const negativo = v.includes("negativ") || v.includes("improcedent") || v.includes("desfavorable");
  const Icono = positivo ? CheckCircle2 : negativo ? XCircle : Clock;
  const color = positivo ? "#0C5C46" : negativo ? "#A32D2D" : "#B26B00";

  // ¿hay firma para este dictamen?
  const firma = firmas && typeof firmas === "object" ? (firmas[claveFirma] || firmas[`${claveFirma}_firma`]) : null;
  const firmado = !!firma;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: NAVY }}>{icon} {titulo}</p>
        <button onClick={onAbrir} className="rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-muted" style={{ color: AZUL }}>Abrir proceso</button>
      </div>

      {/* veredicto */}
      <div className="mt-3 flex items-center gap-2">
        <Icono className="h-5 w-5" style={{ color }} />
        <span className="text-sm font-medium" style={{ color }}>{veredicto ? veredicto : "Sin dictaminar"}</span>
      </div>

      {/* firma */}
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-xs">
        <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
        {firmado
          ? <span className="text-[color:var(--teal)]">Firmado{typeof firma === "string" ? `: ${firma}` : (firma?.nombre ? `: ${firma.nombre}` : "")}</span>
          : <span className="text-muted-foreground">Sin firma</span>}
      </div>

      {/* PDF: ver (ojo) + descargar */}
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2">
        <button onClick={onVer} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] hover:bg-muted"><Eye className="h-3.5 w-3.5" /> Ver PDF</button>
        <button onClick={onDescargar} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] hover:bg-muted" style={{ borderColor: "#C2A24C", color: "#8a7326" }}><Download className="h-3.5 w-3.5" /> Descargar</button>
      </div>
    </div>
  );
}
