// ============================================================
//  Dictamen Registral (RPPC) — Fase 1: formulario
// ------------------------------------------------------------
//  Reproduce el formato "DATOS NECESARIOS PARA RPPC" de la DGE:
//  encabezado + PROPIEDAD (tracto) + GRAVAMEN + gravamen
//  adicional (si aplica) + anotaciones + conclusión + RESULTADO
//  POSITIVO/NEGATIVO, con firmas de Elabora y Valida.
//  (Guardar en Supabase + PDF llegan en la Fase 2.)
// ============================================================
import { useState } from "react";
import { ArrowLeft, ScrollText, Plus, Trash2 } from "lucide-react";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";

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
  // encabezado
  fechaVerificacion: "", numeroCredito: "", acreditado: "", abogadoSeguimiento: "", distritoRegistral: "",
  // propiedad
  p_direccion: "", p_fechaInscripcion: "", p_noEscritura: "", p_fechaEscritura: "", p_acto: "",
  p_titularRegistral: "", p_enajenante: "", p_notario: "", p_montoOperacion: "", p_superficie: "", p_liberacion: "",
  // gravamen
  g_direccion: "", g_fechaInscripcion: "", g_noEscritura: "", g_fechaEscritura: "", g_acto: "",
  g_acreedor: "", g_deudor: "", g_notario: "", g_montoOperacion: "", g_equivalente: "",
  // gravamen adicional
  ga_direccion: "", ga_fechaInscripcion: "", ga_noEscritura: "", ga_fechaEscritura: "", ga_acto: "",
  ga_acreedor: "", ga_deudor: "", ga_notario: "", ga_montoOperacion: "", ga_equivalente: "",
  // cierre
  anotaciones: "", conclusion: "", resultado: "",
};

export function DictamenRegistral({
  precarga, onVolver, puedeFirmarElabora = true, puedeValidar = true,
}: {
  precarga?: PrecargaRegistral;
  onVolver: () => void;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onVolver} className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Volver</button>
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-[color:var(--teal)]" />
          <h2 className="font-display text-lg font-bold">Dictamen Registral (RPPC)</h2>
        </div>
      </div>

      {/* Encabezado */}
      <Bloque titulo="Verificación registral">
        <Campo label="Fecha de verificación"><input type="date" className={inp} value={d.fechaVerificacion} onChange={(e) => set("fechaVerificacion", e.target.value)} /></Campo>
        <Campo label="Número de crédito"><input className={inp} value={d.numeroCredito} onChange={(e) => set("numeroCredito", e.target.value)} /></Campo>
        <Campo label="Acreditado"><input className={inp} value={d.acreditado} onChange={(e) => set("acreditado", e.target.value)} /></Campo>
        <Campo label="Abogado de seguimiento"><input className={inp} value={d.abogadoSeguimiento} onChange={(e) => set("abogadoSeguimiento", e.target.value)} /></Campo>
        <Campo label="Distrito registral"><input className={inp} value={d.distritoRegistral} onChange={(e) => set("distritoRegistral", e.target.value)} /></Campo>
      </Bloque>

      {/* Propiedad */}
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

      {/* Gravamen */}
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

      {/* Gravamen adicional (solo si aplica) */}
      {!hayAdicional ? (
        <button onClick={() => setHayAdicional(true)} className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
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

      {/* Anotaciones y conclusión */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <Campo label="Anotaciones adicionales"><textarea rows={2} className={inp} value={d.anotaciones} onChange={(e) => set("anotaciones", e.target.value)} /></Campo>
        <Campo label="Conclusión"><textarea rows={3} className={inp} value={d.conclusion} onChange={(e) => set("conclusion", e.target.value)} /></Campo>
      </div>

      {/* Resultado */}
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

      {/* Firmas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FirmaParte titulo="Elabora · abogado URRJ" valor={firmaElabora} onFirmar={(f) => setFirmaElabora(f.fecha ? f : null)} cargoSugerido="Abogado URRJ" bloqueado={!puedeFirmarElabora} />
        <FirmaParte titulo="Valida · Director Legal" valor={firmaValida} onFirmar={(f) => setFirmaValida(f.fecha ? f : null)} cargoSugerido="Director Legal (DIL)" bloqueado={!puedeValidar} />
      </div>

      <p className="text-[11px] text-muted-foreground">Fase 1: captura y resultado. Guardar en el expediente y el PDF del dictamen registral llegan en la Fase 2.</p>
    </div>
  );
}
