// ============================================================
// Avisa por correo a quien se le asignó una tarea (o solicitud de
// escrito), con un link directo a "Seguimiento y actuaciones" de
// la ficha. Si esa etapa ya tiene documentos cargados, lo menciona.
// Se manda desde el Gmail de quien está creando la tarea (usa su
// sesión), igual que el resto de correos de la app.
// ============================================================
import { sbSelect } from "@/lib/supabase";
import { enviarCorreo } from "@/lib/enviar-correo";

export interface AvisoTarea {
  titulo: string;
  descripcion?: string | null;
  expediente: string | null;
  caso_id: string | null;
  etapa?: string | null;
  responsable_correo: string | null;
  esEscrito?: boolean;
}

export async function avisarTareaPorCorreo(t: AvisoTarea): Promise<void> {
  if (!t.responsable_correo || !t.caso_id) return;

  let nDocs = 0;
  if (t.etapa) {
    try {
      const docs = await sbSelect<{ id: string }>(
        "documento_garantia",
        `select=id&caso_id=eq.${t.caso_id}&etapa=eq.${encodeURIComponent(t.etapa)}&en_papelera=eq.false`
      );
      nDocs = docs.length;
    } catch { /* si falla el conteo, se manda el correo igual sin ese dato */ }
  }

  const link = `${window.location.origin}/ucm-ficha?id=${t.caso_id}&tab=seguimiento`;
  const mensaje = [
    t.esEscrito ? `Se solicitó un escrito: "${t.titulo}".` : `Se te asignó una tarea: "${t.titulo}".`,
    t.descripcion ? `\n${t.descripcion}` : "",
    t.expediente ? `\nExpediente: ${t.expediente}` : "",
    t.etapa ? `\nEtapa: ${t.etapa}` : "",
    nDocs > 0 ? `\nEsta etapa ya tiene ${nDocs} documento(s) cargado(s) — revísalos antes de empezar.` : "",
    `\n\nEntra aquí para trabajarla en el sistema:\n${link}`,
  ].filter(Boolean).join("");

  try {
    await enviarCorreo({
      para: t.responsable_correo,
      asunto: `${t.esEscrito ? "Solicitud de escrito" : "Nueva tarea"} · ${t.expediente || "JusticiaFácil"}`,
      mensaje,
    });
  } catch { /* si falla el correo, no bloquea el guardado de la tarea/solicitud */ }
}
