// ============================================================
// JusticiaFácil · Botón de apertura de carpeta física
// ------------------------------------------------------------
// Este componente es el que faltaba. La función confirmarAperturaFisica()
// ya existía en el sistema, pero no había ningún botón que la llamara —
// por eso las 507 carpetas estaban en cero aperturas.
//
// SE PONE EN LAS FICHAS UCM, UCP y UFC.
//
// CÓMO SE COMPORTA, SEGÚN EL ESTADO DE LA CARPETA
//   1. No hay carpeta        → "Crear carpeta física"
//   2. Hay, sin portada      → "Descargar portada" (obligatorio)
//   3. Portada descargada    → "Confirmar apertura física"
//   4. Ya aperturada         → muestra el folio y abre el libro
//
// El paso 2 no se puede saltar: aunque alguien manipule la pantalla,
// confirmarAperturaFisica() vuelve a revisar contra la base de datos.
// ============================================================

import { useEffect, useState } from "react";
import { FolderPlus, Printer, BookOpen, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  carpetaDeAsunto, crearCarpeta, confirmarAperturaFisica, registrarDescargaPortada,
  type CarpetaFisica,
} from "@/lib/carpetas-fisicas";
import { descargarPortadaCarpeta } from "@/lib/portada-carpeta-pdf";
import { responsableDe, sucursalJuridicoDe, nombresSucursales } from "@/lib/archivo-general";
import { detectarUbicacion } from "@/lib/ciudad-judicial";
import type { AsuntoUnificado } from "@/lib/asuntos-busqueda";

const NAVY = "#042C53";

interface Props {
  asunto: AsuntoUnificado;
  /** Sucursal ya conocida del caso. Si no viene, se detecta por la dirección. */
  sucursalDelCaso?: string | null;
}

export function BotonAperturaCarpeta({ asunto, sucursalDelCaso }: Props) {
  const navigate = useNavigate();

  const [carpeta, setCarpeta] = useState<CarpetaFisica | null>(null);
  const [sucursal, setSucursal] = useState<string>("");
  const [sucursales, setSucursales] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // ---- Carga inicial ----
  useEffect(() => {
    let activo = true;
    (async () => {
      setCargando(true);

      const [existente, nombres] = await Promise.all([
        carpetaDeAsunto(asunto),
        nombresSucursales(),
      ]);
      if (!activo) return;

      setCarpeta(existente);
      setSucursales(nombres);

      // Qué sucursal proponer: la del caso, si no la de la ciudad del juzgado.
      let propuesta = sucursalDelCaso || null;
      if (!propuesta) {
        const ubic = detectarUbicacion({ distrito_judicial: asunto.direccion, juzgado: null, entidad: null });
        if (ubic?.ciudad) propuesta = await sucursalJuridicoDe(ubic.ciudad);
      }
      if (!activo) return;
      setSucursal(existente?.sucursal || propuesta || nombres[0] || "");
      setCargando(false);
    })();
    return () => { activo = false; };
  }, [asunto.id, sucursalDelCaso]);

  // ---- Paso 1: crear ----
  async function crear() {
    if (!sucursal) { setAviso("Elige la sucursal primero."); return; }
    setOcupado(true); setAviso(null);
    const nueva = await crearCarpeta(asunto, sucursal);
    if (!nueva) setAviso("No se pudo crear la carpeta. Intenta de nuevo.");
    else setCarpeta(nueva);
    setOcupado(false);
  }

  // ---- Paso 2: portada (obligatoria) ----
  async function descargarPortada() {
    if (!carpeta) return;
    setOcupado(true); setAviso(null);
    try {
      const resp = await responsableDe(carpeta.sucursal);
      await descargarPortadaCarpeta({
        carpeta,
        unidad: asunto.unidad,
        resguardo: resp?.nombre || null,
      });
      // Solo después de que el PDF se generó bien se marca en la base.
      await registrarDescargaPortada(carpeta.id);
      setCarpeta({ ...carpeta, portadaDescargada: true, portadaDescargadaEn: new Date().toISOString() });
    } catch {
      setAviso("No se pudo generar la portada. Revisa tu conexión.");
    } finally {
      setOcupado(false);
    }
  }

  // ---- Paso 3: aperturar ----
  async function aperturar() {
    if (!carpeta) return;
    setOcupado(true); setAviso(null);
    const r = await confirmarAperturaFisica(carpeta.id);
    if (r.ok) setCarpeta(r.carpeta);
    else setAviso(r.motivo);
    setOcupado(false);
  }

  function abrirLibro() {
    if (!carpeta?.folioCf) return;
    navigate({ to: "/libro", search: { cf: carpeta.folioCf } });
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Revisando carpeta física…
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: NAVY }}>
        <BookOpen className="h-4 w-4" /> Carpeta física
      </p>

      {/* ---- Estado 1: no existe ---- */}
      {!carpeta && (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            Este asunto todavía no tiene carpeta de papel. Al crearla se le asigna folio automático.
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
      )}

      {/* ---- Estados 2, 3 y 4 ---- */}
      {carpeta && (
        <>
          <div className="mb-3">
            <p className="font-mono text-sm font-medium">{carpeta.folioCf}</p>
            <p className="text-xs text-muted-foreground">
              {carpeta.sucursal}
              {carpeta.noCredito ? ` · Crédito ${carpeta.noCredito}` : " · sin número de crédito"}
            </p>
          </div>

          {/* Ya aperturada */}
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
                onClick={descargarPortada}
                disabled={ocupado}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                <Printer className="h-4 w-4" /> Portada
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {/* Paso obligatorio: portada */}
              <button
                onClick={descargarPortada}
                disabled={ocupado}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm disabled:opacity-50 ${
                  carpeta.portadaDescargada ? "border" : "text-white"
                }`}
                style={carpeta.portadaDescargada ? undefined : { background: NAVY }}
              >
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                {carpeta.portadaDescargada ? "Descargar portada otra vez" : "1 · Descargar portada"}
              </button>

              {/* El de apertura solo se habilita después */}
              <button
                onClick={aperturar}
                disabled={ocupado || !carpeta.portadaDescargada}
                title={carpeta.portadaDescargada ? undefined : "Primero descarga la portada"}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                  carpeta.portadaDescargada ? "text-white" : "border"
                }`}
                style={carpeta.portadaDescargada ? { background: NAVY } : undefined}
              >
                <CheckCircle2 className="h-4 w-4" /> 2 · Confirmar apertura física
              </button>
            </div>
          )}

          {!carpeta.abiertaFisicamente && !carpeta.portadaDescargada && (
            <p className="mt-2 text-xs text-muted-foreground">
              La portada es obligatoria: se imprime y se pega en el lomo antes de aperturar.
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
  );
}
