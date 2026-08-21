// ============================================================
// JusticiaFácil · Carpeta física — COMPONENTE ÚNICO
// ------------------------------------------------------------
// Este archivo reemplaza a TRES pedazos de código que hacían lo
// mismo de tres formas distintas:
//   1. boton-apertura-carpeta.tsx   (nunca se conectó a nada)
//   2. carpeta-fisica-ficha.tsx     (nunca se conectó a nada)
//   3. el "estante + botón Nueva" que estaba copiado dentro de
//      panel-documentos-asunto.tsx y registrar-documento-fisico.tsx
//
// POR QUÉ SE QUITÓ EL ESTANTE
// Antes la pantalla te mostraba TODAS las carpetas de la sucursal
// (hasta 200) y te pedía escoger una. Nada revisaba que la carpeta
// escogida fuera la de ese asunto. Si alguien le picaba a la
// carpeta de junto, los documentos se guardaban en el expediente
// de otro cliente y no había forma de darse cuenta.
//
// Ahora la regla es simple: UN ASUNTO = UNA CARPETA. No se escoge,
// no se busca. El sistema la encuentra sola por el id del asunto y,
// si todavía no existe, la crea con su folio consecutivo.
//
// CÓMO SE USA
//   a) Bloque visual completo (ficha del asunto):
//        <CarpetaFisicaBloque asunto={asunto} />
//
//   b) Modo compacto, cuando otra pantalla solo necesita saber
//      cuál es la carpeta para poder subirle documentos:
//        <CarpetaFisicaBloque asunto={asunto} compacto
//          onCarpeta={setCarpeta} />
//
//   c) Sin nada de UI, solo los datos:
//        const { carpeta, crear } = useCarpetaFisica(asunto);
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BookOpen, CheckCircle2, FolderPlus, Loader2, Printer, AlertTriangle,
} from "lucide-react";
import {
  carpetaDeAsunto, crearCarpeta, confirmarAperturaFisica,
  registrarDescargaPortada, type CarpetaFisica,
} from "@/lib/carpetas-fisicas";
import { descargarPortadaCarpeta } from "@/lib/portada-carpeta-pdf";
import { nombresSucursales, sucursalJuridicoDe, responsableDe } from "@/lib/archivo-general";
import { detectarUbicacion } from "@/lib/ciudad-judicial";
import type { AsuntoUnificado } from "@/lib/asuntos-busqueda";

const NAVY = "#0B1E3A";

// ------------------------------------------------------------
// HOOK — toda la lógica vive aquí
// ------------------------------------------------------------

interface OpcionesCarpeta {
  /** Sucursal que ya trae el caso, si la pantalla la conoce. */
  sucursalDelCaso?: string | null;
  /**
   * Crear la carpeta sola en cuanto se abra la pantalla, sin que
   * nadie le pique a nada. Prendido por defecto.
   *
   * Si algún día quieres que vuelva a pedir confirmación, manda
   * autoCrear={false} y aparece el botón "Crear carpeta física".
   */
  autoCrear?: boolean;
}

