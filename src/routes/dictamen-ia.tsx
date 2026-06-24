import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { expedientes, dictamenes } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Caracter, DictamenIA } from "@/lib/legal-types";

export const Route = createFileRoute("/dictamen-ia")({
  head: () => ({ meta: [{ title: "Robot Pre-Dictaminador — SIGA-DIIPA" }] }),
  component: DictamenPage,
});

const caracteres: Caracter[] = ["actor", "demandado", "tercero", "sucesorio", "imputado", "victima", "garante", "fiador", "apoderado"];

function DictamenPage() {
  const [expId, setExpId] = useState(expedientes[0].id);
  const [caracter, setCaracter] = useState<Caracter>("actor");
  const [calculando, setCalculando] = useState(false);
  const [resultado, setResultado] = useState<DictamenIA | null>(dictamenes[0]);

  const exp = expedientes.find((e) => e.id === expId)!;

  function ejecutar() {
    setCalculando(true);
    setResultado(null);
    setTimeout(() => {
      // Heurística simulada para demo
      const base = exp.riesgo === "bajo" ? 75 : exp.riesgo === "medio" ? 58 : exp.riesgo === "alto" ? 38 : 22;
      const ajuste = caracter === "actor" ? 6 : caracter === "demandado" ? -4 : 0;
      const prob = Math.max(8, Math.min(95, base + ajuste + Math.floor(Math.random() * 10) - 5));
      setResultado({
        id: `d-${Date.now()}`,
        expedienteId: exp.id,
        fecha: new Date().toISOString().slice(0, 10),
        probabilidadExito: prob,
        caracter,
        resumen: `Análisis preliminar para ${exp.numero} en carácter de ${caracter}. Materia ${exp.materia}, etapa ${exp.estado}. Riesgo procesal: ${exp.riesgo}.`,
        riesgos: [
          "Plazos procesales próximos",
          "Posibles excepciones de la contraparte",
          "Costos por desahogo de pruebas adicionales",
        ],
        recomendaciones: [
          "Reforzar prueba documental",
          "Preparar testigos y peritos",
          caracter === "actor" ? "Solicitar medidas cautelares" : "Plantear excepciones perentorias",
        ],
        precedentes: [
          { tesis: "1a./J. 45/2022", rubro: "PRINCIPIO DE EXHAUSTIVIDAD EN SENTENCIAS.", relevancia: 88 },
          { tesis: "II.1o.C.12 C", rubro: "CARGA DE LA PRUEBA EN MATERIA CONTRACTUAL.", relevancia: 72 },
        ],
      });
      setCalculando(false);
    }, 1400);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inteligencia"
        title="Robot Pre-Dictaminador"
        description="Análisis algorítmico de probabilidad procesal, riesgos y precedentes — herramienta de apoyo, no sustituye la opinión profesional."
        actions={<span className="legal-stamp">Uso interno</span>}
      />

      <Card className="legal-card">
        <CardContent className="p-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expediente</label>
            <select value={expId} onChange={(e) => setExpId(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {expedientes.map((e) => <option key={e.id} value={e.id}>{e.numero} — {e.tipoJuicio}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Carácter procesal</label>
            <select value={caracter} onChange={(e) => setCaracter(e.target.value as Caracter)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize">
              {caracteres.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button onClick={ejecutar} disabled={calculando} className="bg-[color:var(--legal)] hover:bg-[color:var(--legal)]/90 text-white">
              {calculando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              {calculando ? "Analizando…" : "Pre-dictaminar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="legal-card lg:col-span-1">
            <CardHeader><CardTitle className="font-display text-lg flex items-center gap-2"><Bot className="h-4 w-4 text-[color:var(--teal)]" /> Probabilidad de éxito</CardTitle></CardHeader>
            <CardContent>
              <p className="font-display text-6xl font-bold text-[color:var(--teal)]">{resultado.probabilidadExito}%</p>
              <Progress value={resultado.probabilidadExito} className="mt-3" />
              <p className="mt-3 text-sm text-muted-foreground">{resultado.resumen}</p>
              <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">Carácter: <span className="text-foreground font-medium">{resultado.caracter}</span></p>
            </CardContent>
          </Card>

          <Card className="legal-card">
            <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-[color:var(--legal)]" /> Riesgos detectados</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {resultado.riesgos.map((r, i) => (
                <div key={i} className="flex gap-2"><span className="text-[color:var(--legal)]">•</span><span>{r}</span></div>
              ))}
            </CardContent>
          </Card>

          <Card className="legal-card">
            <CardHeader><CardTitle className="font-display text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[color:var(--teal)]" /> Recomendaciones</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {resultado.recomendaciones.map((r, i) => (
                <div key={i} className="flex gap-2"><span className="text-[color:var(--teal)]">✓</span><span>{r}</span></div>
              ))}
            </CardContent>
          </Card>

          <Card className="legal-card lg:col-span-3">
            <CardHeader><CardTitle className="font-display text-base">Precedentes relevantes</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {resultado.precedentes.map((p, i) => (
                  <div key={i} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-[color:var(--teal)] font-semibold">{p.tesis}</p>
                      <p className="text-sm font-medium">{p.rubro}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-2xl font-bold">{p.relevancia}%</p>
                      <p className="text-xs text-muted-foreground">Relevancia</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
