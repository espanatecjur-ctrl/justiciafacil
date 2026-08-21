// ============================================================
// JusticiaFácil · Vista "Libro" de la carpeta física
// ------------------------------------------------------------
// Muestra la carpeta como un libro: apartados, hojas en orden, y los
// huecos marcados como pendientes.
//
// DOS VISTAS, MISMO CONTENIDO
//   · Libro  → agrupado por apartado, para leerlo como expediente
//   · Tabla  → todo en renglones tipo Excel, para escanear rápido
// El botón de arriba cambia entre las dos. No recarga nada: es la misma
// información acomodada distinto.
//
// LAS SUGERENCIAS
// Los documentos que el sistema acomodó solo salen con una marca. Mientras
// estén sugeridos, nadie confirmó que estén en el lugar correcto. El botón
// "Aceptar acomodo" los deja fijos de un jalón.
// ============================================================

import { useEffect, useState } from "react";
import {
  BookOpen, Table2, FileText, FileX2, Check, Loader2, Camera, Upload, Printer, ExternalLink,
} from "lucide-react";
import {
  armarLibro, aceptarSugerencias, fijarEspacio, catalogoDelLibro,
  type Libro, type HojaLibro, type RenglonLibro,
} from "@/lib/libro-carpeta";
import type { CarpetaFisica } from "@/lib/carpetas-fisicas";

const NAVY = "#042C53";

// Un color por apartado, para que se distingan de reojo.
const COLOR_APARTADO: Record<number, string> = {
  1: "#7F77DD", // documentos del cliente
  2: "#1D9E75", // dictámenes
  3: "#378ADD", // cesiones y titularidad
  4: "#D85A30", // documentos del juicio
  5: "#BA7517", // entrega de la propiedad
  6: "#888780", // otros
};

interface Props {
  carpeta: CarpetaFisica;
  casoJuridicoId: string | null;
  /** Se llama cuando el usuario quiere subir un documento a un espacio vacío. */
  onSubirA?: (subseccionClave: string, subseccionNombre: string) => void;
}

