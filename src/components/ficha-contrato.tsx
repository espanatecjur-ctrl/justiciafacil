// ============================================================================
//  Ficha del contrato (Parte 5)
//  --------------------------------------------------------------------------
//  Vista de SOLO LECTURA que se abre desde los 3 puntitos de la tabla de
//  contratos. Muestra quién solicitó, qué contrato es, el folio, las fechas,
//  las partes, testigos, beneficiarios y los vínculos. NO se edita: para
//  cambiar algo se usa "Reelaborar" (se genera de nuevo).
// ============================================================================
import { X, Eye, PenLine } from "lucide-react";
import type { ContratoGenerado } from "@/lib/contrato-generado";

const fmtFecha = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : null;

const t = (x: unknown) => (x === undefined || x === null || String(x).trim() === "" ? null : String(x));

/** Renglón etiqueta + valor. No se dibuja si el valor está vacío. */
function Dato({ etiqueta, valor }: { etiqueta: string; valor: unknown }) {
  const v = t(valor);
  if (!v) return null;
  return (
    <div className="flex gap-2 py-0.5 text-sm">
      <span className="w-40 shrink-0 text-muted-foreground">{etiqueta}</span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{v}</span>
    </div>
  );
}

/** Sección con título; no se dibuja si no tiene hijos visibles. */
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-3">
      <p className="mb-1 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function FichaContrato({
  c,
  onClose,
  onReelaborar,
}: {
  c: ContratoGenerado;
  onClose: () => void;
  onReelaborar?: () => void;
}) {
  const v = (c.valores ?? {}) as Record<string, unknown>;
  const arr = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? (x as Record<string, unknown>[]) : []);

  const testigos = arr(v.testigos);
  const beneficiarios = arr(v.beneficiarios);
  const clientesV = arr(v.clientesVinculados);
  const garantiasV = arr(v.garantiasVinculadas);

  const esCasado = v.estadoCivilCliente === "casado(a)";
  const porApoderado = v.clienteComparecePorApoderado === true;

  const nombreCliente = t(v.nombreCliente) ?? t(c.nombre_cliente);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={onClose}>
      <div
        className="w-full max-w-5xl rounded-lg border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                <Eye className="h-3 w-3" /> Solo lectura
              </span>
              <span className="font-mono text-xs font-semibold">{t(c.folio) ?? "sin folio"}</span>
              {t(c.estado) && <span className="text-[11px] text-muted-foreground">· {c.estado}</span>}
            </div>
            <h2 className="font-display text-base font-bold leading-tight">{t(c.nombre_documento) ?? t(c.titulo) ?? "Contrato"}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted" title="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[82vh] space-y-3 overflow-y-auto p-4">
          {/* Encabezado administrativo */}
          <div className="space-y-0.5">
            <Dato etiqueta="Elaborado" valor={fmtFecha(c.fecha_generado)} />
            <Dato etiqueta="Enviado por correo" valor={fmtFecha(c.fecha_enviado)} />
            <Dato etiqueta="Solicitado por" valor={v.solicitadoPor} />
            <Dato etiqueta="A nombre de / para" valor={v.aNombreDe} />
          </div>

          {/* Cliente */}
          {(nombreCliente || t(v.curpCliente) || t(v.telefonoCliente)) && (
            <Seccion titulo="Cliente">
              <Dato etiqueta="Nombre" valor={nombreCliente} />
              <Dato etiqueta="CURP" valor={v.curpCliente} />
              <Dato etiqueta="RFC" valor={v.rfcCliente} />
              <Dato etiqueta="Domicilio" valor={v.domicilioCliente} />
              <Dato etiqueta="Teléfono" valor={v.telefonoCliente} />
              <Dato etiqueta="Correo" valor={v.correoCliente} />
              <Dato etiqueta="Estado civil" valor={v.estadoCivilCliente} />
              {esCasado && <Dato etiqueta="Régimen" valor={v.regimenCliente} />}
              {esCasado && <Dato etiqueta="Cónyuge" valor={v.conyugeCliente} />}
              {porApoderado && <Dato etiqueta="Comparece por apoderado" valor={v.nombreApoderadoCliente} />}
              {porApoderado && <Dato etiqueta="Poder del apoderado" valor={v.poderApoderadoCliente} />}
            </Seccion>
          )}

          {/* Apoderado DIIPA */}
          {t(c.apoderado) && (
            <Seccion titulo="Representante DIIPA">
              <Dato etiqueta="Apoderado" valor={c.apoderado} />
              <Dato etiqueta="Cargo" valor={v.apoderadoCargo} />
            </Seccion>
          )}

          {/* Garantía / operación */}
          {(t(v.direccionGarantia) || t(v.garantiaNueva) || t(v.valorOperacion) || t(v.folioGarantia)) && (
            <Seccion titulo="Garantía / operación">
              <Dato etiqueta="Garantía" valor={v.direccionGarantia} />
              <Dato etiqueta="Garantía nueva" valor={v.garantiaNueva} />
              <Dato etiqueta="Folio de garantía" valor={v.folioGarantia} />
              <Dato etiqueta="Valor de la operación" valor={v.valorOperacion} />
              <Dato etiqueta="Modalidad de cierre" valor={v.modalidadCierre} />
            </Seccion>
          )}

          {/* Garantías vinculadas */}
          {garantiasV.length > 0 && (
            <Seccion titulo={`Garantías vinculadas (${garantiasV.length})`}>
              {garantiasV.map((g, i) => (
                <div key={i} className="py-0.5 text-sm">
                  {i + 1}. Exp. {t(g.expediente) ?? "—"}
                  {t(g.area) ? ` · Área: ${g.area}` : ""}
                  {t(g.direccion) ? ` · ${g.direccion}` : ""}
                  {t(g.origen) === "manual" ? " · (manual)" : ""}
                </div>
              ))}
            </Seccion>
          )}

          {/* Clientes vinculados */}
          {clientesV.length > 0 && (
            <Seccion titulo={`Clientes vinculados (${clientesV.length})`}>
              {clientesV.map((cl, i) => (
                <div key={i} className="py-0.5 text-sm">
                  {i + 1}. {t(cl.nombre) ?? "—"}
                  {t(cl.folio) ? ` · ${cl.folio}` : ""}
                  {t(cl.origen) === "manual" ? " · (manual)" : ""}
                </div>
              ))}
            </Seccion>
          )}

          {/* Testigos */}
          {testigos.length > 0 && (
            <Seccion titulo={`Testigos (${testigos.length})`}>
              {testigos.map((tg, i) => (
                <div key={i} className="py-0.5 text-sm">
                  {i + 1}. {t(tg.nombre) ?? "—"}
                  {t(tg.identificacion) ? ` · ${tg.identificacion}` : ""}
                </div>
              ))}
            </Seccion>
          )}

          {/* Beneficiarios */}
          {beneficiarios.length > 0 && (
            <Seccion titulo={`Beneficiarios (${beneficiarios.length})`}>
              {beneficiarios.map((b, i) => (
                <div key={i} className="py-0.5 text-sm">
                  {i + 1}. {t(b.nombre) ?? "—"}
                  {t(b.parentesco) ? ` · ${b.parentesco}` : ""}
                  {t(b.telefono) ? ` · Tel. ${b.telefono}` : ""}
                  {t(b.participacion) ? ` · ${b.participacion}%` : ""}
                </div>
              ))}
            </Seccion>
          )}

          {/* Documento completo */}
          {t(c.cuerpo) && (
            <Seccion titulo="Documento generado">
              <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 font-sans text-sm leading-relaxed">
                {c.cuerpo}
              </pre>
            </Seccion>
          )}
        </div>

        {/* Pie */}
        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <p className="text-[11px] text-muted-foreground">Esta ficha no se edita. Para cambiar algo, usa Reelaborar.</p>
          <div className="flex gap-2">
            {onReelaborar && (
              <button
                onClick={onReelaborar}
                className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <PenLine className="h-3.5 w-3.5" /> Reelaborar
              </button>
            )}
            <button onClick={onClose} className="rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
