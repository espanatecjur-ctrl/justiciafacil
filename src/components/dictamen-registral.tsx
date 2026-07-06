// ============================================================
//  Dictamen Registral (RPPC)
// ------------------------------------------------------------
//  Encabezado + PROPIEDAD (tracto) + GRAVAMEN + gravamen
//  adicional (si aplica) + anotaciones + conclusión + RESULTADO
//  POSITIVO/NEGATIVO, con firmas de Elabora y Valida.
//  Guarda en Supabase, imprime y refleja el resultado en la
//  línea de vida (bolita registral de URRJ).
// ============================================================
import { useEffect, useState } from "react";
import { registrarEvento } from "@/lib/cronologia-urrj";
import { BannerCorreo } from "@/components/banner-correo";
import { BloquePrecioURRJ, PRECIO_VACIO, resumenPrecio, type PrecioURRJ } from "@/components/bloque-precio-urrj";
import { ArrowLeft, ScrollText, Plus, Trash2, Save, Check, Printer, Mail, ShieldAlert, ShieldCheck, MinusCircle } from "lucide-react";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { reflejarDictamen } from "@/lib/recorrido";
import type { DatosPDF } from "@/lib/predictamen-pdf";

const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function SiNo({ v, on }: { v: string; on: (x: string) => void }) {
  return (
    <div className="flex gap-2">
      {["si", "no"].map((o) => (
        <button key={o} type="button" onClick={() => on(o)}
          className={`flex-1 rounded-md border px-3 py-2 text-sm capitalize ${v === o ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium text-[color:var(--teal)]" : "border-input hover:bg-muted"}`}>
          {o === "si" ? "Sí" : "No"}
        </button>
      ))}
    </div>
  );
}
function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-[color:var(--teal)]">{titulo}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

export interface PrecargaRegistral {
  acreditado?: string;
  numeroCredito?: string;
  direccion?: string;
}

const VACIO = {
  fechaVerificacion: "", numeroCredito: "", acreditado: "", abogadoSeguimiento: "", distritoRegistral: "",
  p_direccion: "", p_fechaInscripcion: "", p_noEscritura: "", p_fechaEscritura: "", p_acto: "",
  p_titularRegistral: "", p_enajenante: "", p_notario: "", p_montoOperacion: "", p_superficie: "", p_liberacion: "",
  g_direccion: "", g_fechaInscripcion: "", g_noEscritura: "", g_fechaEscritura: "", g_acto: "",
  g_acreedor: "", g_deudor: "", g_notario: "", g_montoOperacion: "", g_equivalente: "",
  ga_direccion: "", ga_fechaInscripcion: "", ga_noEscritura: "", ga_fechaEscritura: "", ga_acto: "",
  ga_acreedor: "", ga_deudor: "", ga_notario: "", ga_montoOperacion: "", ga_equivalente: "",
  anotaciones: "", conclusion: "", resultado: "",
};