export function useCarpetaFisica(asunto: AsuntoUnificado, opciones: OpcionesCarpeta = {}) {
  const { sucursalDelCaso = null, autoCrear = true } = opciones;

  const [carpeta, setCarpeta] = useState<CarpetaFisica | null>(null);
  const [sucursal, setSucursal] = useState<string>("");
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Candado: que la creación automática se intente UNA sola vez por
  // asunto. Sin esto, si React vuelve a montar el componente (pasa al
  // cambiar de pestaña), se dispararía otra vez.
  const yaIntento = useRef<string | null>(null);

  // ---- Buscar la carpeta del asunto y resolver su sucursal ----
  useEffect(() => {
    let activo = true;
    setCargando(true);
    setAviso(null);

    (async () => {
      const [existente, nombres] = await Promise.all([
        carpetaDeAsunto(asunto),
        nombresSucursales(),
      ]);
      if (!activo) return;

      // Qué sucursal le toca: la del caso; si no, la de la ciudad del juzgado.
      let propuesta = sucursalDelCaso || null;
      if (!propuesta && !existente) {
        const ubic = detectarUbicacion({
          distrito_judicial: asunto.direccion, juzgado: null, entidad: null,
        });
        if (ubic?.ciudad) propuesta = await sucursalJuridicoDe(ubic.ciudad);
      }
      if (!activo) return;

      setCarpeta(existente);
      setSucursal(existente?.sucursal || propuesta || nombres[0] || "");
      setCargando(false);
    })();

    return () => { activo = false; };
  }, [asunto.id, sucursalDelCaso]);

  // ---- Crear ----
  const crear = useCallback(async () => {
    if (!sucursal) { setAviso("No se pudo determinar la sucursal del asunto."); return null; }
    setOcupado(true);
    setAviso(null);
    // crearCarpeta ya revisa por dentro si el asunto tenía carpeta:
    // si la tenía, devuelve esa y no crea una segunda.
    const nueva = await crearCarpeta(asunto, sucursal);
    if (!nueva) setAviso("No se pudo crear la carpeta. Intenta de nuevo.");
    else setCarpeta(nueva);
    setOcupado(false);
    return nueva;
  }, [asunto, sucursal]);

  // ---- Creación automática ----
  useEffect(() => {
    if (!autoCrear || cargando || carpeta || ocupado || !sucursal) return;
    if (yaIntento.current === asunto.id) return;
    yaIntento.current = asunto.id;
    void crear();
  }, [autoCrear, cargando, carpeta, ocupado, sucursal, asunto.id, crear]);

  // ---- Portada (obligatoria antes de aperturar) ----
  const descargarPortada = useCallback(async () => {
    if (!carpeta) return;
    setOcupado(true);
    setAviso(null);
    try {
      const resp = await responsableDe(carpeta.sucursal);
      await descargarPortadaCarpeta({
        carpeta,
        unidad: asunto.unidad,
        resguardo: resp?.nombre || null,
      });
      // Se marca en la base solo después de que el PDF salió bien.
      await registrarDescargaPortada(carpeta.id);
      setCarpeta({
        ...carpeta,
        portadaDescargada: true,
        portadaDescargadaEn: new Date().toISOString(),
      });
    } catch {
      setAviso("No se pudo generar la portada. Revisa tu conexión.");
    } finally {
      setOcupado(false);
    }
  }, [carpeta, asunto.unidad]);

  // ---- Apertura física ----
  const aperturar = useCallback(async () => {
    if (!carpeta) return;
    setOcupado(true);
    setAviso(null);
    const r = await confirmarAperturaFisica(carpeta.id);
    if (r.ok) setCarpeta(r.carpeta);
    else setAviso(r.motivo);
    setOcupado(false);
  }, [carpeta]);

  return { carpeta, sucursal, cargando, ocupado, aviso, crear, descargarPortada, aperturar };
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

interface Props {
  asunto: AsuntoUnificado;
  sucursalDelCaso?: string | null;
  autoCrear?: boolean;
  /** Versión de una sola línea, para meterla arriba de un uploader. */
  compacto?: boolean;
  /** Le avisa a la pantalla de arriba cuál es la carpeta (para subir documentos). */
  onCarpeta?: (c: CarpetaFisica | null) => void;
}

export function CarpetaFisicaBloque({
  asunto, sucursalDelCaso = null, autoCrear = true, compacto = false, onCarpeta,
}: Props) {
  const navigate = useNavigate();
  const { carpeta, sucursal, cargando, ocupado, aviso, crear, descargarPortada, aperturar } =
    useCarpetaFisica(asunto, { sucursalDelCaso, autoCrear });

  // Avisarle al padre cada vez que cambie la carpeta.
  useEffect(() => { onCarpeta?.(carpeta); }, [carpeta, onCarpeta]);

  function abrirLibro() {
    if (!carpeta?.folioCf) return;
    navigate({ to: "/libro", search: { cf: carpeta.folioCf } });
  }

  // ---- Cargando ----
  if (cargando) {
    return (
      <div className={compacto
        ? "flex items-center gap-1.5 py-1.5 text-[11px] text-muted-foreground"
        : "flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground"}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando la carpeta física…
      </div>
    );
  }

  // ---- Compacto ----
  if (compacto) {
    if (!carpeta) {
      return (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          <AlertTriangle className="h-3 w-3" />
          <span>{aviso || "Este asunto todavía no tiene carpeta física."}</span>
          <button
            onClick={() => void crear()}
            disabled={ocupado || !sucursal}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-white disabled:opacity-50"
            style={{ background: NAVY }}
          >
            {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderPlus className="h-3 w-3" />}
            Crear carpeta
          </button>
        </div>
      );
    }
    return (
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-blue-50 px-2 py-1 text-[11px]">
        <span className="font-mono font-medium text-blue-700">{carpeta.folioCf || carpeta.folio}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{carpeta.sucursal}</span>
          {!carpeta.abiertaFisicamente && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Sin aperturar</span>
          )}
          <button onClick={abrirLibro} className="font-medium text-blue-700 hover:underline">
            Ver libro
          </button>
        </div>
      </div>
    );
  }

  // ---- Bloque completo ----
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: NAVY }}>
        <BookOpen className="h-4 w-4" /> Carpeta física
      </p>

      {!carpeta ? (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            Este asunto todavía no tiene carpeta de papel. Al crearla se le asigna
            folio automático{sucursal ? ` en ${sucursal}` : ""}.
          </p>
          <button
            onClick={() => void crear()}
            disabled={ocupado || !sucursal}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50"
            style={{ background: NAVY }}
          >
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            Crear carpeta física
          </button>
        </>
      ) : (
        <>
          <div className="mb-3">
            <p className="font-mono text-sm font-medium">{carpeta.folioCf || carpeta.folio}</p>
            <p className="text-xs text-muted-foreground">
              {carpeta.sucursal}
              {carpeta.noCredito ? ` · Crédito ${carpeta.noCredito}` : " · sin número de crédito"}
              {carpeta.garId ? ` · Garantía ${carpeta.garId}` : ""}
            </p>
          </div>

          {carpeta.abiertaFisicamente ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Aperturada
                {carpeta.abiertaEn && ` · ${new Date(carpeta.abiertaEn).toLocaleDateString("es-MX")}`}
              </span>
              <button
                onClick={abrirLibro}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-white"
                style={{ background: NAVY }}
              >
                <BookOpen className="h-4 w-4" /> Abrir libro
              </button>
              <button
                onClick={() => void descargarPortada()}
                disabled={ocupado}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                <Printer className="h-4 w-4" /> Portada
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void descargarPortada()}
                disabled={ocupado}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                {carpeta.portadaDescargada ? "Descargar portada otra vez" : "Descargar portada"}
              </button>
              <button
                onClick={() => void aperturar()}
                disabled={ocupado || !carpeta.portadaDescargada}
                title={carpeta.portadaDescargada ? "" : "Primero descarga la portada"}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50"
                style={{ background: NAVY }}
              >
                <CheckCircle2 className="h-4 w-4" /> Confirmar apertura
              </button>
            </div>
          )}
        </>
      )}

      {aviso && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {aviso}
        </p>
      )}
    </div>
  );
}
