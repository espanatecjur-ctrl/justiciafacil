import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { type Precarga, buscarPredictamenVigenteCompleto, buscarPredictamenPorCredito } from "@/lib/predictamen-guardar";
import { obtenerResumenCacheado, generarResumenUnDocumento, type ResumenDocumentosCache } from "@/lib/resumen-documentos";
import { obtenerAnalisisCacheado, generarAnalisisIA, guardarAnalisisEnCache, introAnalisis, type AnalisisIA } from "@/lib/analisis-ia";
import { cargarPermisosURRJ } from "@/lib/urrj-permisos";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Scale, ScrollText, Plus, Upload, Trash2 } from "lucide-react";
import { getAuth } from "@/lib/auth";
import { DictaminadorPosicion, type VistaPosicion } from "@/components/dictaminador-posicion";
import { SolicitudesURRJ } from "@/components/solicitudes-urrj";
import { DictamenRegistral } from "@/components/dictamen-registral";
import { actualizarEstadoSolicitud, type SolicitudPredictamen } from "@/lib/solicitud-predictamen";
import { HistorialPredictamen } from "@/components/historial-predictamen";
import { RegistroURRJ } from "@/components/registro-urrj";
import { FichaURRJ, type RefGarantia } from "@/components/ficha-urrj";
import { ImportarCarteraURRJ } from "@/components/importar-cartera-urrj";

export const Route = createFileRoute("/urrj")({
  head: () => ({ meta: [{ title: "URRJ — Pre-dictamen — JusticiaFácil" }] }),
  validateSearch: (s: Record<string, unknown>): { soloRegistro?: boolean; registral?: boolean; exp?: string; cliente?: string; caso?: string; ficha?: string } => ({
    soloRegistro: s.soloRegistro === true || s.soloRegistro === "true",
    registral: s.registral === true || s.registral === "true",
    exp: typeof s.exp === "string" ? s.exp : undefined,
    cliente: typeof s.cliente === "string" ? s.cliente : undefined,
    caso: typeof s.caso === "string" ? s.caso : undefined,
    ficha: typeof s.ficha === "string" ? s.ficha : undefined,
  }),
  component: URRJ,
});

const NAVY = "#0B1E3A";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