export function DictamenRegistral({
  precarga, onVolver, casoId, puedeFirmarElabora = true, puedeValidar = true, puedePrecioPiso = false,
}: {
  precarga?: PrecargaRegistral;
  onVolver: () => void;
  casoId?: string;
  puedeFirmarElabora?: boolean;
  puedeValidar?: boolean;
  puedePrecioPiso?: boolean;
}) {
  const [d, setD] = useState({
    ...VACIO,
    acreditado: precarga?.acreditado || "",
    numeroCredito: precarga?.numeroCredito || "",
    p_direccion: precarga?.direccion || "",
    g_direccion: precarga?.direccion || "",
  });
  const [hayAdicional, setHayAdicional] = useState(false);
  const [firmaElabora, setFirmaElabora] = useState<DatosFirma | null>(null);
  const [firmaValida, setFirmaValida] = useState<DatosFirma | null>(null);
  const set = (k: keyof typeof VACIO, v: string) => setD((p) => ({ ...p, [k]: v }));

  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState<string | null>(null);
  const [verBanner, setVerBanner] = useState(false);
  const [destino, setDestino] = useState<"contabilidad" | "comercial">("contabilidad");
  const [precio, setPrecio] = useState<PrecioURRJ>(PRECIO_VACIO);
  const [seed, setSeed] = useState(0);
  const abrirBanner = () => { setSeed((x) => x + 1); setVerBanner(true); };

  // ---- Cotejo con el pre-dictamen JURÍDICO (RPPC vs jurídico) ----
  const [juridico, setJuridico] = useState<{ datos: any; resultados: any; dictamen_final: string | null; folio: string | null } | null>(null);
  useEffect(() => {
    const conds: string[] = [];
    if (casoId) conds.push(`caso_id.eq.${casoId}`);
    if (d.numeroCredito && d.numeroCredito.trim()) conds.push(`expediente.eq.${encodeURIComponent(d.numeroCredito.trim())}`);
    if (conds.length === 0) { setJuridico(null); return; }
    const filtro = conds.length === 1 ? conds[0].replace(".eq.", "=eq.") : `or=(${conds.join(",")})`;
    fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=datos,resultados,dictamen_final,folio&vigente=eq.true&en_papelera=eq.false&${filtro}&limit=1`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
      .then((r) => (r.ok ? r.json() : [])).then((j) => setJuridico(j?.[0] || null)).catch(() => setJuridico(null));
  }, [casoId, d.numeroCredito]);

  const norm = (s?: string) => (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
  const coincideNombre = (a?: string, b?: string) => {
    const x = norm(a), y = norm(b);
    if (!x || !y) return "sindato";
    return x === y || x.includes(y) || y.includes(x) ? "ok" : "anomalia";
  };
  const jd = juridico?.datos || {};
  const hayGravamenReg = !!(d.g_acreedor || d.g_fechaInscripcion || d.g_noEscritura);
  const cotejos = [
    { campo: "Titular / propietario", jur: jd.propietario || "—", reg: d.p_titularRegistral || "—", estado: coincideNombre(jd.propietario, d.p_titularRegistral) },
    { campo: "Deudor", jur: jd.deudor || "—", reg: d.g_deudor || "—", estado: coincideNombre(jd.deudor, d.g_deudor) },
    {
      campo: "Hipoteca inscrita",
      jur: jd.hipotecaInscrita === "si" ? "Sí" : jd.hipotecaInscrita === "no" ? "No" : "—",
      reg: hayGravamenReg ? "Sí (hay gravamen)" : "No (sin gravamen)",
      estado: (!jd.hipotecaInscrita) ? "sindato" : ((jd.hipotecaInscrita === "si") === hayGravamenReg ? "ok" : "anomalia"),
    },
    {
      campo: "Resultado (jurídico vs registral)",
      jur: juridico?.dictamen_final || "—",
      reg: d.resultado || "—",
      estado: (!juridico?.dictamen_final || !d.resultado) ? "sindato"
        : (/no pasa|negativ/i.test(juridico.dictamen_final) === (d.resultado === "NEGATIVO") ? "ok" : "anomalia"),
    },
  ];
  const nAnomalias = cotejos.filter((c) => c.estado === "anomalia").length;

  const construirDatosPDF = (): DatosPDF => {
    const jrDatos = juridico?.datos || {};
    const jr = juridico?.resultados || {};
    const riesgos = [
      { nombre: "Prescripción", r: jr.prescripcion },
      { nombre: "Caducidad", r: jr.caducidad },
      ...(jr.usucapion ? [{ nombre: "Usucapión", r: jr.usucapion }] : []),
    ].filter((x) => x.r);
    const fin = jr.financiero || { ordinarios: 0, moratorios: 0, iva: 0, totalDeuda: 0, udis: 0, alertaUsura: false };
    return {
      expediente: jrDatos.expediente || d.numeroCredito || "", juzgado: jrDatos.juzgado || "", estado: jrDatos.estado || "",
      tipoJuicio: jrDatos.tipoJuicio || "", posicion: jrDatos.posicion || "Actor",
      ubicacion: jrDatos.ubicacion || "", deudor: jrDatos.deudor || "", quienCede: jrDatos.quienCede || "", queCede: jrDatos.queCede || "",
      dictamen: juridico?.dictamen_final || "—", riesgos: riesgos as any,
      intereses: { ordinarios: fin.ordinarios || 0, moratorios: fin.moratorios || 0, iva: fin.iva || 0, total: fin.totalDeuda || 0, udis: fin.udis, usura: !!fin.alertaUsura },
      admin: null, anotaciones: jrDatos.anotacionesHumanas || "",
      firmaElabora: jr.firmas?.elabora || null, firmaValida: jr.firmas?.valida || null,
      decision: juridico?.dictamen_final || "—",
      datos: jrDatos,
      registral: {
        resultado: d.resultado, titular: d.p_titularRegistral, deudor: d.g_deudor, gravamenAcreedor: d.g_acreedor,
        hayAdicional, conclusion: d.conclusion, anotaciones: d.anotaciones,
        firmaElabora, firmaValida,
      },
      cotejos,
    };
  };

  const descargarPDFCompleto = async () => {
    const { descargarPredictamenPDF } = await import("@/lib/predictamen-pdf");
    await descargarPredictamenPDF(construirDatosPDF());
  };

  const asuntoBanner = `Estado registral — Exp. ${d.numeroCredito || "—"} · ${d.resultado || "—"}`;
  const mensajeBanner = [
    "Se informa el estado registral de la garantía (dictamen registral URRJ).",
    "",
    `Resultado registral: ${d.resultado || "—"}`,
    `Expediente / crédito: ${d.numeroCredito || "—"}`,
    `Acreditado: ${d.acreditado || "—"}`,
    `Titular registral: ${d.p_titularRegistral || "—"}`,
    `Gravamen (acreedor): ${d.g_acreedor || "—"}`,
    `Gravamen adicional: ${hayAdicional ? "Sí" : "No"}`,
    `Conclusión: ${d.conclusion || "—"}`,
  ].join("\n");

  const guardar = async () => {
    if (!d.resultado) { setGuardado("Falta elegir el RESULTADO (POSITIVO/NEGATIVO)."); return; }
    setGuardando(true); setGuardado(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          expediente: d.numeroCredito || null,
          acreditado: d.acreditado || null,
          resultado: d.resultado,
          hay_adicional: hayAdicional,
          datos: d,
          firma_elabora: firmaElabora,
          firma_valida: firmaValida,
        }),
      });
      if (res.ok) {
        setGuardado("Dictamen registral guardado ✓");
        registrarEvento({ caso_id: casoId || null, expediente: d.numeroCredito || null, tipo: "dictamen_registral", resultado: d.resultado, firma_elabora: firmaElabora?.nombre || null, firma_valida: firmaValida?.nombre || null, detalle: hayAdicional ? "Con gravamen adicional" : "Sin gravamen adicional" });
        if (casoId) {
          try {
            await reflejarDictamen({ id: casoId, expediente: d.numeroCredito } as any, "URRJ", "registral", d.resultado === "POSITIVO" ? "positivo" : "negativo", firmaValida?.nombre || firmaElabora?.nombre || null);
          } catch { /* la linea de vida no debe romper el guardado */ }
        }
        // Archivar el PDF registral (Camino 1): sube el PDF y guarda su URL en pdf_url.
        try {
          const rows = await res.json().catch(() => [] as any);
          const nuevoId = rows?.[0]?.id;
          if (nuevoId) {
            const { descargarPredictamenPDF } = await import("@/lib/predictamen-pdf");
            const url = await descargarPredictamenPDF(construirDatosPDF(), "archivar");
            if (typeof url === "string") {
              await fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral?id=eq.${nuevoId}`, {
                method: "PATCH",
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ pdf_url: url }),
              });
            }
          }
        } catch { /* el PDF se puede archivar luego */ }
      }
      else setGuardado("No se pudo guardar (¿corriste el SQL de dictamen_registral?).");
    } catch (e: any) {
      setGuardado("Error: " + (e?.message || ""));
    } finally { setGuardando(false); }
  };

  return (
    <div id="dr-impreso" className="space-y-4">
      <style>{`@media print { body * { visibility: hidden; } #dr-impreso, #dr-impreso * { visibility: visible; } #dr-impreso { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; } .no-print { display: none !important; } }`}</style>
      <div className="flex items-center gap-2 no-print">
        <button onClick={onVolver} className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Volver</button>
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-[color:var(--teal)]" />
          <h2 className="font-display text-lg font-bold">Dictamen Registral (RPPC)</h2>
        </div>
      </div>
      <div className="hidden text-center print:block">
        <p className="text-base font-bold">DESARROLLOS INTELIGENTES DE INMUEBLES Y PROPIEDADES ACCESIBLES, S.A. DE C.V.</p>
        <p className="font-display text-lg font-bold">DICTAMEN REGISTRAL (RPPC)</p>
      </div>

      <Bloque titulo="Verificación registral">
        <Campo label="Fecha de verificación"><input type="date" className={inp} value={d.fechaVerificacion} onChange={(e) => set("fechaVerificacion", e.target.value)} /></Campo>
        <Campo label="Número de crédito"><input className={inp} value={d.numeroCredito} onChange={(e) => set("numeroCredito", e.target.value)} /></Campo>
        <Campo label="Acreditado"><input className={inp} value={d.acreditado} onChange={(e) => set("acreditado", e.target.value)} /></Campo>
        <Campo label="Abogado de seguimiento"><input className={inp} value={d.abogadoSeguimiento} onChange={(e) => set("abogadoSeguimiento", e.target.value)} /></Campo>
        <Campo label="Distrito registral"><input className={inp} value={d.distritoRegistral} onChange={(e) => set("distritoRegistral", e.target.value)} /></Campo>
      </Bloque>

      <Bloque titulo="Propiedad (tracto)">
        <Campo label="Dirección"><input className={inp} value={d.p_direccion} onChange={(e) => set("p_direccion", e.target.value)} /></Campo>
        <Campo label="Acto"><input className={inp} value={d.p_acto} onChange={(e) => set("p_acto", e.target.value)} placeholder="Compraventa…" /></Campo>
        <Campo label="Fecha de inscripción"><input type="date" className={inp} value={d.p_fechaInscripcion} onChange={(e) => set("p_fechaInscripcion", e.target.value)} /></Campo>
        <Campo label="No. de escritura"><input className={inp} value={d.p_noEscritura} onChange={(e) => set("p_noEscritura", e.target.value)} /></Campo>
        <Campo label="Fecha de escritura"><input type="date" className={inp} value={d.p_fechaEscritura} onChange={(e) => set("p_fechaEscritura", e.target.value)} /></Campo>
        <Campo label="Notario"><input className={inp} value={d.p_notario} onChange={(e) => set("p_notario", e.target.value)} /></Campo>
        <Campo label="Titular registral"><input className={inp} value={d.p_titularRegistral} onChange={(e) => set("p_titularRegistral", e.target.value)} /></Campo>
        <Campo label="Enajenante"><input className={inp} value={d.p_enajenante} onChange={(e) => set("p_enajenante", e.target.value)} /></Campo>
        <Campo label="Monto de operación"><input type="number" className={inp} value={d.p_montoOperacion} onChange={(e) => set("p_montoOperacion", e.target.value)} /></Campo>
        <Campo label="Superficie"><input className={inp} value={d.p_superficie} onChange={(e) => set("p_superficie", e.target.value)} /></Campo>
        <Campo label="¿Existe liberación de gravamen?"><SiNo v={d.p_liberacion} on={(x) => set("p_liberacion", x)} /></Campo>
      </Bloque>

      <Bloque titulo="Gravamen (hipoteca)">
        <Campo label="Dirección"><input className={inp} value={d.g_direccion} onChange={(e) => set("g_direccion", e.target.value)} /></Campo>
        <Campo label="Acto"><input className={inp} value={d.g_acto} onChange={(e) => set("g_acto", e.target.value)} placeholder="Hipoteca…" /></Campo>
        <Campo label="Fecha de inscripción"><input type="date" className={inp} value={d.g_fechaInscripcion} onChange={(e) => set("g_fechaInscripcion", e.target.value)} /></Campo>
        <Campo label="No. de escritura"><input className={inp} value={d.g_noEscritura} onChange={(e) => set("g_noEscritura", e.target.value)} /></Campo>
        <Campo label="Fecha de escritura"><input type="date" className={inp} value={d.g_fechaEscritura} onChange={(e) => set("g_fechaEscritura", e.target.value)} /></Campo>
        <Campo label="Notario"><input className={inp} value={d.g_notario} onChange={(e) => set("g_notario", e.target.value)} /></Campo>
        <Campo label="Acreedor"><input className={inp} value={d.g_acreedor} onChange={(e) => set("g_acreedor", e.target.value)} /></Campo>
        <Campo label="Deudor"><input className={inp} value={d.g_deudor} onChange={(e) => set("g_deudor", e.target.value)} /></Campo>
        <Campo label="Monto de operación"><input type="number" className={inp} value={d.g_montoOperacion} onChange={(e) => set("g_montoOperacion", e.target.value)} /></Campo>
        <Campo label="Equivalente"><input className={inp} value={d.g_equivalente} onChange={(e) => set("g_equivalente", e.target.value)} /></Campo>
      </Bloque>

      {!hayAdicional ? (
        <button onClick={() => setHayAdicional(true)} className="no-print inline-flex items-center gap-1.5 rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
          <Plus className="h-4 w-4" /> Agregar gravamen adicional (solo si aplica)
        </button>
      ) : (
        <div>
          <div className="mb-2 flex justify-end">
            <button onClick={() => setHayAdicional(false)} className="inline-flex items-center gap-1 text-xs font-medium text-red-700"><Trash2 className="h-3.5 w-3.5" /> Quitar gravamen adicional</button>
          </div>
          <Bloque titulo="Gravamen adicional">
            <Campo label="Dirección"><input className={inp} value={d.ga_direccion} onChange={(e) => set("ga_direccion", e.target.value)} /></Campo>
            <Campo label="Acto"><input className={inp} value={d.ga_acto} onChange={(e) => set("ga_acto", e.target.value)} /></Campo>
            <Campo label="Fecha de inscripción"><input type="date" className={inp} value={d.ga_fechaInscripcion} onChange={(e) => set("ga_fechaInscripcion", e.target.value)} /></Campo>
            <Campo label="No. de escritura"><input className={inp} value={d.ga_noEscritura} onChange={(e) => set("ga_noEscritura", e.target.value)} /></Campo>
            <Campo label="Fecha de escritura"><input type="date" className={inp} value={d.ga_fechaEscritura} onChange={(e) => set("ga_fechaEscritura", e.target.value)} /></Campo>
            <Campo label="Notario"><input className={inp} value={d.ga_notario} onChange={(e) => set("ga_notario", e.target.value)} /></Campo>
            <Campo label="Acreedor"><input className={inp} value={d.ga_acreedor} onChange={(e) => set("ga_acreedor", e.target.value)} /></Campo>
            <Campo label="Deudor"><input className={inp} value={d.ga_deudor} onChange={(e) => set("ga_deudor", e.target.value)} /></Campo>
            <Campo label="Monto de operación"><input type="number" className={inp} value={d.ga_montoOperacion} onChange={(e) => set("ga_montoOperacion", e.target.value)} /></Campo>
            <Campo label="Equivalente"><input className={inp} value={d.ga_equivalente} onChange={(e) => set("ga_equivalente", e.target.value)} /></Campo>
          </Bloque>
        </div>
      )}

      <div className="rounded-lg border border-border p-4 space-y-3">
        <Campo label="Anotaciones adicionales"><textarea rows={2} className={inp} value={d.anotaciones} onChange={(e) => set("anotaciones", e.target.value)} /></Campo>
        <Campo label="Conclusión"><textarea rows={3} className={inp} value={d.conclusion} onChange={(e) => set("conclusion", e.target.value)} /></Campo>
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Cotejo con el pre-dictamen jurídico (RPPC vs jurídico)</p>
          {nAnomalias > 0
            ? <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700"><ShieldAlert className="h-3.5 w-3.5" /> {nAnomalias} anomalía(s)</span>
            : juridico
              ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Sin anomalías</span>
              : <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">Sin pre-dictamen jurídico vinculado</span>}
        </div>
        {!juridico ? (
          <p className="text-[12px] text-muted-foreground">No se encontró un pre-dictamen jurídico para este expediente/caso. Escribe el número de crédito arriba o dictamina primero el jurídico.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cotejos.map((c) => {
              const st = c.estado === "anomalia"
                ? { cls: "border-red-300 bg-red-50", icon: <ShieldAlert className="h-4 w-4 text-red-600" />, txt: "Anomalía", tcls: "text-red-700" }
                : c.estado === "ok"
                  ? { cls: "border-emerald-200 bg-emerald-50", icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />, txt: "Coincide", tcls: "text-emerald-700" }
                  : { cls: "border-border bg-muted/20", icon: <MinusCircle className="h-4 w-4 text-muted-foreground" />, txt: "Sin dato", tcls: "text-muted-foreground" };
              return (
                <div key={c.campo} className={`rounded-lg border p-3 ${st.cls}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[12px] font-semibold">{c.campo}</p>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${st.tcls}`}>{st.icon} {st.txt}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Jurídico: <b className="text-foreground">{c.jur}</b></p>
                  <p className="text-[11px] text-muted-foreground">Registral: <b className="text-foreground">{c.reg}</b></p>
                </div>
              );
            })}
          </div>
        )}
        {nAnomalias > 0 && <p className="mt-2 text-[11px] font-medium text-red-700">⚠ Hay diferencias entre lo registral y lo jurídico. Revísalas antes de firmar el dictamen registral.</p>}
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="mb-2 text-sm font-medium">Resultado del dictamen registral</p>
        <div className="flex flex-wrap gap-2">
          {[
            { v: "POSITIVO", cls: "bg-emerald-600" },
            { v: "NEGATIVO", cls: "bg-red-600" },
          ].map((o) => (
            <button key={o.v} type="button" onClick={() => set("resultado", o.v)}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${d.resultado === o.v ? `${o.cls} text-white` : "border border-input hover:bg-muted"}`}>
              {o.v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FirmaParte titulo="Elabora · abogado URRJ" valor={firmaElabora} onFirmar={(f) => setFirmaElabora(f.fecha ? f : null)} cargoSugerido="Abogado URRJ" bloqueado={!puedeFirmarElabora} />
        <FirmaParte titulo="Valida · Director Legal" valor={firmaValida} onFirmar={(f) => setFirmaValida(f.fecha ? f : null)} cargoSugerido="Director Legal (DIL)" bloqueado={!puedeValidar} />
      </div>

      <div className="no-print flex flex-wrap items-center gap-2">
        <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
          {guardado?.includes("✓") ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} {guardando ? "Guardando…" : "Guardar dictamen registral"}
        </button>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-semibold hover:bg-muted">
          <Printer className="h-4 w-4" /> Imprimir
        </button>
        {juridico && (
          <button onClick={descargarPDFCompleto} className="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-semibold hover:bg-muted" style={{ borderColor: "#C2A24C" }}>
            <ScrollText className="h-4 w-4" style={{ color: "#C2A24C" }} /> Descargar PDF final completo (jurídico + registral)
          </button>
        )}
        {guardado && <span className={`text-sm ${guardado.includes("✓") ? "text-emerald-700" : "text-red-700"}`}>{guardado}</span>}
      </div>

      {guardado?.includes("✓") && (
        <button onClick={abrirBanner} className="no-print inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--teal)" }}>
          <Mail className="h-4 w-4" /> Informar estado registral / enviar
        </button>
      )}

      {verBanner && (
        <BannerCorreo
          key={seed}
          titulo="Informar estado registral (URRJ)"
          asuntoInicial={asuntoBanner}
          mensajeInicial={mensajeBanner}
          folio={d.numeroCredito}
          extra={
            <p className="text-[11px] text-muted-foreground">Este correo <b>informa el estado registral</b> (no pide precio). Escribe arriba a quién se envía (Jurídico / UCP / quien lo solicitó).</p>
          }
          onCerrar={() => setVerBanner(false)}
          onEnviado={() => registrarEvento({ caso_id: casoId || null, expediente: d.numeroCredito || null, tipo: "correo_registral", resultado: d.resultado || null, firma_elabora: firmaElabora?.nombre || null, firma_valida: firmaValida?.nombre || null, vista_previa: `Estado registral · Asunto: ${asuntoBanner}\n\n${mensajeBanner}`, detalle: "Informado estado registral" })}
        />
      )}
    </div>
  );
}
