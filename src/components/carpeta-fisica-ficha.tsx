// ============================================================
// JusticiaFácil · Bloque de carpeta física para la FICHA
// ------------------------------------------------------------
// Este es el componente que se pone en la ficha de documentos de
// cada asunto (UCM / UCP / UFC / UDP). Junta dos cosas:
//
//   ARRIBA  · el bloque de la carpeta: folio, sucursal, QUIÉN TIENE EL
//             RESGUARDO, y los botones de portada y apertura.
//   ABAJO   · el libro, que aparece SOLO cuando la carpeta ya se
//             aperturó físicamente. Antes de eso no tiene sentido
//             mostrarlo: no existe la carpeta de papel todavía.
//
// SE PONE EN UNA SOLA LÍNEA en documentos-asunto.tsx, arriba del
// bloque "Inventario completo de este asunto". Ese inventario NO se
// quita: sigue siendo la lista detallada con filtros, anotaciones y
// bajas. El libro es otra cosa — es el orden del expediente.
// ============================================================

import { useEffect, useState } from "react";
import {
  FolderPlus, Printer, Loader2, CheckCircle2, AlertTriangle, Lock, Link2, User,
} from "lucide-react";
import {
  carpetaDeAsunto, crearCarpeta, confirmarAperturaFisica, registrarDescargaPortada,
  resguardoActual, type CarpetaFisica,
} from "@/lib/carpetas-fisicas";
import { descargarPortadaCarpeta } from "@/lib/portada-carpeta-pdf";
import { responsableDe, sucursalJuridicoDe, nombresSucursales } from "@/lib/archivo-general";
import { detectarUbicacion } from "@/lib/ciudad-judicial";
import { LibroCarpeta } from "@/components/libro-carpeta";
import type { AsuntoUnificado } from "@/lib/asuntos-busqueda";

const NAVY = "#042C53";

interface Props {
  asunto: AsuntoUnificado;
  sucursalDelCaso?: string | null;
  /** Abre el modal de "Registrar documento físico" que ya existe. */
  onRelacionar?: () => void;
}

