// ============================================================
// SolicitarEscritoModal · pide un escrito para una etapa del juicio
// ------------------------------------------------------------
// Vive junto a la Línea del tiempo del juicio (una solicitud tiene
// sentido ligada a una etapa procesal real, no a una tarea suelta).
// Si "quien_elabora" es zona: nace en estado "solicitado" y cae en
// Escritos ▸ Solicitudes para que alguien lo tome y lo redacte.
// Si es DIL y ya lo trae elaborado: nace en "validado_dil" directo,
// listo para presentarse (se salta la cola).
// ============================================================
import { useState } from "react";
import { Loader2, X, Gavel } from "lucide-react";
import { recomendacionParaEtapa } from "@/lib/recomendaciones-juridicas";
import { crearSolicitudEscrito, DECISIONES_RECURSO } from "@/lib/solicitud-escrito";

const inp = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

const TIPOS_ESCRITO = [
  { value: "promocion", label: "Promoción / escrito simple" },
  { value: "contestacion", label: "Contestación de demanda" },
  { value: "demanda_mercantil", label: "Demanda — Ordinario Mercantil" },
  { value: "demanda_civil", label: "Demanda — Ordinario Civil" },
  { value: "recurso_apelacion", label: "Recurso de apelación" },
  { value: "amparo_indirecto", label: "Amparo indirecto" },
  { value: "amparo_directo", label: "Amparo directo" },
  { value: "otro", label: "Otro" },
];

export function SolicitarEscritoModal({ casoId, exp, garantiaId, etapa, etapaNombre, actor, demandado, creadoPor, onClose, onGuardado }: {
  casoId: string | null; exp: string; garantiaId?: string | null; etapa: string; etapaNombre?: string;
  actor?: string; demandado?: string; creadoPor: string | null;
  onClose: () => void; onGuardado: () => void;
}) {
  const rec = recomendacionParaEtapa(etapaNombre || etapa);
  const [titulo, setTitulo] = useState(`${rec.tituloCorto} — ${exp || "expediente"}`);
  const [tipoEscrito, setTipoEscrito] = useState(rec.tipoEscritoSugerido);
  const [posicion, setPosicion] = useState("Actor");
  const [quienElabora, setQuienElabora] = useState<"zona" | "dil">("zona");
  const [notas, setNotas] = useState("");
  const [decisionRecurso, setDecisionRecurso] = useState<string>("Ninguno");
  const [decisionNotas, setDecisionNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!titulo.trim()) { setError("Escribe el título del escrito."); return; }
    setGuardando(true); setError(null);
    const ok = await crearSolicitudEscrito({
      caso_id: casoId, expediente: exp || null, garantia_id: garantiaId || null,
      etapa: etapaNombre || etapa, posicion_procesal: posicion, tipo_escrito: tipoEscrito, titulo: titulo.trim(),
      recomendacion: rec.recomendacion, notas_solicitud: notas.trim() || null,
      quien_elabora: quienElabora,
      decision_recurso: decisionRecurso !== "Ninguno" ? decisionRecurso : null,
      decision_notas: decisionRecurso !== "Ninguno" ? decisionNotas.trim() || null : null,
      creado_por: creadoPor || null,
    });
    setGuardando(false);
    if (!ok) { setError("No se pudo guardar la solicitud."); return; }
    onGuardado();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: "#0B1E3A" }}>
          <p className="flex items-center gap-1.5 font-semibold"><Gavel className="h-4 w-4" /> Solicitar escrito · {etapaNombre || etapa}</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[75vh] space-y-3 overflow-y-auto p-4">
          {error && <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">{error}</div>}
          <div className="rounded-md border border-dashed border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-2 text-[11px] text-muted-foreground">
            <p className="font-medium text-[color:var(--teal)]">Recomendación de referencia</p>
            <p className="mt-0.5">{rec.recomendacion}</p>
            <p className="mt-0.5 italic">{rec.baseLegal}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Título del escrito</label>
            <input className={inp} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de escrito</label>
              <select className={inp} value={tipoEscrito} onChange={(e) => setTipoEscrito(e.target.value)}>
                {TIPOS_ESCRITO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Posición procesal de nuestra parte</label>
              <select className={inp} value={posicion} onChange={(e) => setPosicion(e.target.value)}>
                <option>Actor</option>
                <option>Demandado</option>
                <option>Tercero llamado a juicio</option>
              </select>
              {(actor || demandado) && <p className="mt-0.5 text-[10px] text-muted-foreground">Actor: {actor || "—"} · Demandado: {demandado || "—"}</p>}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">¿Quién lo elabora?</label>
            <div className="flex gap-2">
              <button onClick={() => setQuienElabora("zona")} className={`flex-1 rounded-md border px-3 py-2 text-sm ${quienElabora === "zona" ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-input"}`}>
                El de zona <span className="block text-[10px] font-normal text-muted-foreground">cae en Escritos ▸ Solicitudes</span>
              </button>
              <button onClick={() => setQuienElabora("dil")} className={`flex-1 rounded-md border px-3 py-2 text-sm ${quienElabora === "dil" ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 font-medium" : "border-input"}`}>
                El DIL (ya elaborado) <span className="block text-[10px] font-normal text-muted-foreground">pasa directo a UCM</span>
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notas para quien lo redacte (opcional)</label>
            <textarea className={inp} rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Puntos que debe incluir, hechos a citar, etc." />
          </div>
          <div className="border-t border-dashed border-border pt-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">¿Se acordó presentar recurso o amparo?</label>
            <select className={inp} value={decisionRecurso} onChange={(e) => setDecisionRecurso(e.target.value)}>
              {DECISIONES_RECURSO.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            {decisionRecurso !== "Ninguno" && (
              <textarea className={`${inp} mt-2`} rows={2} value={decisionNotas} onChange={(e) => setDecisionNotas(e.target.value)} placeholder="Qué se acordó exactamente y por qué (referencia para el módulo de Amparos/Recursos)." />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: "#0C5C46" }}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} Guardar solicitud
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
