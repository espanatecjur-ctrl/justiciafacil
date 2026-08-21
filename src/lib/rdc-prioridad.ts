// Devolución Compensada (RDC) — Convenio de Transacción.
// Se apoya en la tabla YA EXISTENTE `compensacion_devolucion` (capital, tasa,
// estado, fecha de solicitud) — no crea infraestructura paralela. Solo suma
// dos campos a esa tabla: `folio` y `doc_convenio`.
import { supabase } from "../lib/supabase";
import type { Cliente, LineaPagoRdc } from "./clientes";
import type { Abono } from "./convenioDevolucion";

export const TOPE_ABONO = 50000;
export const PLAZO_DEFINICION_DIAS = 90;
export const PLAZO_INICIO_ABONOS_MESES = 6;
export const PLAZO_MESES_PARA_COMPENSACION = 12; // 👈 el CLIENTE no puede pedir su dinero antes de este plazo, contado desde la SOLICITUD de devolución (no desde la firma del contrato)
export const PLAZO_PAGO_COMPENSACION_DIAS = 60; // 👈 margen para pagar la PRIMERA compensación, una vez cumplido el año
export const TOPE_MESES_ENTRE_ABONOS = 3; // 👈 tope máximo entre un abono de capital y el siguiente

export const PLAZO_FIRMA_HORAS = 24; // 👈 horas que tiene el cliente para firmar tras descargar
export const ROLES_DESCARGAN_RDC = ["SRAC", "RAC"]; // 👈 solo estos roles pueden descargar/generar
export const LIMITE_DESCARGAS_POR_PERSONA = 2; // 👈 cada persona (no cada rol) hasta 2 veces el mismo folio, por si se equivoca

export const PORCENTAJE_BOLSA_MENSUAL = 0.15; // 👈 15% de las ventas del mes, para fondear devoluciones
export const TOPE_ABONO_SIN_APROBACION = 35000; // 👈 más de esto necesita aprobación de GAD/DGE

export const PLAZO_REVISION_MIN_DIAS = 15; // 👈 objetivo: RAC/SRAC/DGE revisan una solicitud pedida en 15 días
export const PLAZO_REVISION_MAX_DIAS = 30; // 👈 límite duro: si pasa de aquí, se marca vencida

export const TOPE_ABONO_CONVENIO_SIMPLE = 40000; // 👈 Modalidad 2: sin RDC, solo capital en convenio de pagos
export const PLAZO_MESES_CONVENIO_SIMPLE = 15; // 👈 plazo objetivo — se alarga si el tope de $40,000 no alcanza

export interface DescargaRdc {
  persona: string; // correo
  personaNombre: string | null;
  rol: string;
  fecha: string;
}

export interface RdcDevolucion {
  id: string;
  clienteId: string;
  folio: string | null;
  capital: number;
  tasa: number;
  plazoMeses: number;
  estado: string;
  fechaSolicitudDev: string;
  docConvenio: { url: string; nombre: string } | null;
  fechaProximoAbono: string | null;
  abonoNotificadoHasta: string | null;
  fechaDescargado: string | null;
  descargadoPor: string | null;
  plazoFirmaHasta: string | null;
  docFirmado: { url: string; nombre: string } | null;
  firmadoEn: string | null;
  descargaVencida: boolean;
  vecesDescargado: number;
  historialDescargas: DescargaRdc[];
  abonoMensual: number | null;
  fechaVencimiento: string | null;
  solicitaCompensacion: boolean | null;
  fechaEleccion: string | null;
  modalidad: "rdc" | "convenio_simple";
  solicitadoIniciarPor: string | null;
  fechaLimiteRevision: string | null;
  revisadoPor: string | null;
  fechaRevisado: string | null;
  habilitadoDescargaPara: string | null;
  gerenteCofirma: string | null;
  requiereRegenerarSucursal: boolean;
  lineasPago: LineaPagoRdc[];
  terminosEspeciales: string | null;
  folioSolicitud: string | null;
  docSolicitudFormalUrl: string | null;
  fechaHabilitadaSolicitud: string | null;
}

