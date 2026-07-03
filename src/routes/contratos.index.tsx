import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { plantillas } from "@/lib/contract-templates";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Loader2, MoreVertical, PenLine, Archive, Trash2, Eye } from "lucide-react";
import { FichaContrato } from "@/components/ficha-contrato";
import { SolicitudesContratoTabla } from "@/components/solicitudes-contrato-tabla";
import { listarContratos, actualizarEstadoContrato, type ContratoGenerado } from "@/lib/contrato-generado";
import { listarEnvios, type EnvioRegistro } from "@/lib/enviar-correo";

export const Route = createFileRoute("/contratos/")({
  head: () => ({ meta: [{ title: "Contratos — SIGA-DIIPA" }] }),
  component: ContratosIndex,
});

const estadoTono: Record<string, string> = {
  generado: "bg-emerald-100 text-emerald-900",
  archivado: "bg-slate-100 text-slate-800",
  papelera: "bg-red-100 text-red-900",
};

function fmtFecha(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function ContratosIndex() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Documentos"
        title="Contratos"
        description="Repositorio de contratos generados, guardados y plantillas auto-llenables."
        actions={
          <Link to="/contratos/editor">
            <Button className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
              <Plus className="h-4 w-4 mr-1.5" /> Nuevo contrato
            </Button>
          </Link>
        }
      />

      <div>
        <h2 className="font-display text-lg font-bold mb-3">Plantillas disponibles</h2>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          {plantillas.map((p) => (
            <Link
              key={p.tipo}
              to="/contratos/editor"
              search={{ tipo: p.tipo }}
              className="legal-card group p-4 transition hover:border-[color:var(--teal)] hover:shadow-md"
            >
              <FileText className="h-6 w-6 text-[color:var(--teal)] mb-2" />
              <p className="font-display font-bold text-sm leading-tight group-hover:text-[color:var(--teal)]">{p.nombre}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.descripcion}</p>
            </Link>
          ))}
        </div>
      </div>

      <SolicitudesContratoTabla />

      <ContratosExistentes />
    </div>
  );
}

function ContratosExistentes() {
  const [lista, setLista] = useState<ContratoGenerado[]>([]);
  const [envios, setEnvios] = useState<Record<string, EnvioRegistro>>({});
  const [cargando, setCargando] = useState(true);

  const recargar = () => {
    setCargando(true);
    listarContratos("generado").then(setLista).finally(() => setCargando(false));
    listarEnvios().then((arr) => {
      // envíos vienen del más reciente al más viejo: el primero por folio es el último envío
      const mapa: Record<string, EnvioRegistro> = {};
      for (const e of arr) if (e.folio && !mapa[e.folio]) mapa[e.folio] = e;
      setEnvios(mapa);
    });
  };
  useEffect(recargar, []);

  return (
    <div>
      <h2 className="font-display text-lg font-bold mb-3">Contratos existentes</h2>
      <Card className="legal-card overflow-hidden">
        {cargando ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : lista.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Aún no hay contratos guardados. Genera uno en el Editor y pícale “Guardar”.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5">Folio</th>
                  <th className="text-left px-4 py-2.5">Documento</th>
                  <th className="text-left px-4 py-2.5">Cliente</th>
                  <th className="text-left px-4 py-2.5">Firma (apoderado)</th>
                  <th className="text-left px-4 py-2.5">Fecha</th>
                  <th className="text-left px-4 py-2.5">Cuantía</th>
                  <th className="text-left px-4 py-2.5">Estado</th>
                  <th className="text-left px-4 py-2.5">Correo</th>
                  <th className="text-right px-4 py-2.5">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lista.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{c.folio || "—"}</td>
                    <td className="px-4 py-3">{c.nombre_documento || "—"}</td>
                    <td className="px-4 py-3">{c.nombre_cliente || "—"}</td>
                    <td className="px-4 py-3 text-xs">{c.apoderado || "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-xs">{fmtFecha(c.fecha_generado || c.created_at)}</td>
                    <td className="px-4 py-3 tabular-nums">{c.cuantia ? `$ ${Number(c.cuantia).toLocaleString("es-MX")}` : "—"}</td>
                    <td className="px-4 py-3"><Badge className={`capitalize ${estadoTono[c.estado || "generado"] || ""}`}>{c.estado || "generado"}</Badge></td>
                    <td className="px-4 py-3">
                      {(() => {
                        const e = c.folio ? envios[c.folio] : undefined;
                        if (!e) return <span className="text-xs text-muted-foreground">—</span>;
                        if (e.estado === "abierto") {
                          const t = e.abierto_at ? new Date(e.abierto_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
                          return <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800" title={`Abierto ${t}`}>Abierto ✓</span>;
                        }
                        return <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">Enviado</span>;
                      })()}
                      {c.fecha_enviado && (
                        <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">Enviado: {fmtFecha(c.fecha_enviado)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right"><MenuAcciones c={c} onCambio={recargar} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function MenuAcciones({ c, onCambio }: { c: ContratoGenerado; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [verFicha, setVerFicha] = useState(false);
  const navigate = useNavigate();

  const reelaborar = () => {
    // Guarda los datos para que el Editor los cargue y navega allá.
    sessionStorage.setItem("reelaborar_contrato", JSON.stringify({ tipo: c.tipo, valores: c.valores ?? {} }));
    navigate({ to: "/contratos/editor", search: c.tipo ? { tipo: c.tipo } : {} });
  };
  const cambiarEstado = async (estado: string) => {
    setAbierto(false);
    if (c.id) { await actualizarEstadoContrato(c.id, estado); onCambio(); }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="rounded-md p-1.5 hover:bg-muted"
        title="Acciones"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-border bg-white py-1 shadow-lg">
            <button onClick={() => { setAbierto(false); setVerFicha(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
              <Eye className="h-3.5 w-3.5" /> Ver ficha
            </button>
            <button onClick={reelaborar} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
              <PenLine className="h-3.5 w-3.5" /> Reelaborar
            </button>
            <button onClick={() => cambiarEstado("archivado")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
              <Archive className="h-3.5 w-3.5" /> Archivar
            </button>
            <button onClick={() => cambiarEstado("papelera")} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" /> Mover a papelera
            </button>
          </div>
        </>
      )}
      {verFicha && (
        <FichaContrato
          c={c}
          onClose={() => setVerFicha(false)}
          onReelaborar={() => { setVerFicha(false); reelaborar(); }}
        />
      )}
    </div>
  );
}
