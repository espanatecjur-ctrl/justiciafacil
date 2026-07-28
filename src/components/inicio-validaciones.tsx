import { ValidacionesHome } from "@/components/validaciones-home";
import { MisFirmasPendientes } from "@/components/mis-firmas-pendientes";

export function InicioValidaciones() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Sub-módulo 1: instrucciones de URRJ (val_urrj / val_gad / val_dil) */}
      <ValidacionesHome />

      {/* Sub-módulo 2: cadena de firmas Elabora → DIL → UCM → Precio → DGE */}
      <MisFirmasPendientes />
    </div>
  );
}