function mapRdc(f: Record<string, unknown>): RdcDevolucion {
  return {
    id: String(f.id),
    clienteId: String(f.cliente_id),
    folio: (f.folio as string) ?? null,
    capital: Number(f.capital) || 0,
    tasa: Number(f.tasa) || 5,
    plazoMeses: Number(f.plazo_meses) || 14,
    estado: String(f.estado || "ninguna"),
    fechaSolicitudDev: String(f.fecha_solicitud_dev || ""),
    docConvenio: (f.doc_convenio as { url: string; nombre: string } | null) ?? null,
    fechaProximoAbono: (f.fecha_proximo_abono as string) ?? null,
    abonoNotificadoHasta: (f.abono_notificado_hasta as string) ?? null,
    fechaDescargado: (f.fecha_descargado as string) ?? null,
    descargadoPor: (f.descargado_por as string) ?? null,
    plazoFirmaHasta: (f.plazo_firma_hasta as string) ?? null,
    docFirmado: (f.doc_firmado as { url: string; nombre: string } | null) ?? null,
    firmadoEn: (f.firmado_en as string) ?? null,
    descargaVencida: Boolean(f.descarga_vencida),
    vecesDescargado: Number(f.veces_descargado) || 0,
    historialDescargas: Array.isArray(f.historial_descargas) ? (f.historial_descargas as DescargaRdc[]) : [],
    abonoMensual: f.abono_mensual != null ? Number(f.abono_mensual) : null,
    fechaVencimiento: (f.fecha_vencimiento as string) ?? null,
    solicitaCompensacion: f.solicita_compensacion == null ? null : Boolean(f.solicita_compensacion),
    fechaEleccion: (f.fecha_eleccion as string) ?? null,
    modalidad: (f.modalidad as "rdc" | "convenio_simple") || "rdc",
    solicitadoIniciarPor: (f.solicitado_iniciar_por as string) ?? null,
    fechaLimiteRevision: (f.fecha_limite_revision as string) ?? null,
    revisadoPor: (f.revisado_por as string) ?? null,
    fechaRevisado: (f.fecha_revisado as string) ?? null,
    habilitadoDescargaPara: (f.habilitado_descarga_para as string) ?? null,
    gerenteCofirma: (f.gerente_cofirma as string) ?? null,
    requiereRegenerarSucursal: Boolean(f.requiere_regenerar_sucursal),
    lineasPago: Array.isArray(f.pagos_lineas) ? (f.pagos_lineas as LineaPagoRdc[]) : [],
    terminosEspeciales: (f.terminos_especiales as string) ?? null,
    folioSolicitud: (f.folio_solicitud as string) ?? null,
    docSolicitudFormalUrl: (f.doc_solicitud_formal_url as string) ?? null,
    fechaHabilitadaSolicitud: (f.fecha_habilitada_solicitud as string) ?? null,
  };
}

/**
 * Cálculo de la Devolución Compensada (Modalidad 1 · RDC). El plazo de
 * espera de 12 meses (para poder pedir el dinero y empezar a ganar
 * compensación) se cuenta desde la fecha de SOLICITUD de devolución — no
 * desde la firma del contrato original.
 *
 * La compensación NO es un pago único: se recalcula CADA AÑO que se
 * cumple, al 5% sobre el CAPITAL QUE AÚN LE QUEDE PENDIENTE en ese momento
 * (capital total menos lo que ya se le haya abonado a esa fecha). Si se
 * pasan los `abonos` reales, el cálculo es exacto por año; si no se pasan
 * (por ejemplo en listas donde no conviene traer el historial completo),
 * se calcula como si no se hubiera abonado nada todavía (estimado, hacia
 * arriba — nunca subestima lo que se le debe al cliente).
 */
export function calcularRDC(cliente: Cliente, rdc?: RdcDevolucion | null, abonos?: Abono[]): {
  capital: number; mesesDesdeFirma: number; aniosTranscurridos: number;
  compensacionTerminacion: number; compensacionEspera: number; compensacion: number; total: number;
  generoBeneficio: boolean; contratoYaVencido: boolean;
  fechaPagoCompensacion: string | null; aniosCompletados: number; detalleAnual: { anio: number; fecha: string; capitalRestante: number; tasa: number; compensacion: number }[];
} {
  const capital = rdc?.capital || Number(cliente.valorFirma) || 0;

  // 👇 Ancla en la FIRMA DEL CONVENIO, no en la solicitud — así se cuenta
  // el plazo real de espera para la Compensación por Espera.
  const fechaAncla = rdc?.firmadoEn ? rdc.firmadoEn.slice(0, 10) : null;
  let mesesDesdeFirma = 0;
  if (fechaAncla) {
    const inicio = new Date(fechaAncla + "T00:00:00").getTime();
    const hoy = Date.now();
    if (!Number.isNaN(inicio) && hoy > inicio) mesesDesdeFirma = (hoy - inicio) / (1000 * 60 * 60 * 24 * 30.44);
  }
  const generoBeneficio = mesesDesdeFirma >= PLAZO_MESES_PARA_COMPENSACION;
  const aniosTranscurridos = mesesDesdeFirma / 12;
  const aniosCompletados = Math.floor(mesesDesdeFirma / PLAZO_MESES_PARA_COMPENSACION);

  // 👇 Compensación por Terminación — pago ÚNICO, independiente de la
  // espera, si el contrato original ya había vencido al momento de la
  // firma del convenio (o, si aún no se firma, comparado contra hoy).
  const fechaComparaVencimiento = fechaAncla || new Date().toISOString().slice(0, 10);
  const contratoYaVencido = !!cliente.fechaVencimiento && cliente.fechaVencimiento <= fechaComparaVencimiento;
  const compensacionTerminacion = contratoYaVencido ? capital * 0.05 : 0;

  // 👇 Compensación por Espera — RECURRENTE, escalonada: 4% el año 1, 5%
  // desde el año 2 en adelante, sobre el capital que quede pendiente en
  // cada aniversario.
  const detalleAnual: { anio: number; fecha: string; capitalRestante: number; tasa: number; compensacion: number }[] = [];
  let compensacionEspera = 0;
  let fechaPagoCompensacion: string | null = null;

  if (fechaAncla && aniosCompletados > 0) {
    for (let i = 1; i <= aniosCompletados; i++) {
      const aniversario = new Date(fechaAncla + "T00:00:00");
      aniversario.setMonth(aniversario.getMonth() + PLAZO_MESES_PARA_COMPENSACION * i);
      const fechaAniv = aniversario.toISOString().slice(0, 10);
      const pagadoAEsaFecha = (abonos || []).filter((a) => a.fecha <= fechaAniv).reduce((sum, a) => sum + a.monto, 0);
      const capitalRestante = Math.max(0, capital - pagadoAEsaFecha);
      const tasaEseAnio = i === 1 ? 0.04 : 0.05; // 👈 4% año 1, 5% año 2 en adelante
      const compensacionEseAnio = capitalRestante * tasaEseAnio;
      detalleAnual.push({ anio: i, fecha: fechaAniv, capitalRestante, tasa: tasaEseAnio, compensacion: compensacionEseAnio });
      compensacionEspera += compensacionEseAnio;

      if (i === 1) {
        const pago = new Date(fechaAncla + "T00:00:00");
        pago.setMonth(pago.getMonth() + PLAZO_MESES_PARA_COMPENSACION);
        pago.setDate(pago.getDate() + PLAZO_PAGO_COMPENSACION_DIAS);
        fechaPagoCompensacion = pago.toISOString().slice(0, 10);
      }
    }
  }

  const compensacion = compensacionTerminacion + compensacionEspera; // 👈 suma de las 2, para quien solo necesite el total
  const total = capital + compensacion;
  return {
    capital, mesesDesdeFirma, aniosTranscurridos, compensacionTerminacion, compensacionEspera, compensacion, total,
    generoBeneficio, contratoYaVencido, fechaPagoCompensacion, aniosCompletados, detalleAnual,
  };
}