export function LibroCarpeta({ carpeta, casoJuridicoId, onSubirA }: Props) {
  const [libro, setLibro] = useState<Libro | null>(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<"libro" | "tabla">("libro");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true);
    const l = await armarLibro(carpeta.id, casoJuridicoId);
    setLibro(l);
    setCargando(false);
  }

  useEffect(() => { cargar(); }, [carpeta.id, casoJuridicoId]);

  async function aceptarTodo() {
    if (!libro) return;
    setGuardando(true);
    await aceptarSugerencias(libro, carpeta.id);
    await cargar();
    setGuardando(false);
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Armando el libro…
      </div>
    );
  }
  if (!libro) return null;

  const sugeridos = libro.apartados
    .flatMap((a) => a.renglones)
    .flatMap((r) => r.hojas)
    .filter((h) => h.sugerido).length;

  return (
    <div className="rounded-xl border bg-card">
      {/* ---- Encabezado ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{carpeta.folioCf}</p>
          <p className="font-semibold">{carpeta.clienteNombre || "Sin cliente"}</p>
          <p className="text-xs text-muted-foreground">
            {libro.totalCompletos} de {libro.totalEspacios} espacios con documento
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sugeridos > 0 && (
            <button
              onClick={aceptarTodo}
              disabled={guardando}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Aceptar acomodo ({sugeridos})
            </button>
          )}

          {/* Cambio de vista — no recarga, solo reacomoda */}
          <div className="flex overflow-hidden rounded-md border">
            <button
              onClick={() => setVista("libro")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${vista === "libro" ? "text-white" : "text-muted-foreground"}`}
              style={vista === "libro" ? { background: NAVY } : undefined}
            >
              <BookOpen className="h-3.5 w-3.5" /> Libro
            </button>
            <button
              onClick={() => setVista("tabla")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs ${vista === "tabla" ? "text-white" : "text-muted-foreground"}`}
              style={vista === "tabla" ? { background: NAVY } : undefined}
            >
              <Table2 className="h-3.5 w-3.5" /> Tabla
            </button>
          </div>
        </div>
      </div>

      {/* ---- Aviso de faltantes obligatorios ---- */}
      {libro.faltantesObligatorios.length > 0 && (
        <div className="border-b bg-amber-50 px-4 py-2.5 dark:bg-amber-950/30">
          <p className="text-xs text-amber-900 dark:text-amber-200">
            <strong>Faltan {libro.faltantesObligatorios.length} documentos obligatorios:</strong>{" "}
            {libro.faltantesObligatorios.join(" · ")}
          </p>
        </div>
      )}

      {/* ---- Contenido ---- */}
      {vista === "libro" ? (
        <VistaLibro libro={libro} onSubirA={onSubirA} />
      ) : (
        <VistaTabla libro={libro} onSubirA={onSubirA} />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// Vista Libro — agrupada por apartado
// ------------------------------------------------------------

function VistaLibro({ libro, onSubirA }: { libro: Libro; onSubirA?: Props["onSubirA"] }) {
  return (
    <div className="p-4">
      {libro.apartados.map((apartado) => (
        <div
          key={apartado.num}
          className="mb-4 border-l-[3px] pl-3"
          style={{ borderColor: COLOR_APARTADO[apartado.num] || "#888780" }}
        >
          <p className="mb-2 text-sm font-medium" style={{ color: COLOR_APARTADO[apartado.num] }}>
            {apartado.num} · {apartado.nombre}
          </p>

          {apartado.renglones.map((renglon) => (
            <Renglon key={renglon.espacio.subseccionClave} renglon={renglon} onSubirA={onSubirA} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Renglon({ renglon, onSubirA }: { renglon: RenglonLibro; onSubirA?: Props["onSubirA"] }) {
  const { espacio, hojas, pendiente } = renglon;

  // Espacio vacío → hoja pendiente
  if (pendiente) {
    return (
      <div className="mb-1.5 flex items-center gap-2.5 rounded-md border border-dashed bg-muted/30 px-3 py-2">
        <FileX2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm text-muted-foreground">
          {espacio.subseccionNombre}
          {espacio.condicional && <span className="ml-1.5 text-xs">(solo si aplica)</span>}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSubirA?.(espacio.subseccionClave, espacio.subseccionNombre)}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted"
            title="Subir archivo"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onSubirA?.(espacio.subseccionClave, espacio.subseccionNombre)}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted"
            title="Tomar foto"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => imprimirHojaPendiente(espacio.subseccionNombre)}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted"
            title="Imprimir hoja de faltante para meter en la carpeta"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Espacio con documentos
  return (
    <>
      {hojas.map((hoja) => (
        <div key={hoja.id} className="mb-1.5 flex items-center gap-2.5 rounded-md border px-3 py-2">
          <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{hoja.nombre}</p>
            <p className="text-xs text-muted-foreground">
              {espacio.subseccionNombre}
              {hoja.origen === "fisico" && " · físico"}
            </p>
            {hoja.analisis && (
              <p className="mt-0.5 text-xs italic text-muted-foreground">{hoja.analisis}</p>
            )}
          </div>
          {hoja.sugerido && (
            <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Sugerido
            </span>
          )}
          {hoja.link && (
            <a href={hoja.link} target="_blank" rel="noreferrer" className="rounded p-1.5 hover:bg-muted">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          )}
        </div>
      ))}
    </>
  );
}

// ------------------------------------------------------------
// Vista Tabla — todo plano, tipo Excel
// ------------------------------------------------------------

function VistaTabla({ libro, onSubirA }: { libro: Libro; onSubirA?: Props["onSubirA"] }) {
  const renglones = libro.apartados.flatMap((a) =>
    a.renglones.map((r) => ({ apartado: a, renglon: r }))
  );

  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-3 font-normal">Apartado</th>
            <th className="pb-2 pr-3 font-normal">Espacio</th>
            <th className="pb-2 pr-3 font-normal">Documento</th>
            <th className="pb-2 pr-3 font-normal">Origen</th>
            <th className="pb-2 font-normal">Estado</th>
          </tr>
        </thead>
        <tbody>
          {renglones.map(({ apartado, renglon }) => {
            if (renglon.pendiente) {
              return (
                <tr key={renglon.espacio.subseccionClave} className="border-b last:border-0">
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{apartado.num}</td>
                  <td className="py-2 pr-3">{renglon.espacio.subseccionNombre}</td>
                  <td className="py-2 pr-3 text-muted-foreground">—</td>
                  <td className="py-2 pr-3 text-muted-foreground">—</td>
                  <td className="py-2">
                    <button
                      onClick={() => onSubirA?.(renglon.espacio.subseccionClave, renglon.espacio.subseccionNombre)}
                      className="text-xs text-amber-700 underline dark:text-amber-400"
                    >
                      Pendiente
                    </button>
                  </td>
                </tr>
              );
            }
            return renglon.hojas.map((hoja) => (
              <tr key={hoja.id} className="border-b last:border-0">
                <td className="py-2 pr-3 text-xs text-muted-foreground">{apartado.num}</td>
                <td className="py-2 pr-3">{renglon.espacio.subseccionNombre}</td>
                <td className="py-2 pr-3">{hoja.nombre}</td>
                <td className="py-2 pr-3 text-xs text-muted-foreground">
                  {hoja.origen === "digital" ? "Digital" : "Físico"}
                </td>
                <td className="py-2 text-xs">
                  {hoja.sugerido
                    ? <span className="text-amber-700 dark:text-amber-400">Sugerido</span>
                    : <span className="text-emerald-700 dark:text-emerald-400">Confirmado</span>}
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------
// Hoja de faltante
// ------------------------------------------------------------

/**
 * Abre una ventana de impresión con una hoja en blanco que dice qué
 * documento falta. Esa hoja se mete físicamente en el hueco de la
 * carpeta, para que quien la abra vea qué le falta sin entrar al sistema.
 */
function imprimirHojaPendiente(nombreDocumento: string) {
  const v = window.open("", "_blank", "width=800,height=1000");
  if (!v) return;
  v.document.write(`
    <html><head><title>Pendiente — ${nombreDocumento}</title>
    <style>
      body { font-family: Helvetica, Arial, sans-serif; margin: 0; padding: 60px; }
      .marco { border: 3px dashed #A32D2D; border-radius: 12px; padding: 60px 40px; text-align: center; }
      .etiqueta { font-size: 13px; letter-spacing: 3px; color: #A32D2D; }
      .nombre { font-size: 34px; font-weight: bold; color: #042C53; margin: 24px 0; }
      .nota { font-size: 14px; color: #666; line-height: 1.6; }
    </style></head>
    <body onload="window.print()">
      <div class="marco">
        <p class="etiqueta">DOCUMENTO PENDIENTE</p>
        <p class="nombre">${nombreDocumento}</p>
        <p class="nota">
          Esta hoja ocupa el lugar del documento faltante.<br/>
          Al integrarlo a la carpeta, retira esta hoja y regístralo en el sistema.
        </p>
      </div>
    </body></html>
  `);
  v.document.close();
}
