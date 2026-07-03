// ============================================================================
//  Vínculo de registros (Parte 4)
//  --------------------------------------------------------------------------
//  Busca y vincula CLIENTES (desde JurisConecta) y GARANTÍAS (desde
//  caso_juridico / SIGA). Permite vincular VARIOS y también AGREGAR MANUAL
//  cuando el registro no está en el sistema. Cada garantía lleva su ÁREA.
//  El valor es un arreglo de objetos que se guarda en los `valores` del
//  contrato y se imprime en el documento cuando aplica.
// ============================================================================
import { useState } from "react";
import { Search, Plus, X } from "lucide-react";
import { buscarClientesJC } from "@/lib/juris-clientes";
import { listarCasosVinculables } from "@/lib/formalizacion";

type Fila = Record<string, unknown>;
const AREAS = ["URRJ", "UCP", "UCM", "UFC"];

export function VinculoRegistros({
  fuente,
  valor,
  onChange,
}: {
  fuente: "clientes" | "garantias";
  valor: unknown;
  onChange: (v: Fila[]) => void;
}) {
  const filas: Fila[] = Array.isArray(valor) ? (valor as Fila[]) : [];
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<Fila[]>([]);
  const [sinResultados, setSinResultados] = useState(false);

  const setFilas = (nuevo: Fila[]) => onChange(nuevo);
  const quitar = (i: number) => setFilas(filas.filter((_, j) => j !== i));
  const editar = (i: number, campo: string, v: unknown) => {
    const copia = filas.map((f) => ({ ...f }));
    copia[i] = { ...copia[i], [campo]: v };
    setFilas(copia);
  };
  const yaVinculado = (id: unknown) => !!id && filas.some((f) => f.id === id);

  async function buscar() {
    const q = texto.trim();
    if (!q) return;
    setBuscando(true);
    setSinResultados(false);
    try {
      if (fuente === "clientes") {
        const cs = await buscarClientesJC(q);
        setResultados(
          cs.map((c) => ({ id: c.id, nombre: c.nombre ?? "", folio: c.folio ?? "", curp_rfc: c.curp_rfc ?? "", origen: "juris" })),
        );
        setSinResultados(cs.length === 0);
      } else {
        const qn = q.toLowerCase();
        const casos = await listarCasosVinculables();
        const filtrados = casos
          .filter((c) =>
            [c.expediente, c.cliente_nombre, c.direccion_garantia].some((v) => (v ?? "").toLowerCase().includes(qn)),
          )
          .slice(0, 25)
          .map((c) => ({
            id: c.id,
            expediente: c.expediente ?? "",
            direccion: c.direccion_garantia ?? "",
            cliente_nombre: c.cliente_nombre ?? "",
            area: "",
            origen: "sistema",
          }));
        setResultados(filtrados);
        setSinResultados(filtrados.length === 0);
      }
    } catch {
      setResultados([]);
      setSinResultados(true);
    }
    setBuscando(false);
  }

  const agregarManual = () => {
    setFilas([...filas, fuente === "clientes" ? { nombre: "", folio: "", origen: "manual" } : { expediente: "", direccion: "", area: "", origen: "manual" }]);
  };

  return (
    <div className="space-y-2">
      {/* Buscador */}
      <div className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscar())}
          placeholder={fuente === "clientes" ? "Buscar por nombre, RFC/CURP, folio o teléfono…" : "Buscar por expediente, cliente o dirección…"}
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={buscar}
          disabled={buscando}
          className="inline-flex items-center gap-1 rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
        >
          <Search className="h-3.5 w-3.5" /> {buscando ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {/* Resultados de la búsqueda */}
      {resultados.length > 0 && (
        <div className="max-h-52 space-y-1 overflow-auto rounded-md border border-border p-1.5">
          {resultados.map((r) => (
            <div key={String(r.id)} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50">
              <span className="min-w-0 truncate">
                {fuente === "clientes"
                  ? `${r.nombre || "(sin nombre)"}${r.folio ? ` · ${r.folio}` : ""}${r.curp_rfc ? ` · ${r.curp_rfc}` : ""}`
                  : `Exp. ${r.expediente || "—"} · ${r.cliente_nombre || "—"}${r.direccion ? ` · ${r.direccion}` : ""}`}
              </span>
              <button
                type="button"
                disabled={yaVinculado(r.id)}
                onClick={() => setFilas([...filas, { ...r }])}
                className="shrink-0 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                {yaVinculado(r.id) ? "Vinculado" : "Vincular"}
              </button>
            </div>
          ))}
        </div>
      )}
      {sinResultados && <p className="rounded-md bg-muted/40 p-2 text-center text-[11px] text-muted-foreground">Sin resultados. Puedes agregarlo manual.</p>}

      {/* Vinculados */}
      {filas.length > 0 && (
        <div className="space-y-1.5">
          {filas.map((f, i) => (
            <div key={i} className="rounded-md border border-border bg-muted/20 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  {fuente === "clientes" ? (
                    f.origen === "manual" ? (
                      <div className="grid gap-1 sm:grid-cols-2">
                        <input value={String(f.nombre ?? "")} onChange={(e) => editar(i, "nombre", e.target.value)} placeholder="Nombre del cliente" className="rounded border border-input bg-background px-2 py-1 text-xs" />
                        <input value={String(f.folio ?? "")} onChange={(e) => editar(i, "folio", e.target.value)} placeholder="Folio (opcional)" className="rounded border border-input bg-background px-2 py-1 text-xs" />
                      </div>
                    ) : (
                      <p className="truncate text-xs font-medium">{String(f.nombre || "(sin nombre)")}{f.folio ? ` · ${f.folio}` : ""}</p>
                    )
                  ) : (
                    <>
                      {f.origen === "manual" ? (
                        <div className="grid gap-1 sm:grid-cols-2">
                          <input value={String(f.expediente ?? "")} onChange={(e) => editar(i, "expediente", e.target.value)} placeholder="Expediente" className="rounded border border-input bg-background px-2 py-1 text-xs" />
                          <input value={String(f.direccion ?? "")} onChange={(e) => editar(i, "direccion", e.target.value)} placeholder="Dirección de la garantía" className="rounded border border-input bg-background px-2 py-1 text-xs" />
                        </div>
                      ) : (
                        <p className="truncate text-xs font-medium">Exp. {String(f.expediente || "—")}{f.direccion ? ` · ${f.direccion}` : ""}</p>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">Área:</span>
                        <select value={String(f.area ?? "")} onChange={(e) => editar(i, "area", e.target.value)} className="rounded border border-input bg-background px-1.5 py-0.5 text-[11px]">
                          <option value="">—</option>
                          {AREAS.map((a) => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <button type="button" onClick={() => quitar(i)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-600" title="Quitar">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={agregarManual} className="inline-flex items-center gap-1 rounded-md border border-dashed border-input px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-muted">
        <Plus className="h-3.5 w-3.5" /> Agregar manual
      </button>
    </div>
  );
}
