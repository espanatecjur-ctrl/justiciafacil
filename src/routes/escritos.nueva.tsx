import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Save, Loader2, ArrowLeft, Info } from "lucide-react";
import { detectarCampos, humanizar, crearPlantillaEscrito } from "@/lib/plantilla-escrito";
import { usuarioActualEtiqueta } from "@/lib/auth";
import type { EscritoCampo } from "@/lib/escrito-templates";

export const Route = createFileRoute("/escritos/nueva")({
  head: () => ({ meta: [{ title: "Nueva plantilla de escrito — SIGA-DIIPA" }] }),
  component: NuevaPlantillaEscrito,
});

function NuevaPlantillaEscrito() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [materia, setMateria] = useState("ambas");
  const [cuerpo, setCuerpo] = useState("");
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [tipos, setTipos] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const detectados = useMemo(() => detectarCampos(cuerpo), [cuerpo]);

  const guardar = async () => {
    if (!nombre.trim()) { setMsg("Ponle un nombre a la plantilla."); return; }
    if (!cuerpo.trim()) { setMsg("Escribe el cuerpo del escrito."); return; }
    setGuardando(true); setMsg(null);
    const campos: EscritoCampo[] = detectados.map((id) => ({
      id,
      label: labels[id]?.trim() || humanizar(id),
      tipo: (tipos[id] as EscritoCampo["tipo"]) || "text",
    }));
    const quien = await usuarioActualEtiqueta();
    const r = await crearPlantillaEscrito(nombre.trim(), descripcion.trim(), materia, campos, cuerpo, quien);
    setGuardando(false);
    if (r.ok) navigate({ to: "/escritos" });
    else setMsg("No se pudo guardar: " + (r.error || "") + " (¿corriste el SQL de plantilla_escrito?)");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Documentos"
        title="Nueva plantilla de escrito"
        description="Escribe el escrito y guárdalo. Aparecerá en la lista de plantillas para elaborarlo con cualquier expediente."
        actions={
          <Link to="/escritos"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1.5" /> Volver</Button></Link>
        }
      />

      <Card className="legal-card p-4">
        <div className="flex items-start gap-2 rounded-md bg-[color:var(--teal)]/10 p-3 text-[13px] text-[color:var(--teal)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>Para los datos que se llenan, usa <b>dobles llaves</b>. Ejemplo: <code>{"{{nombreActor}}"}</code>, <code>{"{{numeroExpediente}}"}</code>, <code>{"{{juzgado}}"}</code>. El sistema los detecta solos y los vuelve campos.</div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="legal-card p-5">
          <div className="grid gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Nombre de la plantilla</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Incidente de liquidación de intereses"
                className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Descripción corta</label>
                <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="¿Para qué es esta plantilla?"
                  className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Materia</label>
                <select value={materia} onChange={(e) => setMateria(e.target.value)}
                  className="mt-0.5 h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="ambas">Ambas</option>
                  <option value="civil">Civil</option>
                  <option value="mercantil">Mercantil</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Cuerpo del escrito</label>
              <textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={18}
                placeholder={"C. JUEZ {{juzgado}}\nP R E S E N T E.\n\n{{nombreActor}}, en el expediente {{numeroExpediente}}, ante Usted comparezco y expongo…"}
                className="mt-0.5 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-[13px] leading-relaxed" />
            </div>
          </div>
        </Card>

        <Card className="legal-card h-fit p-5">
          <h3 className="font-display text-base font-semibold">Campos detectados ({detectados.length})</h3>
          {detectados.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Escribe <code>{"{{asi}}"}</code> en el cuerpo y aquí aparecerán los campos.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {detectados.map((id) => (
                <div key={id} className="rounded-md border border-border p-2">
                  <p className="font-mono text-[11px] text-muted-foreground">{"{{"}{id}{"}}"}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <input value={labels[id] ?? humanizar(id)} onChange={(e) => setLabels((r) => ({ ...r, [id]: e.target.value }))}
                      className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs" />
                    <select value={tipos[id] || "text"} onChange={(e) => setTipos((r) => ({ ...r, [id]: e.target.value }))}
                      className="h-8 rounded-md border border-input bg-background px-1 text-xs">
                      <option value="text">Corto</option>
                      <option value="textarea">Largo</option>
                      <option value="number">Número</option>
                      <option value="date">Fecha</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button onClick={guardar} disabled={guardando} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1.5" /> Guardar plantilla</>}
            </Button>
            {msg && <span className="text-xs font-medium text-red-700">{msg}</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}
