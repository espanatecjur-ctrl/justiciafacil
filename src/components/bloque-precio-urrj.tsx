// ============================================================
// BloquePrecioURRJ · datos de Administración/valuación + precio
// piso, para mostrar ARRIBA del BannerCorreo (prop `extra`).
// Los 4 campos "reflejo" son editables (Contabilidad los llena
// mientras tanto); el precio piso lo coloca la Directora.
//
// AMPLIACIÓN (adeudos, gastos jurídicos, remodelación, honorarios
// por etapa, descuento): arma el precio final que antes solo vivía
// en el sistema legacy (SIGA). Fórmula:
//   subtotal = precioPiso + Σadeudos + Σgastos jurídicos + remodelación
//   precioFinal = subtotal × (1 + honorariosPct/100) × (1 − descuentoPct/100)
// El 45% de utilidad esperada es SOLO INFORMATIVO — no se fuerza el
// precio para alcanzarlo.
// ============================================================
import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

export interface ItemMonto { id: string; concepto: string; monto: string }

/** % de honorarios sugerido según en qué etapa procesal va el juicio.
 *  Es solo SUGERENCIA — el usuario lo puede editar a mano. */
export const CP_HONORARIOS_ETAPA: { etapa: string; pct: number }[] = [
  { etapa: "Sin demanda", pct: 60 },
  { etapa: "Extrajudicial", pct: 60 },
  { etapa: "Demanda", pct: 50 },
  { etapa: "Emplazamiento", pct: 40 },
  { etapa: "Contestación", pct: 40 },
  { etapa: "Pruebas", pct: 30 },
  { etapa: "Sentencia", pct: 20 },
  { etapa: "Sentencia Primera", pct: 20 },
  { etapa: "Sentencia 1ra", pct: 20 },
  { etapa: "Apelación", pct: 18 },
  { etapa: "Remate", pct: 18 },
  { etapa: "Adjudicación", pct: 18 },
];

/** Tramos de remodelación automática por m² de construcción — igual
 *  que la fórmula del Excel SIGA (Calculadora Precio, celda B33):
 *    45–60 m²   → $60,000
 *    61–120 m²  → $85,000
 *    121–200 m² → $130,000
 *    fuera de ese rango (menos de 45 o más de 200) → se cotiza a mano. */
export function remodelacionSugerida(m2: number): number {
  if (m2 >= 45 && m2 <= 60) return 60000;
  if (m2 >= 61 && m2 <= 120) return 85000;
  if (m2 >= 121 && m2 <= 200) return 130000;
  return 0;
}

export interface PrecioURRJ {
  // ---- reflejo (ya existían) ----
  valorComercial: string;
  costos: string;
  precioCesion: string;
  margen: string;
  precioPiso: string;
  // ---- nuevo: adeudos y gastos jurídicos (listas dinámicas) ----
  adeudos: ItemMonto[];
  gastosJuridicos: ItemMonto[];
  // ---- nuevo: remodelación ----
  incluirRemodelacion: boolean;
  m2Construccion: string;
  remodelacionManual: string; // se usa si m2Construccion > 200
  // ---- nuevo: honorarios ----
  etapaHonorarios: string;    // una de CP_HONORARIOS_ETAPA[].etapa, o "" (sin sugerencia)
  honorariosPct: string;      // editable — se autollena al elegir etapa, pero el usuario lo puede cambiar
  // ---- nuevo: descuento ----
  descuentoPct: string;
  descuentoMotivo: string;
}

let contador = 0;
const nuevoId = () => `it_${Date.now()}_${contador++}`;

export const PRECIO_VACIO: PrecioURRJ = {
  valorComercial: "", costos: "", precioCesion: "", margen: "", precioPiso: "",
  adeudos: [], gastosJuridicos: [],
  incluirRemodelacion: false, m2Construccion: "", remodelacionManual: "",
  etapaHonorarios: "", honorariosPct: "",
  descuentoPct: "", descuentoMotivo: "",
};

