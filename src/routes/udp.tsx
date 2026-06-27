import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { sbSelect } from "@/lib/supabase";
import { RobotBoletines } from "@/components/robot-boletines";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, ShieldAlert, Scale, Handshake } from "lucide-react";

export const Route = createFileRoute("/udp")({
  head: () => ({ meta: [{ title: "UDP · Defensa y Protección — JusticiaFácil" }] }),
  component: UdpPage,
});

interface CasoUdp {
  id: string;
  tipo: string | null;
  folio: string | null;
  sede: string | null;
  cliente: string | null;
  contraparte: string | null;
  cantidad: string | null;
  expediente: string | null;
  tipo_juicio: string | null;
  juzgado: string | null;
  fecha_audiencia: string | null;
  abogado: string | null;
  convenio: string | null;
  adeudo: string | null;
  estatus: string | null;
  nota: string | null;
  posicion: string | null;
}

const TABS = [
  { key: "DENUNCIA_PENAL", label: "Penal", icon: ShieldAlert },
  { key: "QUEJA_PROFECO", label: "PROFECO", icon: Scale },
  { key: "CONVENIO_PENAL", label: "Convenios", icon: Handshake },
];

function posClase(p: string | null) {
  const v = (p || "").toLowerCase();
  if (v === "actor") return "bg-blue-100 text-blue-700";
  if (v === "demandado") return "bg-red-100 text-red-700";
  if (v === "apoderado") return "bg-violet-100 text-violet-700";
  return "bg-muted text-muted-foreground";
}

function UdpPage() {
  const [datos, setDatos] = useState<CasoUdp[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("DENUNCIA_PENAL");
  const [q, setQ] = useState("");
  const [soloApoderado, setSoloApoderado] = useState(false);

  useEffect(() => {
    sbSelect<CasoUdp>("caso_udp", "select=*&order=folio.asc")
      .then((d) => setDatos(d))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const delTab = useMemo(() => datos.filter((d) => d.tipo === tab), [datos, tab]);

  const filtrados = useMemo(() => {
    return delTab.filter((d) => {
      if (soloApoderado && (d.posicion || "").toLowerCase() !== "apoderado") return false;
      if (!q) return true;
      const blob = `${d.folio || ""} ${d.cliente || ""} ${d.contraparte || ""} ${d.expediente || ""}`.toLowerCase();
      return blob.includes(q.toLowerCase());
    });
  }, [delTab, q, soloApoderado]);

  const cuenta = (k: string) => datos.filter((d) => d.tipo === k).length;
  const expedientes = datos.map((d) => d.expediente);
  const esConvenio = tab === "CONVENIO_PENAL";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Unidad de Defensa y Protección"
        title="UDP · Defensa y Protección"
        description="Denuncias penales, quejas PROFECO y convenios — defensa de la empresa y de clientes que contratan el servicio."
      />

      {/* Barra del robot (mismo indicador central que en los demás módulos) */}
      <RobotBoletines expedientes={expedientes} />

      {/* Pestañas */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSoloApoderado(false); }}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium border transition-colors ${
              tab === t.key
                ? "bg-[#0B1E3A] text-white border-[#0B1E3A]"
                : "bg-background text-muted-foreground border-input hover:bg-muted"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            <span className={`rounded-full px-1.5 text-[11px] ${tab === t.key ? "bg-white/20" : "bg-muted"}`}>{cuenta(t.key)}</span>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <Card className="legal-card p-4">
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Folio, cliente, contraparte, expediente…" className="pl-8" />
          </div>
          {!esConvenio && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={soloApoderado} onChange={(e) => setSoloApoderado(e.target.checked)} />
              Solo como apoderado (representación a terceros)
            </label>
          )}
        </div>
      </Card>

      {error && (
        <Card className="legal-card p-4 border-red-200 bg-red-50 text-sm text-red-700">No se pudo cargar UDP: {error}</Card>
      )}

      {/* Tabla */}
      <Card className="legal-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Folio / Cliente</th>
                {!esConvenio && <th className="text-left px-4 py-2.5">Posición</th>}
                <th className="text-left px-4 py-2.5">Contraparte</th>
                <th className="text-left px-4 py-2.5">{esConvenio ? "Convenio" : "Expediente / Autoridad"}</th>
                <th className="text-left px-4 py-2.5">{esConvenio ? "Adeudo" : "Audiencia"}</th>
                <th className="text-left px-4 py-2.5">Estatus / Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[color:var(--teal)]">{d.folio || "—"}</p>
                    <p className="text-xs text-muted-foreground">{d.cliente || ""}{d.sede ? ` · ${d.sede}` : ""}</p>
                  </td>
                  {!esConvenio && (
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${posClase(d.posicion)}`}>{d.posicion || "—"}</span>
                    </td>
                  )}
                  <td className="px-4 py-3">{d.contraparte || "—"}</td>
                  <td className="px-4 py-3">
                    {esConvenio ? (
                      <p className="max-w-[280px] truncate" title={d.convenio || ""}>{d.convenio || "—"}</p>
                    ) : (
                      <>
                        <p className="font-mono text-xs">{d.expediente || "—"}</p>
                        <p className="text-xs text-muted-foreground max-w-[240px] truncate" title={d.juzgado || ""}>{d.juzgado || ""}</p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{esConvenio ? (d.adeudo || "—") : (d.fecha_audiencia || "—")}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <p className="max-w-[280px] truncate" title={d.estatus || d.nota || ""}>{d.estatus || d.nota || "—"}</p>
                  </td>
                </tr>
              ))}
              {!cargando && filtrados.length === 0 && (
                <tr><td colSpan={esConvenio ? 5 : 6} className="px-4 py-8 text-center text-muted-foreground">Sin resultados.</td></tr>
              )}
              {cargando && (
                <tr><td colSpan={esConvenio ? 5 : 6} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
