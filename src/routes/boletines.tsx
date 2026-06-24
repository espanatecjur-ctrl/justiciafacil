import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { boletines } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export const Route = createFileRoute("/boletines")({
  head: () => ({ meta: [{ title: "Boletines Judiciales — SIGA-DIIPA" }] }),
  component: Boletines,
});

function Boletines() {
  const [q, setQ] = useState("");
  const [entidad, setEntidad] = useState("todas");

  const entidades = Array.from(new Set(boletines.map((b) => b.entidad)));
  const filtrados = useMemo(() =>
    boletines.filter((b) => {
      if (entidad !== "todas" && b.entidad !== entidad) return false;
      if (!q) return true;
      return `${b.expediente} ${b.juzgado} ${b.sintesis}`.toLowerCase().includes(q.toLowerCase());
    }), [q, entidad]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procesal"
        title="Boletines Judiciales"
        description="Publicaciones diarias de juzgados estatales y federales. Conectores configurables."
      />

      <Card className="legal-card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Expediente, juzgado, síntesis…" className="pl-8" />
          </div>
          <select value={entidad} onChange={(e) => setEntidad(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="todas">Todas las entidades</option>
            {entidades.map((en) => <option key={en} value={en}>{en}</option>)}
          </select>
        </div>
      </Card>

      <div className="space-y-3">
        {filtrados.map((b) => (
          <Card key={b.id} className="legal-card">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="font-display text-base font-bold text-[color:var(--teal)]">{b.expediente} — {b.tipoAcuerdo}</p>
                  <p className="text-xs text-muted-foreground">{b.juzgado} · {b.entidad}</p>
                </div>
                <time className="text-xs text-muted-foreground tabular-nums">{b.fecha}</time>
              </div>
              <p className="mt-2 text-sm">{b.sintesis}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