export function CarpetaFisicaFicha({ asunto, sucursalDelCaso, onRelacionar }: Props) {
  const [carpeta, setCarpeta] = useState<CarpetaFisica | null>(null);
  const [sucursal, setSucursal] = useState("");
  const [sucursales, setSucursales] = useState<string[]>([]);
  const [responsable, setResponsable] = useState<string | null>(null);
  const [quienLaTrae, setQuienLaTrae] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // ---- Carga ----
  useEffect(() => {
    let activo = true;
    (async () => {
      setCargando(true);
      const [existente, nombres] = await Promise.all([carpetaDeAsunto(asunto), nombresSucursales()]);
      if (!activo) return;

      setCarpeta(existente);
      setSucursales(nombres);

      // Sucursal propuesta: la del caso; si no, la de la ciudad del juzgado.
      let propuesta = sucursalDelCaso || null;
      if (!propuesta) {
        const ubic = detectarUbicacion({ distrito_judicial: asunto.direccion, juzgado: null, entidad: null });
        if (ubic?.ciudad) propuesta = await sucursalJuridicoDe(ubic.ciudad);
      }
      const elegida = existente?.sucursal || propuesta || nombres[0] || "";
      if (!activo) return;
      setSucursal(elegida);

      // Quién resguarda: el responsable de la sucursal (sale de la tabla `sucursales`).
      if (elegida) {
        const resp = await responsableDe(elegida);
        if (activo) setResponsable(resp?.nombre ?? null);
      }
      // Y si alguien se la llevó, eso manda sobre el estante.
      if (existente) {
        const r = await resguardoActual(existente.id);
        if (activo) setQuienLaTrae(r.enEstante ? null : r.personaEmail);
      }
      if (activo) setCargando(false);
    })();
    return () => { activo = false; };
  }, [asunto.id, sucursalDelCaso]);

  // ---- Acciones ----
  async function crear() {
    if (!sucursal) { setAviso("Elige la sucursal primero."); return; }
    setOcupado(true); setAviso(null);
    const nueva = await crearCarpeta(asunto, sucursal);
    if (!nueva) setAviso("No se pudo crear la carpeta. Intenta de nuevo.");
    else {
      setCarpeta(nueva);
      const resp = await responsableDe(nueva.sucursal);
      setResponsable(resp?.nombre ?? null);
    }
    setOcupado(false);
  }

  async function portada() {
    if (!carpeta) return;
    setOcupado(true); setAviso(null);
    try {
      const resp = await responsableDe(carpeta.sucursal);
      await descargarPortadaCarpeta({ carpeta, unidad: asunto.unidad, resguardo: resp?.nombre || null });
      // Solo se marca en la base DESPUÉS de que el PDF se generó bien.
      await registrarDescargaPortada(carpeta.id);
      setCarpeta({ ...carpeta, portadaDescargada: true, portadaDescargadaEn: new Date().toISOString() });
    } catch {
      setAviso("No se pudo generar la portada. Revisa tu conexión.");
    } finally {
      setOcupado(false);
    }
  }

  async function aperturar() {
    if (!carpeta) return;
    setOcupado(true); setAviso(null);
    const r = await confirmarAperturaFisica(carpeta.id);
    if (r.ok) setCarpeta(r.carpeta);
    else setAviso(r.motivo);
    setOcupado(false);
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Revisando carpeta física…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ================= BLOQUE DE LA CARPETA ================= */}
      <div className="rounded-xl border bg-card p-4">
        {/* --- Sin carpeta todavía --- */}
        {!carpeta ? (
          <>
            <p className="mb-1 text-sm font-medium" style={{ color: NAVY }}>Carpeta física</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Este asunto no tiene carpeta de papel. El folio se asigna solo.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sucursal}
                onChange={(e) => setSucursal(e.target.value)}
                className="rounded-md border bg-background px-2 py-1.5 text-sm"
              >
                {sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                onClick={crear}
                disabled={ocupado}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50"
                style={{ background: NAVY }}
              >
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                Crear carpeta física
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Carpeta física</p>
                <p className="font-mono text-base font-medium">{carpeta.folioCf || carpeta.folio}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  {carpeta.sucursal}
                  {responsable && ` · resguardo ${responsable}`}
                </p>
                {quienLaTrae && (
                  <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                    Ahorita la trae {quienLaTrae}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs ${
                  carpeta.abiertaFisicamente
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                }`}
              >
                {carpeta.abiertaFisicamente ? "Aperturada" : "Sin aperturar"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {carpeta.abiertaFisicamente ? (
                <>
                  <button
                    onClick={portada}
                    disabled={ocupado}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    <Printer className="h-4 w-4" /> Portada
                  </button>
                  {onRelacionar && (
                    <button
                      onClick={onRelacionar}
                      className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
                    >
                      <Link2 className="h-4 w-4" /> Relacionar físico y fijo
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* Paso 1, obligatorio */}
                  <button
                    onClick={portada}
                    disabled={ocupado}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm disabled:opacity-50 ${
                      carpeta.portadaDescargada ? "border" : "text-white"
                    }`}
                    style={carpeta.portadaDescargada ? undefined : { background: NAVY }}
                  >
                    {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    {carpeta.portadaDescargada ? "Descargar portada otra vez" : "1 · Descargar portada"}
                  </button>

                  {/* Paso 2, bloqueado hasta que exista la portada */}
                  <button
                    onClick={aperturar}
                    disabled={ocupado || !carpeta.portadaDescargada}
                    title={carpeta.portadaDescargada ? undefined : "Primero descarga la portada"}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                      carpeta.portadaDescargada ? "text-white" : "border"
                    }`}
                    style={carpeta.portadaDescargada ? { background: NAVY } : undefined}
                  >
                    {carpeta.portadaDescargada
                      ? <CheckCircle2 className="h-4 w-4" />
                      : <Lock className="h-4 w-4" />}
                    2 · Confirmar apertura física
                  </button>
                </>
              )}
            </div>

            {!carpeta.abiertaFisicamente && !carpeta.portadaDescargada && (
              <p className="mt-2 text-xs text-muted-foreground">
                Descarga la portada para desbloquear la apertura. Se imprime y se pega en el lomo.
              </p>
            )}
          </>
        )}

        {aviso && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" /> {aviso}
          </p>
        )}
      </div>

      {/* ================= EL LIBRO ================= */}
      {carpeta?.abiertaFisicamente ? (
        <LibroCarpeta carpeta={carpeta} casoJuridicoId={asunto.casoJuridicoId ?? asunto.id} />
      ) : carpeta ? (
        <div className="rounded-xl border bg-card p-5 text-center">
          <p className="text-sm font-medium">El libro aparece al aperturar</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Los espacios del expediente y sus pendientes se muestran una vez que la carpeta de papel existe de verdad.
          </p>
        </div>
      ) : null}
    </div>
  );
}
