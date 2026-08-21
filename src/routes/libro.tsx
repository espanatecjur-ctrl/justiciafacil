// ============================================================
// JusticiaFácil · Ruta /libro
// ------------------------------------------------------------
// Esta es la pantalla que abre el QR de la portada.
// Se entra así:  /libro?cf=CF-JCMX-26-0042
//
// Hace dos cosas al mismo tiempo, con un solo escaneo:
//   1. Pregunta qué vas a hacer con la carpeta de papel (consultarla,
//      llevártela, devolverla) — de ahí sale el resguardo real.
//   2. Muestra el libro completo debajo.
//
// La barra de resguardo se puede saltar: si la persona solo quiere ver
// el contenido, ignora los botones y baja. No estorba.
// ============================================================

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Eye, ArrowRight, ArrowLeftCircle, MapPin, Check } from "lucide-react";
import {
  carpetaPorFolio, registrarMovimiento, movimientosDeCarpeta, resguardoActual,
  type CarpetaFisica, type MovimientoCarpeta, type AccionCarpeta,
} from "@/lib/carpetas-fisicas";
import { LibroCarpeta } from "@/components/libro-carpeta";

const NAVY = "#042C53";

export const Route = createFileRoute("/libro")({
  // Lee el ?cf= de la liga del QR.
  validateSearch: (search: Record<string, unknown>) => ({
    cf: typeof search.cf === "string" ? search.cf : "",
  }),
  component: PantallaLibro,
});

const ETIQUETA: Record<AccionCarpeta, string> = {
  apertura: "aperturó la carpeta",
  consulta: "consultó",
  prestamo: "se la llevó",
  devolucion: "la devolvió al estante",
};

function PantallaLibro() {
  const { cf } = Route.useSearch();

  const [carpeta, setCarpeta] = useState<CarpetaFisica | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCarpeta[]>([]);
  const [resguardo, setResguardo] = useState<{ enEstante: boolean; personaEmail: string | null } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [hecho, setHecho] = useState<AccionCarpeta | null>(null);

  async function cargar() {
    setCargando(true);
    const c = await carpetaPorFolio(cf);
    setCarpeta(c);
    if (c) {
      const [movs, resg] = await Promise.all([movimientosDeCarpeta(c.id), resguardoActual(c.id)]);
      setMovimientos(movs);
      setResguardo(resg);
    }
    setCargando(false);
  }

  useEffect(() => { if (cf) cargar(); else setCargando(false); }, [cf]);

  async function marcar(accion: AccionCarpeta) {
    if (!carpeta) return;
    setRegistrando(true);
    await registrarMovimiento(carpeta.id, accion);
    const [movs, resg] = await Promise.all([movimientosDeCarpeta(carpeta.id), resguardoActual(carpeta.id)]);
    setMovimientos(movs);
    setResguardo(resg);
    setHecho(accion);
    setRegistrando(false);
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Buscando la carpeta…
      </div>
    );
  }

  if (!carpeta) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="mb-1 font-medium">No se encontró esa carpeta</p>
        <p className="text-sm text-muted-foreground">
          El folio <span className="font-mono">{cf || "(vacío)"}</span> no existe en el sistema.
          Verifica que el QR de la portada esté completo y sin dobleces.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      {/* ---- Barra de resguardo ---- */}
      <div className="mb-4 rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{carpeta.folioCf}</p>
            <p className="font-semibold">{carpeta.clienteNombre || "Sin cliente"}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {carpeta.sucursal}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs ${
              resguardo?.enEstante
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
            }`}
          >
            {resguardo?.enEstante ? "En el estante" : `La trae ${resguardo?.personaEmail ?? "alguien"}`}
          </span>
        </div>

        {hecho ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <Check className="h-4 w-4" /> Registrado: {ETIQUETA[hecho]}.
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">¿Qué vas a hacer con la carpeta?</p>
            <div className="flex flex-wrap gap-2">
              <BotonAccion icono={<Eye className="h-4 w-4" />} texto="Solo la consulté"
                onClick={() => marcar("consulta")} ocupado={registrando} />
              <BotonAccion icono={<ArrowRight className="h-4 w-4" />} texto="Me la llevo"
                onClick={() => marcar("prestamo")} ocupado={registrando} />
              <BotonAccion icono={<ArrowLeftCircle className="h-4 w-4" />} texto="La devuelvo"
                onClick={() => marcar("devolucion")} ocupado={registrando} />
            </div>
          </>
        )}

        {/* Últimos movimientos */}
        {movimientos.length > 0 && (
          <div className="mt-3 border-t pt-2.5">
            <p className="mb-1 text-xs text-muted-foreground">Últimos movimientos</p>
            {movimientos.slice(0, 4).map((m) => (
              <p key={m.id} className="text-xs text-muted-foreground">
                {new Date(m.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} ·{" "}
                {m.personaEmail ?? "—"} {ETIQUETA[m.accion]}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* ---- El libro ---- */}
      <LibroCarpeta carpeta={carpeta} casoJuridicoId={carpeta.casoJuridicoId} />
    </div>
  );
}

function BotonAccion({ icono, texto, onClick, ocupado }: {
  icono: React.ReactNode; texto: string; onClick: () => void; ocupado: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={ocupado}
      className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
      style={{ borderColor: NAVY, color: NAVY }}
    >
      {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : icono}
      {texto}
    </button>
  );
}