/**
 * Vista previa ANTES de que exista la solicitud — para cuando un gerente/
 * director está por presionar "Pedir que se genere" y el cliente pregunta
 * "¿cuánto voy a ganar, en cuánto tiempo, y cómo se me va a pagar?".
 * Calcula como si HOY fuera la fecha de solicitud.
 */
export function previsualizarRDC(cliente: Cliente): {
  capital: number; compensacionAnio1: number; compensacionAnio2: number; compensacionDiaria: number;
  totalAnio1: number; totalAnio2: number;
  contratoYaVencido: boolean; fechaEstimadaPrimerAbono: string; fechaEstimadaCompensacion: string;
} {
  const capital = Number(cliente.valorFirma) || 0;
  const compensacionAnio1 = capital * 0.04; // 👈 4% al primer año
  const compensacionAnio2 = capital * 0.05; // 👈 5% desde el segundo año en adelante
  const compensacionDiaria = compensacionAnio1 / 365; // 👈 cuánto va generando cada día, hacia la meta del año 1
  const totalAnio1 = capital + compensacionAnio1;
  const totalAnio2 = capital + compensacionAnio1 + compensacionAnio2;

  const hoy = new Date();
  let contratoYaVencido = false;
  if (cliente.fechaVencimiento) {
    contratoYaVencido = new Date(cliente.fechaVencimiento + "T00:00:00").getTime() <= hoy.getTime();
  }

  // Estimado de cuándo arrancarían los abonos: 90 días de definición + 6 meses.
  const primerAbono = new Date(hoy);
  primerAbono.setDate(primerAbono.getDate() + PLAZO_DEFINICION_DIAS);
  primerAbono.setMonth(primerAbono.getMonth() + PLAZO_INICIO_ABONOS_MESES);

  // Estimado de cuándo se cobraría la compensación: 12 meses + 60 días.
  const compFecha = new Date(hoy);
  compFecha.setMonth(compFecha.getMonth() + PLAZO_MESES_PARA_COMPENSACION);
  compFecha.setDate(compFecha.getDate() + PLAZO_PAGO_COMPENSACION_DIAS);

  return {
    capital, compensacionAnio1, compensacionAnio2, compensacionDiaria, totalAnio1, totalAnio2, contratoYaVencido,
    fechaEstimadaPrimerAbono: primerAbono.toISOString().slice(0, 10),
    fechaEstimadaCompensacion: compFecha.toISOString().slice(0, 10),
  };
}

/** Folio único: RDC-2026-XXXXXX. Reintenta si por alguna razón ya existe. */
async function folioNuevo(): Promise<string> {
  const anio = new Date().getFullYear();
  for (let intento = 0; intento < 5; intento++) {
    const sufijo = Math.random().toString(36).slice(2, 8).toUpperCase();
    const folio = `RDC-${anio}-${sufijo}`;
    const { data } = await supabase.from("compensacion_devolucion").select("id").eq("folio", folio).maybeSingle();
    if (!data) return folio;
  }
  return `RDC-${anio}-${Date.now().toString(36).toUpperCase()}`;
}

