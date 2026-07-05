// ============================================================
// BloquePrecioURRJ · datos de Administración/valuación + precio
// piso, para mostrar ARRIBA del BannerCorreo (prop `extra`).
// Los 4 campos son editables (Contabilidad los llena mientras
// tanto); la conexión con el otro sistema queda preparada pero
// no se llena aquí todavía. El precio piso lo coloca la Directora.
// ============================================================

export interface PrecioURRJ {
  valorComercial: string;
  costos: string;
  precioCesion: string;
  margen: string;
  precioPiso: string;
}

export const PRECIO_VACIO: PrecioURRJ = {
  valorComercial: "", costos: "", precioCesion: "", margen: "", precioPiso: "",
};

const inp = "mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function BloquePrecioURRJ({ valor, onChange, puedePrecioPiso = true }: {
  valor: PrecioURRJ;
  onChange: (v: PrecioURRJ) => void;
  /** Solo la Directora (DGE/Super_Admin) debería poder editar el precio piso. */
  puedePrecioPiso?: boolean;
}) {
  const set = (k: keyof PrecioURRJ, v: string) => onChange({ ...valor, [k]: v });

  return (
    <div className="rounded-xl border border-dashed border-border p-4">
      <p className="text-sm font-semibold">Administración · valuación y precio</p>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Estos datos los llena Contabilidad (vendrán del otro sistema; por ahora se capturan aquí). El <b>precio piso</b> lo coloca la Directora.
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
    </div>
  );
}

/** Arma un resumen de precio para pegarlo en el cuerpo del correo. */
export function resumenPrecio(v: PrecioURRJ): string {
  const l = (etq: string, x: string) => `${etq}: ${x ? `$${x}` : "—"}`;
  return [
    l("Valor comercial", v.valorComercial),
    l("Costos", v.costos),
    l("Precio de cesión", v.precioCesion),
    l("Margen objetivo", v.margen),
    l("PRECIO PISO (Directora)", v.precioPiso),
  ].join("\n");
}