const n = (x: string) => { const v = parseFloat((x || "0").toString().replace(/,/g, "")); return isNaN(v) ? 0 : v; };
const fmt = (x: number) => x.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });
const inp = "mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Suma de una lista de adeudos/gastos. */
const sumaLista = (lista: ItemMonto[]) => lista.reduce((acc, it) => acc + n(it.monto), 0);

/** Calcula el desglose completo del precio — se usa aquí y también se
 *  puede importar donde se necesite (correo, PDF, validación). */
export function calcularPrecio(v: PrecioURRJ) {
  const totalAdeudos = sumaLista(v.adeudos);
  const totalGastos = sumaLista(v.gastosJuridicos);
  const m2 = n(v.m2Construccion);
  const dentroDeRango = m2 >= 45 && m2 <= 200;
  const remodelacionAuto = dentroDeRango ? remodelacionSugerida(m2) : 0;
  const remodelacion = !v.incluirRemodelacion ? 0 : dentroDeRango ? remodelacionAuto : n(v.remodelacionManual);
  const subtotal = n(v.precioPiso) + totalAdeudos + totalGastos + remodelacion;
  const honorarios = subtotal * (n(v.honorariosPct) / 100);
  const antesDescuento = subtotal + honorarios;
  const descuento = antesDescuento * (n(v.descuentoPct) / 100);
  const precioFinal = antesDescuento - descuento;
  // Utilidad esperada: solo informativa, referencia 45% — no se ajusta el precio para alcanzarla.
  const utilidadEsperada = precioFinal * 0.45;
  return { totalAdeudos, totalGastos, remodelacion, remodelacionAuto, subtotal, honorarios, descuento, precioFinal, utilidadEsperada, requiereM2Manual: m2 > 0 && !dentroDeRango };
}

function ListaMontos({ titulo, items, onChange, placeholder }: {
  titulo: string; items: ItemMonto[]; onChange: (v: ItemMonto[]) => void; placeholder: string;
}) {
  const agregar = () => onChange([...items, { id: nuevoId(), concepto: "", monto: "" }]);
  const quitar = (id: string) => onChange(items.filter((it) => it.id !== id));
  const set = (id: string, campo: "concepto" | "monto", v: string) => onChange(items.map((it) => (it.id === id ? { ...it, [campo]: v } : it)));
  const total = sumaLista(items);

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-muted-foreground">{titulo}</label>
        <button type="button" onClick={agregar} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-0.5 text-[11px] font-medium hover:bg-muted">
          <Plus className="h-3 w-3" /> Agregar
        </button>
      </div>
      {items.length === 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">Sin conceptos capturados.</p>
      ) : (
        <div className="mt-1 space-y-1.5">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-1.5">
              <input value={it.concepto} onChange={(e) => set(it.id, "concepto", e.target.value)} placeholder={placeholder} className={`${inp} flex-1`} />
              <input type="number" value={it.monto} onChange={(e) => set(it.id, "monto", e.target.value)} placeholder="$ 0" className={`${inp} w-32`} />
              <button type="button" onClick={() => quitar(it.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-input text-muted-foreground hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <p className="text-right text-[11px] font-medium text-muted-foreground">Subtotal: {fmt(total)}</p>
        </div>
      )}
    </div>
  );
}

