// ============================================================
//  Dictamen Registral (RPPC)
// ------------------------------------------------------------
//  Encabezado + PROPIEDAD (tracto) + GRAVAMEN + gravamen
//  adicional (si aplica) + anotaciones + conclusión + RESULTADO
//  POSITIVO/NEGATIVO, con firmas de Elabora y Valida.
//  Guarda en Supabase, imprime y refleja el resultado en la
//  línea de vida (bolita registral de URRJ).
// ============================================================
import { useState } from "react";
import { registrarEvento } from "@/lib/cronologia-urrj";
import { ArrowLeft, ScrollText, Plus, Trash2, Save, Check, Printer } from "lucide-react";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { reflejarDictamen } from "@/lib/recorrido";

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
  precarga, onVolver, casoId, puedeFirmarElabora = true, puedeValidar = true,
}: {
  precarga?: PrecargaRegistral;
  onVolver: () => void;
  casoId?: string;
  puedeFirmarElabora?: boolean;
  puedeValidar?: boolean;
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
  const [correoPara, setCorreoPara] = useState("");
  const [correoMsg, setCorreoMsg] = useState<string | null>(null);

  const avisarRegistral = () => {
    setCorreoMsg(null);
    const asunto = `Dictamen registral URRJ ${d.resultado || "—"} — Exp. ${d.numeroCredito || "—"}`;
    const cuerpo = `Aviso interno a asesores URRJ (registral).\n\nResultado registral: ${d.resultado || "—"}\nExpediente / crédito: ${d.numeroCredito || "—"}\nAcreditado: ${d.acreditado || "—"}\nGravamen adicional: ${hayAdicional ? "Sí" : "No"}\nElabora: ${firmaElabora?.nombre || "—"}\nValida: ${firmaValida?.nombre || "—"}\n\nLo litigable lo define el jurídico; el registral no bloquea. Si quedó pendiente, se elabora después.`;
    window.location.href = `mailto:${correoPara}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    registrarEvento({ caso_id: casoId || null, expediente: d.numeroCredito || null, tipo: "correo_registral", resultado: d.resultado || null, firma_elabora: firmaElabora?.nombre || null, firma_valida: firmaValida?.nombre || null, vista_previa: `Asunto: ${asunto}\n\n${cuerpo}` });
    setCorreoMsg("Se abrió tu correo con el borrador listo. Elige los asesores y envía.");
  };

  const guardar = async () => {
    if (!d.resultado) { setGuardado("Falta elegir el RESULTADO (POSITIVO/NEGATIVO)."); return; }
    setGuardando(true); setGuardado(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/dictamen_registral`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
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
        {guardado && <span className={`text-sm ${guardado.includes("✓") ? "text-emerald-700" : "text-red-700"}`}>{guardado}</span>}
      </div>

      {guardado?.includes("✓") && (
        <div className="no-print space-y-2 rounded-lg border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3">
          <p className="text-sm font-semibold text-[color:var(--teal)]">Avisar el resultado registral a los asesores (correo interno)</p>
          <label className="block text-xs font-medium">Para (asesores — sepáralos con coma)
            <input className="mt-0.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={correoPara} onChange={(e) => setCorreoPara(e.target.value)} />
          </label>
          <p className="text-xs text-muted-foreground">Se abrirá tu correo con el borrador listo (asunto y mensaje prellenados). Tú eliges los asesores y envías.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={avisarRegistral} className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background">Abrir correo</button>
            {correoMsg && <span className="text-sm text-emerald-700">{correoMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
