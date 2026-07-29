import { useState } from "react";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { CheckCircle2, Clock, Mail, Loader2 } from "lucide-react";
import { crearYEnviarSolicitudFirma, correoDeRol } from "@/lib/firma-solicitud";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

// Si ambas validaciones (jurídico + registral) ya quedaron firmadas, arma el
// Dictamen Final en PDF y lo guarda solo en "Documentos fijos" (categoría
// automática). No bloquea nada si falla — es un "de pilón", no algo crítico.
export async function intentarAutoguardarDictamenFinal(dictamenId: string, casoId: string) {
  try {
    const rd = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=*&id=eq.${dictamenId}&limit=1`, { headers });
    const dict = (rd.ok ? await rd.json() : [])?.[0];
    if (!dict) return;
    const f = dict.firmas || {};
    if (!(f.jur_dil?.fecha && f.reg_ucm?.fecha)) return; // todavía falta alguna

    const rc = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&id=eq.${casoId}&limit=1`, { headers });
    const caso: CasoJuridico | null = (rc.ok ? await rc.json() : [])?.[0] || null;
    if (!caso) return;

    const { descargarDictamenFinalPDF } = await import("@/lib/dictamen-final-pdf");
    const { autoguardarDictamenFinalSiListo } = await import("@/components/checklist-documentos-ucp");
    const blob = await descargarDictamenFinalPDF({
      expediente: caso.expediente || undefined,
      juzgado: (caso as any).juzgado || undefined,
      garantia: caso.direccion_garantia || (caso as any).gar_id || undefined,
      cliente: caso.cliente_nombre || undefined,
      entidad: (caso as any).entidad || undefined,
      veredictoJuridico: dict.juridico?.veredicto || undefined,
      veredictoRegistral: typeof dict.registral?.veredicto === "string" ? dict.registral.veredicto : undefined,
      veredictoFinal: dict.veredicto || undefined,
      firmas: [
        { titulo: "Dictamen jurídico", firma: f.jur_dil },
        { titulo: "Dictamen registral (RPPC)", firma: f.reg_ucm },
      ],
      detalleJuridico: dict.juridico && typeof dict.juridico === "object" ? dict.juridico : undefined,
      detalleRegistral: dict.registral && typeof dict.registral === "object" ? dict.registral : undefined,
    }, "blob") as Blob;
    const nombre = `dictamen-final-${(caso.expediente || "garantia").replace(/[^\w.-]+/g, "_")}.pdf`;
    await autoguardarDictamenFinalSiListo(caso, "UCP", blob, nombre);
  } catch { /* de pilón — nunca debe tronar el guardado de la firma por esto */ }
}

// Bloque de firmas de UN dictamen (jurídico o registral).
// Cada dictamen lleva 2 firmas: Elabora + Valida (DIL/UCM).
// Cuando el validador valida, el dictamen queda "listo".
// Las firmas se guardan en dictamen.firmas con claves propias (ej. jur_elabora, jur_dil).
// Además de firmar localmente, se puede "Enviar por correo" — igual que en URRJ:
// crea un link único (/firmar?token=...) y lo manda por Gmail; la persona firma
// remoto sin tener que entrar a buscar el caso, y le aparece en "Mis validaciones".
export function FirmasDictamen({ dictamenId, casoId, expedienteTexto, rolValida, firmas, claveElabora, claveValida, tituloElabora, tituloValida, cargoElabora, cargoValida, onGuardado }: {
  dictamenId: string;
  casoId: string;
  expedienteTexto: string;
  rolValida: string;      // rol en perfil_usuario/colaboradores a quien avisar (ej. "DIL", "UCM")
  firmas: Record<string, any> | null;
  claveElabora: string;   // ej. "jur_elabora"
  claveValida: string;    // ej. "jur_dil"
  tituloElabora: string;
  tituloValida: string;
  cargoElabora: string;
  cargoValida: string;
  onGuardado?: () => void;
}) {
  const [f, setF] = useState<Record<string, any>>(() => firmas || {});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const firmar = async (clave: string, datos: DatosFirma) => {
    const nuevo = { ...f, [clave]: datos.fecha ? datos : null };
    setF(nuevo);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${dictamenId}`, {
        method: "PATCH", headers, body: JSON.stringify({ firmas: nuevo, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      onGuardado?.();
      if ((clave === "jur_dil" || clave === "reg_ucm") && datos.fecha) {
        intentarAutoguardarDictamenFinal(dictamenId, casoId);
      }
    } catch (e: any) { setError("No se pudo guardar la firma: " + e.message); }
  };

  const enviarPorCorreo = async () => {
    setEnviando(true); setMsg(null); setError(null);
    try {
      const correo = await correoDeRol(rolValida);
      if (!correo) { setError(`No hay correo configurado para el rol ${rolValida} en Colaboradores.`); return; }
      const r = await crearYEnviarSolicitudFirma({
        area: "UCP", dictamenId, casoId, slot: claveValida,
        correoEsperado: correo, tituloSlot: tituloValida, expedienteTexto,
      });
      if (!r.ok) { setError(r.error || "No se pudo mandar el correo."); return; }
      setMsg(r.enviado ? `Correo enviado a ${correo} ✅` : `Se creó el link, pero el correo no salió solo — se abrió tu app de correo para mandarlo a mano.`);
    } finally { setEnviando(false); }
  };

  const elaboraOK = !!f[claveElabora]?.fecha;
  const validaOK = !!f[claveValida]?.fecha;
  const listo = elaboraOK && validaOK;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Firmas de este dictamen</p>
        {listo
          ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Listo (validado por {rolValida})</span>
          : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"><Clock className="h-3.5 w-3.5" /> {elaboraOK ? `Falta validación de ${rolValida}` : "Falta elaborar"}</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FirmaParte
          titulo={tituloElabora}
          valor={f[claveElabora] || null}
          cargoSugerido={cargoElabora}
          onFirmar={(datos) => firmar(claveElabora, datos)}
        />
        <FirmaParte
          titulo={tituloValida}
          valor={f[claveValida] || null}
          cargoSugerido={cargoValida}
          bloqueado={!elaboraOK}
          onFirmar={(datos) => firmar(claveValida, datos)}
        />
      </div>

      {elaboraOK && !validaOK && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <button
            onClick={enviarPorCorreo}
            disabled={enviando}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: "#0C5C46" }}
          >
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Enviar a {rolValida} por correo (firma remota)
          </button>
          {msg && <span className="text-xs text-emerald-700">{msg}</span>}
        </div>
      )}
      {!elaboraOK && <p className="mt-2 text-[11px] text-muted-foreground">{rolValida} valida después de que se elabore el dictamen.</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