export function BloquePrecioURRJ({ valor, onChange, puedePrecioPiso = true }: {
  valor: PrecioURRJ;
  onChange: (v: PrecioURRJ) => void;
  /** Solo la Directora (DGE/Super_Admin) debería poder editar el precio piso. */
  puedePrecioPiso?: boolean;
}) {
  const set = <K extends keyof PrecioURRJ>(k: K, v: PrecioURRJ[K]) => onChange({ ...valor, [k]: v });
  const calc = useMemo(() => calcularPrecio(valor), [valor]);

  const elegirEtapa = (etapa: string) => {
    const sugerido = CP_HONORARIOS_ETAPA.find((e) => e.etapa === etapa)?.pct;
    onChange({ ...valor, etapaHonorarios: etapa, honorariosPct: sugerido != null ? String(sugerido) : valor.honorariosPct });
  };

  return (
    <div className="rounded-xl border border-dashed border-border p-4">
      <p className="text-sm font-semibold">Administración · valuación y precio</p>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Estos datos los llena Contabilidad. El <b>precio piso</b> lo coloca la Directora.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Valor comercial <span className="text-muted-foreground/70">(reflejo)</span></label>
          <input type="number" value={valor.valorComercial} onChange={(e) => set("valorComercial", e.target.value)} placeholder="pendiente (otro sistema)" className={inp} />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Costos <span className="text-muted-foreground/70">(reflejo)</span></label>
          <input type="number" value={valor.costos} onChange={(e) => set("costos", e.target.value)} placeholder="pendiente" className={inp} />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Precio de cesión <span className="text-muted-foreground/70">(reflejo)</span></label>
          <input type="number" value={valor.precioCesion} onChange={(e) => set("precioCesion", e.target.value)} placeholder="pendiente" className={inp} />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Margen objetivo <span className="text-muted-foreground/70">(reflejo)</span></label>
          <input type="number" value={valor.margen} onChange={(e) => set("margen", e.target.value)} placeholder="pendiente" className={inp} />
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <label className="text-xs font-semibold text-[color:var(--teal)]">Precio piso (lo coloca la Directora)</label>
        {puedePrecioPiso ? (
          <input type="number" value={valor.precioPiso} onChange={(e) => set("precioPiso", e.target.value)} placeholder="$ —" className={`${inp} border-[color:var(--teal)]/50`} />
        ) : (
          <div className="mt-0.5 flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
            {valor.precioPiso ? `$ ${valor.precioPiso}` : "Lo coloca la Directora (DGE)."}
          </div>
        )}
      </div>

      {/* ---- Adeudos ---- */}
      <div className="mt-4 border-t border-border pt-3">
        <ListaMontos titulo="Adeudos" items={valor.adeudos} onChange={(v) => set("adeudos", v)} placeholder="Ej. predial, agua, condominio…" />
      </div>

      {/* ---- Gastos jurídicos ---- */}
      <div className="mt-4 border-t border-border pt-3">
        <ListaMontos titulo="Gastos jurídicos" items={valor.gastosJuridicos} onChange={(v) => set("gastosJuridicos", v)} placeholder="Ej. gastos procesales, peritos…" />
      </div>

      {/* ---- Remodelación ---- */}
      <div className="mt-4 border-t border-border pt-3">
        <label className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <input type="checkbox" checked={valor.incluirRemodelacion} onChange={(e) => set("incluirRemodelacion", e.target.checked)} />
          Incluir remodelación en el precio
        </label>
        {valor.incluirRemodelacion && (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">m² de construcción</label>
              <input type="number" value={valor.m2Construccion} onChange={(e) => set("m2Construccion", e.target.value)} placeholder="0" className={inp} />
            </div>
            {calc.requiereM2Manual ? (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Remodelación (captura manual — fuera de 45–200 m²)</label>
                <input type="number" value={valor.remodelacionManual} onChange={(e) => set("remodelacionManual", e.target.value)} placeholder="$ 0" className={inp} />
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Remodelación (calculada automática)</label>
                <div className="mt-0.5 flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">{fmt(calc.remodelacionAuto)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Honorarios ---- */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Etapa procesal (sugiere el % de honorarios)</label>
            <select value={valor.etapaHonorarios} onChange={(e) => elegirEtapa(e.target.value)} className={inp}>
              <option value="">— Elegir etapa —</option>
              {CP_HONORARIOS_ETAPA.map((e) => (
                <option key={e.etapa} value={e.etapa}>{e.etapa} ({e.pct}%)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">% Honorarios legales <span className="text-muted-foreground/70">(editable)</span></label>
            <input type="number" value={valor.honorariosPct} onChange={(e) => set("honorariosPct", e.target.value)} placeholder="0" className={inp} />
          </div>
        </div>
      </div>

      {/* ---- Descuento ---- */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">% Descuento (opcional)</label>
            <input type="number" value={valor.descuentoPct} onChange={(e) => set("descuentoPct", e.target.value)} placeholder="0" className={inp} />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Motivo del descuento</label>
            <input type="text" value={valor.descuentoMotivo} onChange={(e) => set("descuentoMotivo", e.target.value)} placeholder="Ej. pronto pago, negociación…" className={inp} />
          </div>
        </div>
      </div>

      {/* ---- Resumen calculado ---- */}
      <div className="mt-4 rounded-lg border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3 text-[13px]">
        <div className="flex justify-between"><span>Precio piso + adeudos + gastos + remodelación</span><b>{fmt(calc.subtotal)}</b></div>
        <div className="flex justify-between text-muted-foreground"><span>Honorarios ({valor.honorariosPct || 0}%)</span><span>+ {fmt(calc.honorarios)}</span></div>
        {n(valor.descuentoPct) > 0 && <div className="flex justify-between text-muted-foreground"><span>Descuento ({valor.descuentoPct}%){valor.descuentoMotivo ? ` — ${valor.descuentoMotivo}` : ""}</span><span>− {fmt(calc.descuento)}</span></div>}
        <div className="mt-1.5 flex justify-between border-t border-[color:var(--teal)]/30 pt-1.5 text-sm font-semibold text-[color:var(--teal)]"><span>Precio final</span><span>{fmt(calc.precioFinal)}</span></div>
        <p className="mt-1 text-[11px] text-muted-foreground">Utilidad esperada (referencia 45%, informativa — no se fuerza el precio): {fmt(calc.utilidadEsperada)}</p>
      </div>
    </div>
  );
}

/** Arma un resumen de precio para pegarlo en el cuerpo del correo. */
export function resumenPrecio(v: PrecioURRJ): string {
  const l = (etq: string, x: string) => `${etq}: ${x ? `$${x}` : "—"}`;
  const calc = calcularPrecio(v);
  const lineasAdeudos = v.adeudos.map((it) => `  · ${it.concepto || "—"}: $${it.monto || 0}`).join("\n");
  const lineasGastos = v.gastosJuridicos.map((it) => `  · ${it.concepto || "—"}: $${it.monto || 0}`).join("\n");
  return [
    l("Valor comercial", v.valorComercial),
    l("Costos", v.costos),
    l("Precio de cesión", v.precioCesion),
    l("Margen objetivo", v.margen),
    l("PRECIO PISO (Directora)", v.precioPiso),
    v.adeudos.length ? `Adeudos:\n${lineasAdeudos}` : "Adeudos: —",
    v.gastosJuridicos.length ? `Gastos jurídicos:\n${lineasGastos}` : "Gastos jurídicos: —",
    v.incluirRemodelacion ? `Remodelación: $${calc.remodelacion.toFixed(2)} (${calc.requiereM2Manual ? "manual" : "automática"}, ${v.m2Construccion || 0} m²)` : "Remodelación: no incluida",
    `Honorarios: ${v.honorariosPct || 0}%${v.etapaHonorarios ? ` (etapa: ${v.etapaHonorarios})` : ""} = $${calc.honorarios.toFixed(2)}`,
    n(v.descuentoPct) > 0 ? `Descuento: ${v.descuentoPct}% (${v.descuentoMotivo || "sin motivo"}) = −$${calc.descuento.toFixed(2)}` : "Descuento: ninguno",
    `PRECIO FINAL: $${calc.precioFinal.toFixed(2)}`,
    `Utilidad esperada (referencia 45%, informativa): $${calc.utilidadEsperada.toFixed(2)}`,
  ].join("\n");
}