function URRJ() {
  const [casos, setCasos] = useState<any[]>([]);
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [vista, setVista] = useState<VistaPosicion>("elegir");
  const { soloRegistro, registral, exp, cliente, caso, ficha } = Route.useSearch();
  const [precargar, setPrecargar] = useState<Precarga | null>(null);
  const [solicitudActiva, setSolicitudActiva] = useState<SolicitudPredictamen | null>(null);
  const [crearNuevo, setCrearNuevo] = useState(false);
  const [permisos, setPermisos] = useState<string[]>([]);
  const [fichaGar, setFichaGar] = useState<RefGarantia | null>(null);
  const [subVista, setSubVista] = useState<"solicitudes" | "historial">("solicitudes");
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [resumenDocs, setResumenDocs] = useState<ResumenDocumentosCache | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [progresoIA, setProgresoIA] = useState<{ hecho: number; total: number; nombre: string } | null>(null);
  const [errorResumen, setErrorResumen] = useState<string | null>(null);
  const [analizandoDoc, setAnalizandoDoc] = useState<string | null>(null);
  const [analisisDocs, setAnalisisDocs] = useState<AnalisisIA | null>(null);
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [errorSubidaDoc, setErrorSubidaDoc] = useState<string | null>(null);
  const claveCasoSolicitud = solicitudActiva?.numero_credito || solicitudActiva?.expediente || solicitudActiva?.caso_id
    || resumenDocs?.datos_generales?.numero_credito || resumenDocs?.datos_generales?.expediente || "";
  useEffect(() => {
    if (!solicitudActiva?.id) { setResumenDocs(null); return; }
    obtenerResumenCacheado(solicitudActiva.id).then(setResumenDocs);
  }, [solicitudActiva?.id]);
  useEffect(() => {
    const idSolicitud = solicitudActiva?.id;
    if (!idSolicitud) { setAnalisisDocs(null); return; }
    (async () => {
      if (claveCasoSolicitud) {
        const porCaso = await obtenerAnalisisCacheado(claveCasoSolicitud, "Actor");
        if (porCaso) { setAnalisisDocs(porCaso); return; }
      }
      setAnalisisDocs(await obtenerAnalisisCacheado(idSolicitud, "Actor"));
    })();
  }, [claveCasoSolicitud, solicitudActiva?.id]);
  const resumenDe = (nombre: string) => resumenDocs?.resumenes.find((r) => r.nombre === nombre);
  const ORDEN_TIPOS = ["Contrato", "Demanda", "Acuerdo", "Auto Judicial", "Emplazamiento", "Contestación de Demanda", "Solicitud", "Notificación", "Comprobante", "Verificación", "Dictamen", "Otro"];
  const documentosOrdenados = useMemo(() => {
    const docs = solicitudActiva?.documentos || [];
    if (!resumenDocs) return docs;
    const todosAnalizados = docs.every((d) => resumenDe(d.nombre));
    if (!todosAnalizados) return docs;
    return [...docs].sort((a, b) => {
      const ia = ORDEN_TIPOS.indexOf(resumenDe(a.nombre)?.tipo || "Otro");
      const ib = ORDEN_TIPOS.indexOf(resumenDe(b.nombre)?.tipo || "Otro");
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [solicitudActiva?.documentos, resumenDocs]);
  function normalizarTexto(t: string) {
    return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function similitudTexto(a: string, b: string) {
    const wa = new Set(normalizarTexto(a).split(" ").filter((w) => w.length > 2));
    const wb = new Set(normalizarTexto(b).split(" ").filter((w) => w.length > 2));
    if (wa.size === 0 || wb.size === 0) return 0;
    let interseccion = 0;
    for (const w of wa) if (wb.has(w)) interseccion++;
    return interseccion / new Set([...wa, ...wb]).size;
  }
  const UMBRAL_DUPLICADO = 0.5;
  const duplicadosPorNombre = useMemo(() => {
    const docsConResumen = documentosOrdenados
      .map((d) => ({ nombre: d.nombre, r: resumenDe(d.nombre) }))
      .filter((x) => x.r?.resumen);
    const mapa = new Map<string, string[]>();
    for (let i = 0; i < docsConResumen.length; i++) {
      for (let j = i + 1; j < docsConResumen.length; j++) {
        const a = docsConResumen[i], b = docsConResumen[j];
        if (a.r!.tipo !== b.r!.tipo) continue;
        if (similitudTexto(a.r!.resumen, b.r!.resumen) >= UMBRAL_DUPLICADO) {
          if (!mapa.has(a.nombre)) mapa.set(a.nombre, []);
          if (!mapa.has(b.nombre)) mapa.set(b.nombre, []);
          mapa.get(a.nombre)!.push(b.nombre);
          mapa.get(b.nombre)!.push(a.nombre);
        }
      }
    }
    return mapa;
  }, [documentosOrdenados, resumenDocs]);
  const analizarUnDocumento = async (doc: { nombre: string; url: string }) => {
    if (!solicitudActiva?.id || resumenDe(doc.nombre)) return;
    setAnalizandoDoc(doc.nombre); setErrorResumen(null);
    const claveCaso = solicitudActiva.numero_credito || solicitudActiva.expediente || solicitudActiva.caso_id || "";
    const r = await generarResumenUnDocumento(solicitudActiva.id, doc, resumenDocs, claveCaso || solicitudActiva.id);
    setAnalizandoDoc(null);
    if (!r.ok) { setErrorResumen(`"${doc.nombre}": ${r.error || "No se pudo analizar."}`); return; }
    setResumenDocs(r.cache!);
    if (!claveCaso) {
      setErrorResumen("⚠️ Esta solicitud todavía no tiene crédito ni expediente capturado — el análisis se guardó, pero solo lo vas a ver aquí hasta que captures el crédito/expediente y regeneres el análisis en Actor/Demandado.");
    }
    try {
      const claveParaAnalisis = claveCaso || solicitudActiva.id;
      const rA = await generarAnalisisIA(claveParaAnalisis, "Actor", [doc]);
      if (rA.ok && rA.analisis) {
        setAnalisisDocs(rA.analisis);
        await guardarAnalisisEnCache({ ...rA.analisis, posicion: "Demandado" });
      }
    } catch { /* el resumen rápido ya se guardó; esto es un plus, no bloquea */ }
  };
  const agregarDocumentoASolicitud = async (file: File) => {
    if (!solicitudActiva?.id) return;
    setSubiendoDoc(true);
    setErrorSubidaDoc(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => {
          const s = String(fr.result || "");
          const coma = s.indexOf(",");
          resolve(coma >= 0 ? s.slice(coma + 1) : s);
        };
        fr.onerror = () => reject(new Error("No se pudo leer el archivo."));
        fr.readAsDataURL(file);
      });
