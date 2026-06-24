import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { sbSelect, type CasoJuridico } from "@/lib/supabase";
import { RobotBoletines } from "@/components/robot-boletines";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Swords, ShieldAlert, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/control-demandas")({
  head: () => ({ meta: [{ title: "Control de demandas — JusticiaFácil" }] }),
  component: ControlDemandasPage,
});

function riesgoDe(c: CasoJuridico): "alto" | "medio" | "bajo" {
  const t = `${c.estatus_general || ""} ${c.nota_adicional || ""} ${c.etapa_actual || ""}`.toLowerCase();
  if (/prescri|caduc|en contra|negativo|improceden/.test(t)) return "alto";
  if ((c.estatus_general || "").toLowerCase().includes("positivo")) return "bajo";
  if ((c.prioridad || "").toUpperCase() === "ALTA") return "alto";
  if ((c.prioridad || "").toUpperCase() === "BAJA") return "bajo";
  return "medio";
}

function riesgoClase(r: string) {
  if (r === "alto") return "bg-red-100 text-red-700";
  if (r === "medio") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

function ControlDemandasPage() {
  const [casos, setCasos] = useState<CasoJuridico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [riesgo, setRiesgo] = useState("todos");

  useEffect(() => {
    sbSelect<CasoJuridico>("caso_juridico", "select=*&order=created_at.asc")
      .then((d) => setCasos(d))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const conRiesgo = useMemo(() => casos.map((c) => ({ c, r: riesgoDe(c) })), [casos]);

  const filtrados = useMemo(() => {
    return conRiesgo.filter(({ c, r }) => {
      if (riesgo !== "todos" && r !== riesgo) return false;
      if (!q) return true;
      const blob = `${c.expediente || ""} ${c.cliente_nombre || ""} ${c.juzgado || ""}`.toLowerCase();
      return blob.includes(q.toLowerCase());
    });
  }, [conRiesgo, q, riesgo]);

  const alto = conRiesgo.filter((x) => x.r === "alto").length;
  const bajo = conRiesgo.filter((x) => x.r === "bajo").length;
  const expedientes = casos.map((c) => c.expediente);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procesal"
        title="Control de demandas"
        description={cargando ? "Cargando demandas…" : `${filtrados.length} de ${casos.length} demandas · DIIPA como actor (cesionario).`}
      />

      {/* Barra del robot */}
      <RobotBoletines expedientes={expedientes} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="legal-card p-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-[color:var(--teal)]/10 text-[color:var(--teal)]"><Swords className="h-5 w-5" /></div>
          <div><p className="text-2xl font-bold font-display leading-none">{casos.length}</p><p className="text-xs text-muted-foreground">Demandas</p></div>
        </Card>
        <Card className="legal-card p-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-red-100 text-red-700"><ShieldAlert className="h-5 w-5" /></div>
          <div><p className="text-2xl font-bold font-display leading-none">{alto}</p><p className="text-xs text-muted-foreground">Riesgo alto</p></div>
        </Card>
        <Card className="legal-card p-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-100 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div>
          <div><p className="text-2xl font-bold font-display leading-none">{bajo}</p><p className="text-xs text-muted-foreground">Riesgo bajo</p></div>
        </Card>
      </div>

      <Card className="legal-card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Expediente, cliente, juzgado…" className="pl-8" />
          </div>
          <select value={riesgo} onChange={(e) => setRiesgo(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="todos">Todo riesgo</option>
            <option value="alto">Riesgo alto</option>
            <option value="medio">Riesgo medio</option>
            <option value="bajo">Riesgo bajo</option>
          </select>
        </div>
      </Card>

      {error && (
        <Card className="legal-card p-4 border-red-200 bg-red-50 text-sm text-red-700">No se pudieron cargar: {error}</Card>
      )}

      <Card className="legal-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Expediente / Cliente</th>
                <th className="text-left px-4 py-2.5">Posición DIIPA</th>
                <th className="text-left px-4 py-2.5">Juzgado</th>
                <th className="text-left px-4 py-2.5">Riesgo de pérdida</th>
                <th className="text-left px-4 py-2.5">Motivo / nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map(({ c, r }) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[color:var(--teal)]">{c.expediente || "— sin expediente —"}</p>
                    <p className="text-xs text-muted-foreground">{c.cliente_nombre || c.tiene_cliente || ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">Actor (cesionario)</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-[240px] truncate" title={c.juzgado || ""}>{c.juzgado || "—"}</p>
                    <p className="text-xs text-muted-foreground">{c.entidad || ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${riesgoClase(r)}`}>{r}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <p className="max-w-[280px] truncate" title={c.nota_adicional || ""}>{c.nota_adicional || c.estatus_general || "—"}</p>
                  </td>
                </tr>
              ))}
              {!cargando && filtrados.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Sin resultados.</td></tr>
              )}
              {cargando && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
