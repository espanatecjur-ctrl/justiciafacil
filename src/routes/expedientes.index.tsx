import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { EstadoBadge, RiesgoBadge } from "@/components/legal-badges";
import { expedientes } from "@/lib/mock-data";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/expedientes/")({
  head: () => ({ meta: [{ title: "Expedientes — SIGA-DIIPA" }] }),
  component: ExpedientesPage,
});

function ExpedientesPage() {
  const [q, setQ] = useState("");
  const [materia, setMateria] = useState<string>("todas");
  const [fuero, setFuero] = useState<string>("todos");

  const filtrados = useMemo(() => {
    return expedientes.filter((e) => {
      if (materia !== "todas" && e.materia !== materia) return false;
      if (fuero !== "todos" && e.fuero !== fuero) return false;
      if (!q) return true;
      const blob = `${e.numero} ${e.juzgado} ${e.tipoJuicio} ${e.partes.map((p) => p.nombre).join(" ")}`.toLowerCase();
      return blob.includes(q.toLowerCase());
    });
  }, [q, materia, fuero]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Núcleo procesal"
        title="Expedientes"
        description="Búsqueda y seguimiento de juicios — todas las materias, fueros y estados procesales."
        actions={
          <Button className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Nuevo expediente
          </Button>
        }
      />

      <Card className="legal-card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número, parte, juzgado…" className="pl-8" />
          </div>
          <select value={materia} onChange={(e) => setMateria(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="todas">Todas las materias</option>
            <option value="civil">Civil</option>
            <option value="mercantil">Mercantil</option>
            <option value="familiar">Familiar</option>
            <option value="penal">Penal</option>
            <option value="laboral">Laboral</option>
            <option value="amparo">Amparo</option>
            <option value="administrativo">Administrativo</option>
            <option value="fiscal">Fiscal</option>
            <option value="agrario">Agrario</option>
          </select>
          <select value={fuero} onChange={(e) => setFuero(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="todos">Todos los fueros</option>
            <option value="federal">Federal</option>
            <option value="estatal">Estatal</option>
            <option value="municipal">Municipal</option>
          </select>
        </div>
      </Card>

      <Card className="legal-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Expediente</th>
                <th className="text-left px-4 py-2.5">Materia / Tipo</th>
                <th className="text-left px-4 py-2.5">Juzgado</th>
                <th className="text-left px-4 py-2.5">Estado</th>
                <th className="text-left px-4 py-2.5">Riesgo</th>
                <th className="text-left px-4 py-2.5">Última actuación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to="/expedientes/$id" params={{ id: e.id }} className="font-semibold text-[color:var(--teal)] hover:underline">
                      {e.numero}
                    </Link>
                    <p className="text-xs text-muted-foreground">{e.partes[0]?.nombre}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="capitalize font-medium">{e.materia}</p>
                    <p className="text-xs text-muted-foreground">{e.tipoJuicio}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{e.juzgado}</p>
                    <p className="text-xs text-muted-foreground capitalize">{e.fuero} · {e.entidad}</p>
                  </td>
                  <td className="px-4 py-3"><EstadoBadge estado={e.estado} /></td>
                  <td className="px-4 py-3"><RiesgoBadge riesgo={e.riesgo} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{e.ultimaActuacion}</td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Sin resultados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