/** Folio único de la Solicitud Formal: SOL-2026-XXXXXX (distinto del folio del Convenio). */
async function folioSolicitudNuevo(): Promise<string> {
  const anio = new Date().getFullYear();
  for (let intento = 0; intento < 5; intento++) {
    const sufijo = Math.random().toString(36).slice(2, 8).toUpperCase();
    const folio = `SOL-${anio}-${sufijo}`;
    const { data } = await supabase.from("compensacion_devolucion").select("id").eq("folio_solicitud", folio).maybeSingle();
    if (!data) return folio;
  }
  return `SOL-${anio}-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Se llama cuando RAC/sub-RAC terminan la revisión (15-30 días) y habilitan
 * la Solicitud Formal para descargarse. Genera su propio folio (distinto
 * del Convenio), sube el documento ya armado a Drive para tener una URL
 * real y estable, y esa URL es lo que el QR va a codificar — al leerlo,
 * abre el documento directo, no solo un folio.
 */
export async function habilitarYSubirSolicitud(
  cliente: Cliente, htmlDocumento: string, habilitadoPor: string
): Promise<{ folio: string; url: string } | null> {
  const { generarExpediente } = await import("./expediente");
  const { subirArchivoDrive } = await import("./expedienteDocs");

  const folio = await folioSolicitudNuevo();
  const exp = await generarExpediente(cliente);
  if (!exp?.carpetaId) { console.error("habilitarYSubirSolicitud: no se pudo abrir la carpeta de Drive."); return null; }

  const base64 = btoa(unescape(encodeURIComponent(htmlDocumento)));
  const up = await subirArchivoDrive({
    carpetaId: exp.carpetaId, nombre: `Solicitud Formal ${folio}.html`, base64, subcarpeta: "Solicitud Formal RDC", mime: "text/html", publico: true,
  });
  if (!up.ok || !up.link) { console.error("habilitarYSubirSolicitud: falló la subida.", up.error); return null; }

  const { error } = await supabase.from("compensacion_devolucion").update({
    folio_solicitud: folio, doc_solicitud_formal_url: up.link, fecha_habilitada_solicitud: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("cliente_id", cliente.id);
  if (error) { console.error("habilitarYSubirSolicitud:", error.message); return null; }

  try {
    await supabase.from("eventos").insert({
      tipo: "cliente", accion: "solicitud_habilitada", titulo: `📋 Solicitud Formal habilitada: ${cliente.nombre}`,
      detalle: `Folio ${folio} · Habilitada por ${habilitadoPor}`, autor: habilitadoPor, modulo: "clientes", ref_id: String(cliente.id),
      icono: "📋", meta: { cliente_id: cliente.id, atencion: ["RAC", "SRAC"] },
    });
  } catch (e) { console.warn("No se pudo avisar:", e); }

  return { folio, url: up.link };
}

/** Trae la fila de compensación/RDC de un cliente, si existe. */
export async function obtenerRdcCliente(clienteId: string): Promise<RdcDevolucion | null> {
  const { data, error } = await supabase.from("compensacion_devolucion").select("*").eq("cliente_id", clienteId).maybeSingle();
  if (error || !data) return null;
  return mapRdc(data as Record<string, unknown>);
}

/** Crea (o completa) la solicitud de RDC para un cliente: folio + capital + estado. */
export async function crearSolicitudRdc(cliente: Cliente, creadoPor: string): Promise<RdcDevolucion | null> {
  const existente = await obtenerRdcCliente(cliente.id);
  const folio = existente?.folio || (await folioNuevo());
  const capital = existente?.capital || Number(cliente.valorFirma) || 0;
  const hoy = new Date().toISOString().slice(0, 10);

  const fila = {
    cliente_id: cliente.id,
    folio,
    capital,
    tasa: existente?.tasa || 5,
    plazo_meses: existente?.plazoMeses || 14,
    solicito_devolucion: true,
    fecha_solicitud_dev: existente?.fechaSolicitudDev || hoy,
    estado: existente && existente.estado !== "ninguna" ? existente.estado : "solicitada",
    solicitada_por: creadoPor,
    fecha_solicitada: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("compensacion_devolucion")
    .upsert(fila, { onConflict: "cliente_id" })
    .select("*")
    .single();
  if (error || !data) { console.error("crearSolicitudRdc:", error?.message); return null; }
  return mapRdc(data as Record<string, unknown>);
}

/** Guarda el documento del convenio (una vez generado) ligado al cliente. */
export async function guardarDocConvenioRdc(clienteId: string, doc: { url: string; nombre: string }): Promise<boolean> {
  const { error } = await supabase.from("compensacion_devolucion").update({ doc_convenio: doc, updated_at: new Date().toISOString() }).eq("cliente_id", clienteId);
  return !error;
}

/** Fase 3 · Control de Devoluciones: todas las RDC solicitadas (para el tablero). */
export async function listarRdcActivas(): Promise<RdcDevolucion[]> {
  const { data, error } = await supabase.from("compensacion_devolucion").select("*").eq("solicito_devolucion", true);
  if (error || !data) return [];
  return data.map((f) => mapRdc(f as Record<string, unknown>));
}

/** Fase 3 · Asignar/editar la fecha del próximo abono directo desde el tablero. */
export async function guardarFechaProximoAbono(clienteId: string, fecha: string): Promise<boolean> {
  const { error } = await supabase.from("compensacion_devolucion").update({ fecha_proximo_abono: fecha || null, updated_at: new Date().toISOString() }).eq("cliente_id", clienteId);
  return !error;
}

/**
 * Registra que el convenio se descargó: arranca el plazo de 24 horas para
 * que el cliente lo firme. Reinicia también la firma anterior (si vuelve a
 * descargarse después de vencido, empieza un ciclo nuevo y limpio).
 *
 * Límite: CADA PERSONA (por correo, no por rol) puede descargar el mismo
 * folio hasta LIMITE_DESCARGAS_POR_PERSONA veces (por si se equivoca). Se
 * guarda un historial de quién descargó y cuándo (historial_descargas).
 */
export async function registrarDescargaRdc(clienteId: string, rol: string, personaEmail: string, personaNombre: string | null): Promise<{ ok: true; plazoFirmaHasta: string } | { ok: false; motivo: "limite" | "error"; vecesPersona?: number; limite?: number }> {
  const { data: actual } = await supabase.from("compensacion_devolucion").select("historial_descargas").eq("cliente_id", clienteId).maybeSingle();
  const historial: DescargaRdc[] = Array.isArray(actual?.historial_descargas) ? actual!.historial_descargas : [];
  const correo = (personaEmail || "").trim().toLowerCase();
  const vecesPersona = historial.filter((d) => d.persona === correo).length;
  if (vecesPersona >= LIMITE_DESCARGAS_POR_PERSONA) return { ok: false, motivo: "limite", vecesPersona, limite: LIMITE_DESCARGAS_POR_PERSONA };

  const ahora = new Date();
  const plazo = new Date(ahora.getTime() + PLAZO_FIRMA_HORAS * 60 * 60 * 1000);
  const nuevoHistorial = [...historial, { persona: correo, personaNombre, rol, fecha: ahora.toISOString() }];
  const { error } = await supabase
    .from("compensacion_devolucion")
    .update({
      fecha_descargado: ahora.toISOString(),
      descargado_por: rol,
      plazo_firma_hasta: plazo.toISOString(),
      descarga_vencida: false,
      doc_firmado: null,
      firmado_en: null,
      veces_descargado: nuevoHistorial.length,
      historial_descargas: nuevoHistorial,
      updated_at: ahora.toISOString(),
    })
    .eq("cliente_id", clienteId);
  if (error) { console.error("registrarDescargaRdc:", error.message); return { ok: false, motivo: "error" }; }
  return { ok: true, plazoFirmaHasta: plazo.toISOString() };
}

/** Sube la carta firmada por el cliente (dentro del plazo de 24 horas). */
export async function subirFirmaRdc(clienteId: string, doc: { url: string; nombre: string }): Promise<boolean> {
  const { error } = await supabase
    .from("compensacion_devolucion")
    .update({ doc_firmado: doc, firmado_en: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("cliente_id", clienteId);
  return !error;
}

// ── Prioridad RDC (Calendario de Devoluciones) ─────────────────────
export interface SolicitudPrioridadRdc {
  id: string;
  clienteId: string;
  solicitadoPor: string;
  motivo: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  aprobadoPor: string | null;
  aprobadoEn: string | null;
  origenAprobacion: string | null;
  creadoEn: string;
  tipo: "prioridad" | "monto_mayor";
  montoSolicitado: number | null;
}

function mapSolicitud(f: Record<string, unknown>): SolicitudPrioridadRdc {
  return {
    id: String(f.id),
    clienteId: String(f.cliente_id),
    solicitadoPor: String(f.solicitado_por || ""),
    motivo: (f.motivo as string) ?? null,
    estado: (f.estado as SolicitudPrioridadRdc["estado"]) || "pendiente",
    aprobadoPor: (f.aprobado_por as string) ?? null,
    aprobadoEn: (f.aprobado_en as string) ?? null,
    origenAprobacion: (f.origen_aprobacion as string) ?? null,
    creadoEn: String(f.creado_en || ""),
    tipo: (f.tipo as SolicitudPrioridadRdc["tipo"]) || "prioridad",
    montoSolicitado: f.monto_solicitado != null ? Number(f.monto_solicitado) : null,
  };
}

/** RAC/SRAC piden meter a un cliente por prioridad en la cola. Queda "pendiente" hasta que GAD o DGE la resuelvan. */
export async function solicitarPrioridadRdc(clienteId: string, solicitadoPor: string, motivo: string): Promise<boolean> {
  const { error } = await supabase.from("solicitudes_prioridad_rdc").insert({ cliente_id: clienteId, solicitado_por: solicitadoPor, motivo: motivo || null, tipo: "prioridad" });
  return !error;
}

/**
 * Fija el abono mensual de un convenio. Hasta $35,000 se guarda directo
 * (lo puede hacer RAC/SRAC desde la calculadora). Más de eso NO se guarda
 * aquí — se manda como solicitud de aprobación (misma bandeja que prioridad).
 */
export async function guardarAbonoMensual(clienteId: string, monto: number): Promise<{ ok: boolean; requiereAprobacion: boolean }> {
  if (monto > TOPE_ABONO_SIN_APROBACION) return { ok: false, requiereAprobacion: true };
  const { error } = await supabase.from("compensacion_devolucion").update({ abono_mensual: monto, updated_at: new Date().toISOString() }).eq("cliente_id", clienteId);
  return { ok: !error, requiereAprobacion: false };
}

/** Pide un abono mensual mayor a $35,000 — requiere aprobación de GAD/DGE (misma bandeja que prioridad). */
export async function solicitarMontoMayorRdc(clienteId: string, solicitadoPor: string, monto: number, motivo: string): Promise<boolean> {
  const { error } = await supabase.from("solicitudes_prioridad_rdc").insert({ cliente_id: clienteId, solicitado_por: solicitadoPor, motivo: motivo || null, tipo: "monto_mayor", monto_solicitado: monto });
  return !error;
}

/** Lista de solicitudes de prioridad (por defecto solo las pendientes). */
export async function listarSolicitudesPrioridad(estado: string = "pendiente"): Promise<SolicitudPrioridadRdc[]> {
  const { data, error } = await supabase.from("solicitudes_prioridad_rdc").select("*").eq("estado", estado).order("creado_en", { ascending: true });
  if (error || !data) return [];
  return data.map((f) => mapSolicitud(f as Record<string, unknown>));
}

/**
 * Aprueba o rechaza una solicitud de prioridad — SIEMPRE pasa por la función
 * segura (aprobar-prioridad-rdc), nunca escribe la tabla directo, para que
 * el mismo camino sirva sin importar si se llama desde aquí o desde el
 * puente de JusticiaFácil.
 */
export async function resolverPrioridadRdc(solicitudId: string, accion: "aprobar" | "rechazar", aprobadoPor: string): Promise<boolean> {
  try {
    const r = await fetch("/.netlify/functions/aprobar-prioridad-rdc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solicitudId, accion, aprobadoPor, origen: "jurisconecta" }),
    });
    return r.ok;
  } catch (e) {
    console.error("resolverPrioridadRdc:", e);
    return false;
  }
}

// ── Bolsa mensual de devoluciones ───────────────────────────────────
export interface BolsaMensual {
  ventasDelMes: number;
  bolsa: number;
  asignado: number;
  disponible: number;
}

/**
 * 15% de las ventas del mes (clientes convertidos, fecha_conversion) es la
 * bolsa disponible para devoluciones. "Asignado" es lo que ya se comprometió
 * en abonos mensuales de convenios activos — no se puede prometer más de lo
 * que hay.
 */
export async function calcularBolsaMensual(): Promise<BolsaMensual> {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
  const inicioSiguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1).toISOString().slice(0, 10);

  const [{ data: ventas }, { data: comprometido }] = await Promise.all([
    supabase.from("clientes").select("valor_firma").gte("fecha_conversion", inicioMes).lt("fecha_conversion", inicioSiguiente),
    supabase.from("compensacion_devolucion").select("abono_mensual").eq("estado", "habilitada").not("abono_mensual", "is", null),
  ]);

  const ventasDelMes = (ventas || []).reduce((sum, c) => {
    const n = Number(String((c as { valor_firma: unknown }).valor_firma || "0").replace(/[^0-9.]/g, ""));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const bolsa = Math.round(ventasDelMes * PORCENTAJE_BOLSA_MENSUAL);
  const asignado = (comprometido || []).reduce((sum, c) => sum + (Number((c as { abono_mensual: unknown }).abono_mensual) || 0), 0);

  return { ventasDelMes, bolsa, asignado, disponible: Math.max(0, bolsa - asignado) };
}

// ── Solicitud Formal de Devolución (Paso 1-2, antes del Convenio) ──────────

/** Registra la solicitud inicial (sin folio todavía — el folio es del Convenio, Paso 4). */
export async function registrarSolicitudFormal(clienteId: string, solicitadoPor: string): Promise<RdcDevolucion | null> {
  const existente = await obtenerRdcCliente(clienteId);
  if (existente) return existente; // ya existe, no duplicar
  const hoy = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("compensacion_devolucion")
    .insert({
      cliente_id: clienteId,
      solicito_devolucion: true,
      fecha_solicitud_dev: hoy,
      estado: "solicitada",
      solicitada_por: solicitadoPor,
      fecha_solicitada: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error || !data) { console.error("registrarSolicitudFormal:", error?.message); return null; }
  return mapRdc(data as Record<string, unknown>);
}

/**
 * Modalidad 2: Convenio simple (SIN esperar la compensación del 5%).
 * Tope de abono $40,000; plazo objetivo 15 meses, pero si el capital no
 * alcanza a esos $40,000/mes en 15 meses, el plazo se alarga (el tope
 * manda, nunca al revés). Si el contrato original YA ESTABA VENCIDO al
 * momento de la solicitud, se suma la compensación por terminación —
 * el cliente nunca pierde por elegir la vía rápida.
 */
export function calcularConvenioSimple(cliente: Cliente, rdc?: RdcDevolucion | null): {
  capital: number; contratoYaVencido: boolean; compensacionPorVencimiento: number; total: number;
  plazoMeses: number; abonoMensualSugerido: number;
} {
  const capital = rdc?.capital || Number(cliente.valorFirma) || 0;
  const fechaSolicitud = rdc?.fechaSolicitudDev || new Date().toISOString().slice(0, 10);
  let contratoYaVencido = false;
  if (cliente.fechaVencimiento) {
    contratoYaVencido = cliente.fechaVencimiento <= fechaSolicitud;
  }
  const compensacionPorVencimiento = contratoYaVencido ? capital * 0.05 : 0;
  const total = capital + compensacionPorVencimiento;
  const plazoMeses = Math.max(PLAZO_MESES_CONVENIO_SIMPLE, Math.ceil(total / TOPE_ABONO_CONVENIO_SIMPLE) || 1);
  const abonoMensualSugerido = plazoMeses > 0 ? total / plazoMeses : 0;
  return { capital, contratoYaVencido, compensacionPorVencimiento, total, plazoMeses, abonoMensualSugerido };
}

/** Guarda la elección del CLIENTE: ¿quiere esperar la compensación del 5%, o solo su capital? Fija también la modalidad. */
export async function guardarEleccionCompensacion(clienteId: string, quiereCompensacion: boolean, registradoPor: string): Promise<boolean> {
  const { error } = await supabase
    .from("compensacion_devolucion")
    .update({
      solicita_compensacion: quiereCompensacion,
      modalidad: quiereCompensacion ? "rdc" : "convenio_simple",
      fecha_eleccion: new Date().toISOString(),
      elegido_por: registradoPor,
      updated_at: new Date().toISOString(),
    })
    .eq("cliente_id", clienteId);
  return !error;
}

/**
 * Guarda una petición especial que el cliente trae por escrito (o pide de
 * palabra al momento de firmar la Solicitud). El documento que traiga (si
 * trae uno) se anexa como referencia, con el texto de la petición.
 */
export async function guardarTerminosEspeciales(clienteId: string, texto: string, registradoPor: string, doc?: { url: string; nombre: string } | null): Promise<boolean> {
  const textoFinal = doc ? `${texto}\n📎 Documento adjunto: ${doc.nombre} (${doc.url})` : texto;
  const { error } = await supabase
    .from("compensacion_devolucion")
    .update({ terminos_especiales: textoFinal, updated_at: new Date().toISOString() })
    .eq("cliente_id", clienteId);
  if (!error) {
    try {
      await supabase.from("eventos").insert({
        tipo: "cliente", accion: "rdc_peticion_especial", titulo: `📝 Petición especial registrada`,
        detalle: `Por ${registradoPor}: ${texto.slice(0, 120)}`, autor: registradoPor, modulo: "clientes", ref_id: clienteId,
        icono: "📝", meta: { cliente_id: clienteId },
      });
    } catch (e) { console.warn("No se pudo avisar la petición especial:", e); }
  }
  return !error;
}

/** RAC/SRAC/DGE registran con quién (el gerente) va a co-firmar el Convenio simple, antes de generarlo. */
export async function guardarGerenteCofirma(clienteId: string, nombreGerente: string): Promise<boolean> {
  const { error } = await supabase
    .from("compensacion_devolucion")
    .update({ gerente_cofirma: nombreGerente, updated_at: new Date().toISOString() })
    .eq("cliente_id", clienteId);
  return !error;
}

// ── Fase C: "Pedir que se genere" (gerentes/DGC) → RAC/SRAC/DGE revisan ──

/**
 * Un gerente o Director Comercial PIDE que se inicie el proceso de un
 * cliente. No genera folio ni descarga — solo crea/actualiza el registro
 * con quién lo pidió y la fecha límite de revisión (15-30 días), y deja
 * lista la notificación para RAC/SRAC/DGE.
 */
export async function pedirGenerarRdc(cliente: Cliente, solicitadoPor: string): Promise<RdcDevolucion | null> {
  const existente = await obtenerRdcCliente(cliente.id);
  const hoy = new Date();
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + PLAZO_REVISION_MAX_DIAS);

  const fila = {
    cliente_id: cliente.id,
    solicito_devolucion: true,
    fecha_solicitud_dev: existente?.fechaSolicitudDev || hoy.toISOString().slice(0, 10),
    estado: existente?.estado && existente.estado !== "ninguna" ? existente.estado : "solicitada",
    solicitado_iniciar_por: solicitadoPor,
    fecha_limite_revision: limite.toISOString().slice(0, 10),
    revisado_por: null,
    fecha_revisado: null,
    habilitado_descarga_para: null,
    updated_at: hoy.toISOString(),
  };

  const { data, error } = await supabase
    .from("compensacion_devolucion")
    .upsert(fila, { onConflict: "cliente_id" })
    .select("*")
    .single();
  if (error || !data) { console.error("pedirGenerarRdc:", error?.message); return null; }

  try {
    await supabase.from("eventos").insert({
      tipo: "cliente",
      accion: "rdc_solicitud_pedida",
      titulo: `📋 Nueva solicitud pedida: ${cliente.nombre}`,
      detalle: `Pedida por ${solicitadoPor} · RAC/SRAC/DGE tienen hasta ${PLAZO_REVISION_MAX_DIAS} días para revisarla`,
      autor: solicitadoPor,
      modulo: "clientes",
      ref_id: cliente.id,
      icono: "📋",
      meta: { cliente_id: cliente.id, atencion: ["RAC", "SRAC", "DGE"] },
    });
  } catch (e) { console.warn("No se pudo avisar la solicitud pedida:", e); }

  return mapRdc(data as Record<string, unknown>);
}

/**
 * RAC/SRAC/DGE revisan y validan los datos de una solicitud pedida, y con
 * esto le "regresan" el permiso de descarga a quien la pidió — así esa
 * persona también puede descargar el convenio una vez generado, además de
 * RAC/SRAC.
 */
export async function marcarRevisadoYHabilitar(clienteId: string, revisadoPor: string): Promise<boolean> {
  const actual = await obtenerRdcCliente(clienteId);
  const { error } = await supabase
    .from("compensacion_devolucion")
    .update({
      revisado_por: revisadoPor,
      fecha_revisado: new Date().toISOString(),
      habilitado_descarga_para: actual?.solicitadoIniciarPor || null,
      updated_at: new Date().toISOString(),
    })
    .eq("cliente_id", clienteId);
  return !error;
}

/** Cuántos abonos ya tiene cada cliente — para la prioridad de la cola (los que ya están en curso van primero). */
export async function obtenerConteoAbonos(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from("abonos_devolucion").select("cliente_id");
  const mapa = new Map<string, number>();
  if (error || !data) return mapa;
  for (const fila of data as { cliente_id: string }[]) {
    mapa.set(fila.cliente_id, (mapa.get(fila.cliente_id) || 0) + 1);
  }
  return mapa;
}

// ── Calendario de días inhábiles judiciales (editable por el equipo jurídico) ──

export interface DiaInhabil {
  id: string;
  estado: string;
  anio: number;
  fechaInicio: string;
  fechaFin: string;
  descripcion: string | null;
}

function mapDiaInhabil(f: Record<string, unknown>): DiaInhabil {
  return {
    id: String(f.id),
    estado: String(f.estado || ""),
    anio: Number(f.anio) || 0,
    fechaInicio: String(f.fecha_inicio || ""),
    fechaFin: String(f.fecha_fin || ""),
    descripcion: (f.descripcion as string) ?? null,
  };
}

/** Lista los periodos de días inhábiles judiciales — para revisar/editar en Configuración. */
export async function listarDiasInhabiles(estado?: string): Promise<DiaInhabil[]> {
  let q = supabase.from("dias_inhabiles_judiciales").select("*").order("fecha_inicio", { ascending: true });
  if (estado) q = q.eq("estado", estado);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((f) => mapDiaInhabil(f as Record<string, unknown>));
}

/** El equipo jurídico agrega un periodo nuevo (ej. cuando sale el acuerdo del año siguiente). */
export async function agregarDiaInhabil(p: { estado: string; anio: number; fechaInicio: string; fechaFin: string; descripcion?: string }, creadoPor: string): Promise<boolean> {
  const { error } = await supabase.from("dias_inhabiles_judiciales").insert({
    estado: p.estado, anio: p.anio, fecha_inicio: p.fechaInicio, fecha_fin: p.fechaFin, descripcion: p.descripcion || null, creado_por: creadoPor,
  });
  return !error;
}

export async function borrarDiaInhabil(id: string): Promise<boolean> {
  const { error } = await supabase.from("dias_inhabiles_judiciales").delete().eq("id", id);
  return !error;
}

/**
 * Calcula la fecha de vencimiento real: firma + 12 meses hábiles. Si esa
 * fecha cae dentro de un periodo de días inhábiles del estado del cliente
 * (vacaciones judiciales), se recorre al primer día hábil siguiente al
 * periodo. Si no hay periodos cargados para ese estado, regresa el +12
 * meses simple (mejor un estimado que nada).
 */
/**
 * Calcula la fecha de vencimiento real: firma + 12 meses hábiles. "Hábil"
 * revisa las 3 cosas: 1) sábados y domingos, 2) los periodos de vacaciones
 * judiciales del estado del cliente, 3) los feriados individuales (un solo
 * día, guardados con fecha_inicio = fecha_fin en la misma tabla). Si
 * cualquiera de las 3 aplica, se recorre al siguiente día y se vuelve a
 * revisar todo desde cero, hasta caer en un día realmente hábil.
 */
export async function calcularFechaVencimientoHabil(fechaFirma: string, estado: string): Promise<string> {
  const base = new Date(fechaFirma + "T00:00:00");
  base.setMonth(base.getMonth() + PLAZO_MESES_PARA_COMPENSACION);

  const periodos = await listarDiasInhabiles(estado);
  const fechaObj = base;

  for (let vuelta = 0; vuelta < 60; vuelta++) { // 60 días de margen de sobra
    const diaSemana = fechaObj.getDay(); // 0 = domingo, 6 = sábado
    const fechaStr = fechaObj.toISOString().slice(0, 10);
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
    const caeEnPeriodoOFeriado = periodos.some((p) => fechaStr >= p.fechaInicio && fechaStr <= p.fechaFin);

    if (!esFinDeSemana && !caeEnPeriodoOFeriado) {
      return fechaStr; // 👈 ya es un día hábil de verdad
    }
    fechaObj.setDate(fechaObj.getDate() + 1); // avanza un día y se vuelve a revisar todo
  }
  return fechaObj.toISOString().slice(0, 10); // no debería llegar aquí, pero por si acaso
}

/**
 * Punto de entrada ÚNICO para arrancar un proceso de devolución desde cero
 * (desde el buscador de Control de Devoluciones). Crea el registro base y
 * de una vez valida la nomenclatura del cliente como "RDC" — así el código
 * queda condicionado al momento real en que se inicia el proceso, no antes.
 */
export async function iniciarDevolucion(clienteId: string, area: string | undefined, iniciadoPor: string): Promise<boolean> {
  const { validarNomenclatura } = await import("./clientes");
  const okNomenclatura = await validarNomenclatura(clienteId, "RDC", area as never);
  const hoy = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("compensacion_devolucion").upsert({
    cliente_id: clienteId,
    solicito_devolucion: true,
    fecha_solicitud_dev: hoy,
    estado: "solicitada",
    modalidad: "rdc",
    updated_at: new Date().toISOString(),
  }, { onConflict: "cliente_id" });
  await supabase.from("clientes").update({ tiene_solicitud_devolucion: true }).eq("id", clienteId);
  if (error) { console.error("iniciarDevolucion:", error.message); return false; }

  try {
    await supabase.from("eventos").insert({
      tipo: "cliente", accion: "rdc_iniciada", titulo: `💰 Proceso de devolución iniciado`,
      detalle: `Iniciado por ${iniciadoPor}`, autor: iniciadoPor, modulo: "clientes", ref_id: clienteId,
      icono: "💰", meta: { cliente_id: clienteId },
    });
  } catch (e) { console.warn("No se pudo avisar el inicio:", e); }

  return okNomenclatura;
}
