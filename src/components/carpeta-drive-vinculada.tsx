// ============================================================
// CarpetaDriveVinculada · dentro de la ficha del expediente.
//  · Si NO hay carpeta vinculada → botón "Vincular carpeta de Drive"
//    (o "Crear una nueva" si no existe ninguna).
//  · Si YA hay → muestra el nombre + vista previa de todos sus documentos.
// Guarda la carpeta en el caso (columnas drive_carpeta_id / drive_carpeta_nombre).
// ============================================================
import { useEffect, useState } from "react";
import {
  HardDrive, FolderCheck, FolderPlus, FileText, ExternalLink, Maximize2,
  Loader2, RefreshCw, X, Link2, CloudUpload, CheckCircle2,
  Folder, ChevronRight, Home, Layers, AlertTriangle, CheckSquare, Square, Download,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { VisorDocumentoModal } from "@/components/visor-documento";
import { ExploradorDrive } from "@/components/explorador-drive";
import { listarCarpeta, listarTodo, previewDeId, tipoLegible, esCarpeta, sugerirCarpetas, textosDeCaso, sincronizarCarpeta, normaliza, listarCopias, firmarCopias, traerCarpetaAArea, traerArchivo, type ItemDrive, type Sugerencia, type Copia } from "@/lib/drive-explorar";
import { Input } from "@/components/ui/input";
import { crearCarpetaDrive, nombreGarantia } from "@/lib/drive";
import { cargarPermisosModulo, puedeAccion, puedeAbrirDrive, type ModuloPerm } from "@/lib/permisos-acciones";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";

// Carga JSZip desde CDN solo cuando se necesita (para armar los .zip).
async function cargarJSZip(): Promise<any> {
  const w = window as any;
  if (w.JSZip) return w.JSZip;
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => res();
    s.onerror = () => rej(new Error("No se pudo cargar el compresor ZIP."));
    document.head.appendChild(s);
  });
  return w.JSZip;
}

// Dispara la descarga de un blob con un nombre dado.
function bajarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const hdrs = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export function CarpetaDriveVinculada({
  caso,
  onGuardar,
  modulo,
  area,
}: {
  caso: CasoJuridico;
  onGuardar: (campos: Record<string, string>) => void | Promise<void>;
  modulo?: ModuloPerm;
  area?: string;
}) {
  const carpetaId = caso.drive_carpeta_id || "";
  const carpetaNombre = caso.drive_carpeta_nombre || "";

  // ¿Este usuario puede vincular/cambiar carpetas? (los demás solo ven)
  const [puedeVincular, setPuedeVincular] = useState(true);
  useEffect(() => {
    if (!modulo) { setPuedeVincular(true); return; }
    cargarPermisosModulo(modulo)
      .then((p) => setPuedeVincular(puedeAccion(p.acciones, "vincular_drive")))
      .catch(() => setPuedeVincular(true));
  }, [modulo]);

  // ¿Puede ver el botón "Abrir en Drive"? (negado por defecto; solo DGE/Super_Admin o quien la DGE prenda)
  const [puedeDrive, setPuedeDrive] = useState(false);
  useEffect(() => {
    puedeAbrirDrive(modulo).then(setPuedeDrive).catch(() => setPuedeDrive(false));
  }, [modulo]);

  const [eligiendo, setEligiendo] = useState(false);
  const [docs, setDocs] = useState<ItemDrive[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docSel, setDocSel] = useState<ItemDrive | null>(null);
  const [guardando, setGuardando] = useState(false);

  // vista: "todos" = todos los docs (recursivo); "esta" = navegar carpeta por carpeta
  const [modoVista, setModoVista] = useState<"todos" | "esta">("todos");
  const [rutaFicha, setRutaFicha] = useState<{ id: string; name: string }[]>([]);
  const [subcarpetas, setSubcarpetas] = useState<ItemDrive[]>([]);

  // aviso de carpeta ya usada por otro expediente (no repetir)
  const [dupAviso, setDupAviso] = useState<string | null>(null);

  // crear carpeta nueva (reusa el crear-carpeta del sistema: Área → Rol → garantía)
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);

  // sincronizar (copiar Drive → almacén del sistema)
  const [sincro, setSincro] = useState(false);
  const [msgSincro, setMsgSincro] = useState<string | null>(null);
  const sincronizar = async () => {
    if (!carpetaId) return;
    setSincro(true); setMsgSincro(null);
    const r = await sincronizarCarpeta(caso.id, carpetaId);
    setSincro(false);
    if (!r.ok) { setMsgSincro("⚠️ " + (r.error || "No se pudo sincronizar.")); return; }
    const partes = [`Copiados: ${r.copiados ?? 0}`];
    if ((r.restantes ?? 0) > 0) partes.push(`faltan ${r.restantes} (dale de nuevo)`);
    else partes.push("todo al día ✅");
    if (r.errores && r.errores.length) partes.push(`${r.errores.length} con aviso`);
    setMsgSincro(partes.join(" · "));
    if (r.errores && r.errores.length) setMsgSincro((m) => (m || "") + " — 1º: " + r.errores![0]);
    cargarCopias(); // refresca qué ya está en el almacén
  };

  // sugerencias por número (expediente / crédito / gar)
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [cargSug, setCargSug] = useState(false);
  const textos = textosDeCaso(caso);
  const cargarSugerencias = () => {
    if (textos.length === 0) return;
    setCargSug(true);
    sugerirCarpetas(textos).then(setSugerencias).finally(() => setCargSug(false));
  };
  useEffect(() => {
    if (!carpetaId && textos.length > 0) cargarSugerencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carpetaId]);

  // paginación de la vista previa (para no cargar muchos iframes a la vez)
  const PAGE = 6;
  const [pagina, setPagina] = useState(0);
  const [filtroDoc, setFiltroDoc] = useState("");
  const docsFiltrados = filtroDoc.trim()
    ? docs.filter((d) => normaliza(d.name).includes(normaliza(filtroDoc)) || normaliza(d.ruta || "").includes(normaliza(filtroDoc)))
    : docs;

  // copias en el almacén del sistema (para servir desde ahí cuando existan) — opción B
  const [copias, setCopias] = useState<Record<string, Copia>>({});
  const [urlsCopia, setUrlsCopia] = useState<Record<string, string>>({});
  const cargarCopias = () => {
    if (!carpetaId) return;
    listarCopias(caso.id).then(setCopias).catch(() => setCopias({}));
  };
  useEffect(() => { cargarCopias(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [carpetaId]);

  const cargarDocs = (modo: "todos" | "esta" = modoVista, folderId: string = carpetaId) => {
    if (!carpetaId) return;
    setCargando(true); setError(null); setPagina(0);
    const fuente = modo === "todos" ? listarTodo(carpetaId) : listarCarpeta(folderId);
    fuente
      .then((r) => {
        if (!r.ok) setError(r.error || "No se pudieron leer los documentos.");
        const items = r.items || [];
        setDocs(items.filter((it) => !esCarpeta(it)));
        setSubcarpetas(modo === "esta" ? items.filter(esCarpeta) : []);
      })
      .finally(() => setCargando(false));
  };
  useEffect(() => {
    setModoVista("todos");
    setRutaFicha([{ id: carpetaId, name: carpetaNombre || "Carpeta" }]);
    cargarDocs("todos", carpetaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carpetaId]);

  // refresca la vista actual (respeta el modo y en qué subcarpeta vamos)
  const refrescar = () => {
    const folder = modoVista === "esta" ? (rutaFicha[rutaFicha.length - 1]?.id || carpetaId) : carpetaId;
    cargarDocs(modoVista, folder);
  };

  // ----- Selección + descarga (1 doc = archivo; 2+ = ZIP; carpeta = ZIP) -----
  const [selDocs, setSelDocs] = useState<Record<string, string>>({});
  const [selModo, setSelModo] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [msgDescarga, setMsgDescarga] = useState<string | null>(null);
  const estaSelDoc = (id: string) => id in selDocs;
  const toggleSelDoc = (a: ItemDrive) => setSelDocs((p) => { const n = { ...p }; if (n[a.id]) delete n[a.id]; else n[a.id] = a.name; return n; });
  const salirSel = () => { setSelModo(false); setSelDocs({}); };
  const nSelDocs = Object.keys(selDocs).length;
  const nombreZipExp = `${nombreGarantia(caso)}${caso.expediente ? " - " + caso.expediente : ""}`.replace(/[\\/:*?"<>|]/g, "-").trim() || "documentos";

  // Baja una lista de documentos (por id). 1 = archivo directo; 2+ = ZIP con nombreZip.
  const descargarLista = async (ids: string[], nombreZip: string) => {
    const conCopia = ids.filter((id) => copias[id]);
    const sinCopia = ids.length - conCopia.length;
    if (conCopia.length === 0) { setMsgDescarga("Ninguno está sincronizado. Dale 'Sincronizar documentos' primero."); return; }
    setDescargando(true); setMsgDescarga(sinCopia > 0 ? `${sinCopia} sin sincronizar se omitirán…` : "Preparando descarga…");
    try {
      const urls = await firmarCopias(conCopia.map((id) => copias[id].storage_path));
      if (conCopia.length === 1) {
        const id = conCopia[0];
        const u = urls[copias[id].storage_path];
        if (!u) throw new Error("No se pudo preparar el enlace.");
        const resp = await fetch(u);
        bajarBlob(await resp.blob(), copias[id].nombre || "documento");
      } else {
        const JSZip = await cargarJSZip();
        const zip = new JSZip();
        for (let i = 0; i < conCopia.length; i++) {
          const id = conCopia[i];
          setMsgDescarga(`Comprimiendo ${i + 1} de ${conCopia.length}…`);
          const u = urls[copias[id].storage_path];
          if (!u) continue;
          const resp = await fetch(u);
          zip.file(copias[id].nombre || `doc-${i + 1}`, await resp.blob());
        }
        setMsgDescarga("Generando ZIP…");
        const blob = await zip.generateAsync({ type: "blob" });
        bajarBlob(blob, nombreZip.endsWith(".zip") ? nombreZip : nombreZip + ".zip");
      }
      setMsgDescarga(sinCopia > 0 ? `Descarga lista · ${sinCopia} omitido(s) por no estar sincronizados.` : "Descarga lista ✅");
      salirSel();
    } catch (e: any) {
      setMsgDescarga("⚠️ " + String(e?.message || e));
    } finally {
      setDescargando(false);
    }
  };

  const descargarSeleccionDocs = () => descargarLista(Object.keys(selDocs), nombreZipExp);

  // Descarga una subcarpeta completa (todo lo de adentro, incl. subcarpetas) en un ZIP.
  const descargarSubcarpeta = async (folderId: string, folderName: string) => {
    setDescargando(true); setMsgDescarga("Leyendo la carpeta…");
    try {
      const r = await listarTodo(folderId);
      const archivos = (r.items || []).filter((it) => !esCarpeta(it) && copias[it.id]);
      if (archivos.length === 0) { setMsgDescarga("Esa carpeta no tiene documentos sincronizados."); setDescargando(false); return; }
      const urls = await firmarCopias(archivos.map((a) => copias[a.id].storage_path));
      const JSZip = await cargarJSZip();
      const zip = new JSZip();
      for (let i = 0; i < archivos.length; i++) {
        const a = archivos[i];
        setMsgDescarga(`Comprimiendo ${i + 1} de ${archivos.length}…`);
        const u = urls[copias[a.id].storage_path];
        if (!u) continue;
        const resp = await fetch(u);
        const ruta = (a.ruta || "").replace(/[\\:*?"<>|]/g, "-");
        zip.file((ruta ? ruta + "/" : "") + (copias[a.id].nombre || a.name), await resp.blob());
      }
      setMsgDescarga("Generando ZIP…");
      const blob = await zip.generateAsync({ type: "blob" });
      const limpio = folderName.replace(/[\\/:*?"<>|]/g, "-").trim() || "carpeta";
      bajarBlob(blob, limpio + ".zip");
      setMsgDescarga("Descarga lista ✅");
    } catch (e: any) {
      setMsgDescarga("⚠️ " + String(e?.message || e));
    } finally {
      setDescargando(false);
    }
  };

  const cambiarModo = (modo: "todos" | "esta") => {
    setModoVista(modo);
    setRutaFicha([{ id: carpetaId, name: carpetaNombre || "Carpeta" }]);
    cargarDocs(modo, carpetaId);
  };
  const entrarSubFicha = (it: ItemDrive) => {
    const base = rutaFicha.length ? rutaFicha : [{ id: carpetaId, name: carpetaNombre || "Carpeta" }];
    const nueva = [...base, { id: it.id, name: it.name }];
    setRutaFicha(nueva);
    cargarDocs("esta", it.id);
  };
  const irMigaFicha = (i: number) => {
    const nueva = rutaFicha.slice(0, i + 1);
    setRutaFicha(nueva);
    cargarDocs("esta", nueva[i].id);
  };

  // Reflejar automático (Opción A): al volver a la app / a esta pestaña, relee Drive solo.
  useEffect(() => {
    if (!carpetaId) return;
    const alVolver = () => {
      if (document.visibilityState === "visible") {
        const folder = modoVista === "esta" ? (rutaFicha[rutaFicha.length - 1]?.id || carpetaId) : carpetaId;
        cargarDocs(modoVista, folder);
        cargarCopias();
      }
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carpetaId, modoVista, rutaFicha]);

  // Antes de vincular: revisa que la carpeta NO esté usada por otro expediente (no repetir).
  const elegir = async (id: string, nombre: string) => {
    setGuardando(true); setDupAviso(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=id,expediente&drive_carpeta_id=eq.${encodeURIComponent(id)}&id=neq.${encodeURIComponent(caso.id)}`, { headers: hdrs });
      const usados = r.ok ? await r.json() : [];
      if (Array.isArray(usados) && usados.length > 0) {
        const exp = usados[0].expediente || usados[0].id;
        setDupAviso(`Esa carpeta ya está vinculada al expediente ${exp}. Una carpeta no puede usarse en dos expedientes.`);
        setGuardando(false);
        return;
      }
    } catch { /* si falla la revisión, dejamos continuar */ }
    await onGuardar({ drive_carpeta_id: id, drive_carpeta_nombre: nombre });
    setGuardando(false);
    setEligiendo(false);
  };

  // "Traer a mi área": revisa duplicado, MUEVE a la carpeta del área (renombrada) y la vincula.
  const [trayendo, setTrayendo] = useState(false);
  const [msgTraer, setMsgTraer] = useState<string | null>(null);
  const traerAMiArea = async (id: string, _nombre: string) => {
    setTrayendo(true); setMsgTraer(null); setDupAviso(null);
    // 1) ¿ya está en otro expediente?
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=id,expediente&drive_carpeta_id=eq.${encodeURIComponent(id)}&id=neq.${encodeURIComponent(caso.id)}`, { headers: hdrs });
      const usados = r.ok ? await r.json() : [];
      if (Array.isArray(usados) && usados.length > 0) {
        setMsgTraer(`⚠️ Esa carpeta ya está en el expediente ${usados[0].expediente || usados[0].id}.`);
        setTrayendo(false);
        return;
      }
    } catch { /* si falla, seguimos */ }
    // 2) nombre nuevo: garantía + expediente
    const nuevoNombre = `${nombreGarantia(caso)}${caso.expediente ? " — " + caso.expediente : ""}`.trim();
    const res = await traerCarpetaAArea(id, area || "UCM", nuevoNombre);
    setTrayendo(false);
    if (res.requiereCopia) {
      setMsgTraer("Esta carpeta está en otra Unidad — se necesita COPIAR (Paso 2, que haremos después). Por ahora solo funciona con carpetas dentro de Justiciafacil.");
      return;
    }
    if (!res.ok || !res.carpetaId) {
      setMsgTraer("⚠️ " + (res.error || "No se pudo traer la carpeta."));
      return;
    }
    await onGuardar({ drive_carpeta_id: res.carpetaId, drive_carpeta_nombre: res.nombre || nuevoNombre });
    setEligiendo(false);
  };

  // "Traer seleccionados" → varios documentos a la carpeta vinculada (uno por uno, con progreso).
  const traerArchivosAqui = async (items: { id: string; name: string }[]) => {
    if (!carpetaId) { setMsgTraer("Primero vincula o crea una carpeta para este expediente."); return; }
    if (!items.length) return;
    setTrayendo(true); setMsgTraer(null);
    let ok = 0; const fallos: string[] = [];
    for (let i = 0; i < items.length; i++) {
      setMsgTraer(`Trayendo ${i + 1} de ${items.length}…`);
      const res = await traerArchivo(items[i].id, carpetaId);
      if (res.ok) ok++; else fallos.push(items[i].name);
    }
    setTrayendo(false);
    setMsgTraer(`Listo: ${ok} traído${ok === 1 ? "" : "s"}${fallos.length ? ` · ${fallos.length} con aviso` : " ✅"}`);
    refrescar();
  };

  const crearYVincular = async () => {
    setCreando(true); setErrorCrear(null);
    const r = await crearCarpetaDrive(area || "UCM", caso);
    setCreando(false);
    if (r.ok && r.carpetaId) {
      await elegir(r.carpetaId, nombreGarantia(caso));
    } else {
      setErrorCrear(r.error || "No se pudo crear la carpeta.");
    }
  };

  const totalPag = Math.max(1, Math.ceil(docsFiltrados.length / PAGE));
  const pag = Math.min(pagina, totalPag - 1);
  const docsPag = docsFiltrados.slice(pag * PAGE, pag * PAGE + PAGE);

  // Indicador de sincronización (cálculo rápido): cuántos de los documentos vistos ya tienen copia
  const totalDocs = docs.length;
  const copiadosDocs = docs.filter((d) => copias[d.id]).length;
  const faltanSincro = Math.max(0, totalDocs - copiadosDocs);
  const colorSincro = totalDocs === 0 ? "gris" : faltanSincro === 0 ? "verde" : copiadosDocs === 0 ? "gris" : "amarillo";

  // firma los enlaces de las copias visibles (las que ya están en el almacén)
  useEffect(() => {
    const faltan = docsPag
      .filter((d) => copias[d.id] && !urlsCopia[d.id])
      .map((d) => copias[d.id].storage_path);
    if (faltan.length === 0) return;
    firmarCopias(faltan).then((urls) => {
      // urls viene por storage_path → lo paso a driveId
      const porId: Record<string, string> = {};
      for (const d of docsPag) {
        const p = copias[d.id]?.storage_path;
        if (p && urls[p]) porId[d.id] = urls[p];
      }
      if (Object.keys(porId).length) setUrlsCopia((prev) => ({ ...prev, ...porId }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pag, filtroDoc, docs, copias]);

  return (
    <Card className="legal-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-[color:var(--teal)]/10 text-[color:var(--teal)]"><HardDrive className="h-4 w-4" /></div>
        <p className="text-sm font-semibold" style={{ color: "#0B1E3A" }}>Carpeta de Drive</p>
      </div>

      {/* ---- SIN carpeta vinculada ---- */}
      {!carpetaId && !eligiendo && !puedeVincular && (
        <div className="rounded-md border border-dashed border-input p-4 text-center text-sm text-muted-foreground">
          Este expediente todavía no tiene una carpeta de Drive.
        </div>
      )}
      {!carpetaId && !eligiendo && puedeVincular && (
        <div className="space-y-3">
          {/* Sugerencias por número (expediente / crédito / gar) */}
          {(cargSug || sugerencias.length > 0) && (
            <div className="rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3">
              <p className="mb-2 text-xs font-semibold text-[color:var(--teal)]">
                {cargSug ? "Buscando carpetas que coincidan…" : "¿Es alguna de estas? (coinciden por número)"}
              </p>
              {cargSug ? (
                <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Un momento…</p>
              ) : (
                <div className="space-y-1.5">
                  {sugerencias.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2">
                      <FolderCheck className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
                      <span className="min-w-0 flex-1 truncate text-sm" title={s.name}>{s.name}</span>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">coincide: {s.coincide}</span>
                      <button onClick={() => elegir(s.id, s.name)} className="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "#0C5C46" }}>Usar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-md border border-dashed border-input p-4 text-center">
            <p className="mb-2 text-sm text-muted-foreground">
              {sugerencias.length > 0 ? "¿Ninguna es? Vincula una carpeta existente o crea una nueva." : "Este expediente todavía no tiene una carpeta de Drive."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button onClick={() => setEligiendo(true)} className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ background: "#0C5C46" }}>
                <Link2 className="h-4 w-4" /> Vincular carpeta de Drive
              </button>
              <button onClick={crearYVincular} disabled={creando} className="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60">
                {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4 text-[color:var(--teal)]" />} Crear una nueva
              </button>
            </div>
            {errorCrear && <p className="mt-2 text-xs text-red-600">{errorCrear}</p>}
            {dupAviso && <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> {dupAviso}</div>}
          </div>
        </div>
      )}

      {/* ---- CON carpeta vinculada ---- */}
      {carpetaId && !eligiendo && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <FolderCheck className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
            <span className="min-w-0 truncate text-sm font-medium" title={carpetaNombre}>{carpetaNombre || "Carpeta vinculada"}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800"><FolderCheck className="h-3 w-3" /> Vinculada</span>
            {totalDocs > 0 && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${colorSincro === "verde" ? "bg-emerald-100 text-emerald-800" : colorSincro === "amarillo" ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}
                title={colorSincro === "verde" ? "Todo copiado al sistema · este expediente ya no depende de Drive" : `Faltan ${faltanSincro} por sincronizar`}
              >
                <span className={`h-2 w-2 rounded-full ${colorSincro === "verde" ? "bg-emerald-500" : colorSincro === "amarillo" ? "bg-amber-500" : "bg-gray-400"}`} />
                {colorSincro === "verde" ? "Todo en el sistema" : `Sincronizado ${copiadosDocs}/${totalDocs}`}
              </span>
            )}
            <span className="flex-1" />
            <button onClick={refrescar} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><RefreshCw className="h-3.5 w-3.5" /> Actualizar</button>
            {puedeVincular && <button onClick={sincronizar} disabled={sincro} className="inline-flex items-center gap-1 rounded-md border border-[color:var(--teal)]/40 px-2 py-1 text-xs font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10 disabled:opacity-60">{sincro ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />} Sincronizar documentos</button>}
            {puedeVincular && <button onClick={() => { if (sugerencias.length === 0) cargarSugerencias(); setEligiendo(true); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Cambiar</button>}
            {docs.length > 0 && (selModo
              ? <button onClick={salirSel} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /> Cancelar</button>
              : <button onClick={() => setSelModo(true)} className="inline-flex items-center gap-1 rounded-md border border-[color:var(--teal)]/40 px-2 py-1 text-xs font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10"><CheckSquare className="h-3.5 w-3.5" /> Seleccionar</button>
            )}
            {puedeDrive && <a href={`https://drive.google.com/drive/folders/${carpetaId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[color:var(--teal)] hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Abrir en Drive</a>}
            <div className="relative w-44">
              <FileText className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={filtroDoc} onChange={(e) => setFiltroDoc(e.target.value)} placeholder="Buscar documento…" className="h-8 pl-8 text-xs" />
            </div>
          </div>

          {msgSincro && (
            <div className="flex items-center gap-1.5 rounded-md bg-[color:var(--teal)]/5 px-3 py-1.5 text-xs text-[color:var(--teal)]">
              <CheckCircle2 className="h-3.5 w-3.5" /> {msgSincro}
            </div>
          )}

          {selModo && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[color:var(--teal)]/40 bg-[color:var(--teal)]/5 px-3 py-2">
              <span className="text-xs font-medium text-[color:var(--teal)]">{nSelDocs} seleccionado{nSelDocs === 1 ? "" : "s"}</span>
              <button onClick={descargarSeleccionDocs} disabled={nSelDocs === 0 || descargando} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ background: "#0C5C46" }}>
                {descargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Descargar seleccionados
              </button>
            </div>
          )}
          {msgDescarga && (
            <div className="flex items-center gap-1.5 rounded-md bg-[color:var(--teal)]/5 px-3 py-1.5 text-xs text-[color:var(--teal)]">
              {descargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {msgDescarga}
            </div>
          )}

          {/* Filtro: Todos los documentos / Esta carpeta (navegar) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-md border border-input text-xs">
              <button onClick={() => cambiarModo("todos")} className={`inline-flex items-center gap-1 px-2.5 py-1 ${modoVista === "todos" ? "bg-[color:var(--teal)] text-white" : "text-muted-foreground hover:bg-muted"}`}>
                <Layers className="h-3.5 w-3.5" /> Todos los documentos
              </button>
              <button onClick={() => cambiarModo("esta")} className={`inline-flex items-center gap-1 px-2.5 py-1 ${modoVista === "esta" ? "bg-[color:var(--teal)] text-white" : "text-muted-foreground hover:bg-muted"}`}>
                <Folder className="h-3.5 w-3.5" /> Esta carpeta
              </button>
            </div>
            {/* Migas (solo al navegar) */}
            {modoVista === "esta" && rutaFicha.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {rutaFicha.map((m, i) => (
                  <span key={m.id} className="inline-flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    <button onClick={() => irMigaFicha(i)} className={`max-w-[160px] truncate ${i === rutaFicha.length - 1 ? "font-semibold text-foreground" : "text-[color:var(--teal)] hover:underline"}`}>
                      {i === 0 ? <Home className="mr-0.5 inline h-3 w-3" /> : null}{m.name}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Subcarpetas (solo en modo "Esta carpeta") */}
          {modoVista === "esta" && subcarpetas.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {subcarpetas.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:border-[color:var(--teal)]">
                  <button onClick={() => entrarSubFicha(c)} className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-[color:var(--teal)]">
                    <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                    <span className="min-w-0 truncate">{c.name}</span>
                  </button>
                  <button onClick={() => descargarSubcarpeta(c.id, c.name)} disabled={descargando} title="Descargar esta carpeta (ZIP)" className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10 disabled:opacity-50"><Download className="h-3.5 w-3.5" /> ZIP</button>
                </div>
              ))}
            </div>
          )}

          {cargando ? (
            <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Cargando documentos…</p>
          ) : error ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {error}
              <p className="mt-1 text-xs">Si dice que no hay acceso, agrega la cuenta de servicio como Lector en esa Unidad de Drive.</p>
            </div>
          ) : docsFiltrados.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {filtroDoc.trim()
                ? `Ningún documento coincide con “${filtroDoc}”.`
                : modoVista === "esta"
                ? (subcarpetas.length > 0 ? "Aquí no hay documentos sueltos. Entra a una subcarpeta." : "Esta carpeta no tiene documentos.")
                : "No se encontraron documentos (ni en subcarpetas)."}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {docsPag.map((a) => (
                  <div key={a.id} className="overflow-hidden rounded-lg border border-border bg-white">
                    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                      {selModo
                        ? <button onClick={() => toggleSelDoc(a)} className="shrink-0 text-[color:var(--teal)]" title={estaSelDoc(a.id) ? "Quitar" : "Elegir"}>{estaSelDoc(a.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}</button>
                        : <FileText className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium" title={a.name}>{a.name}</p>
                        {modoVista === "todos" && a.ruta ? <p className="truncate text-[10px] text-muted-foreground" title={a.ruta}>📁 {a.ruta}</p> : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tipoLegible(a.mimeType)}</span>
                      {copias[a.id] && <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700" title="Se ve y descarga desde el sistema">del sistema</span>}
                    </div>
                    <button onClick={() => setDocSel(a)} className="group relative block h-40 w-full bg-muted" title="Ampliar vista previa">
                      <iframe src={urlsCopia[a.id] || previewDeId(a.id)} title={a.name} loading="lazy" className="pointer-events-none h-full w-full border-0" />
                      <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
                        <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-foreground"><Maximize2 className="h-3.5 w-3.5" /> Ampliar</span>
                      </span>
                    </button>
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <button onClick={() => setDocSel(a)} className="inline-flex items-center gap-1 text-xs text-[color:var(--teal)] hover:underline"><Maximize2 className="h-3.5 w-3.5" /> Vista previa</button>
                      {urlsCopia[a.id] && <a href={`${urlsCopia[a.id]}&download=${encodeURIComponent(copias[a.id]?.nombre || a.name)}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /> Descargar</a>}
                      {puedeDrive && a.webViewLink && <a href={a.webViewLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /> Drive</a>}
                    </div>
                  </div>
                ))}
              </div>
              {docs.length > PAGE && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{docs.length} documentos · pág. {pag + 1} de {totalPag}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPagina(pag - 1)} disabled={pag === 0} className="rounded-md border border-input px-3 py-1.5 disabled:opacity-40">Anterior</button>
                    <button onClick={() => setPagina(pag + 1)} disabled={pag >= totalPag - 1} className="rounded-md border border-input px-3 py-1.5 disabled:opacity-40">Siguiente</button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ---- ESCOGER carpeta (buscador de Drive) ---- */}
      {eligiendo && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Escoge la carpeta de Drive para este expediente</p>
            <button onClick={() => setEligiendo(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          {guardando && <p className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Guardando…</p>}
          {dupAviso && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mr-1 inline h-4 w-4" /> {dupAviso}</div>}

          {sugerencias.length > 0 && (
            <div className="rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3">
              <p className="mb-2 text-xs font-semibold text-[color:var(--teal)]">¿Es alguna de estas? (coinciden por número)</p>
              <div className="space-y-1.5">
                {sugerencias.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-md border border-input bg-white px-3 py-2">
                    <FolderCheck className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
                    <span className="min-w-0 flex-1 truncate text-sm" title={s.name}>{s.name}</span>
                    <button onClick={() => elegir(s.id, s.name)} className="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "#0C5C46" }}>Usar</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Crear una nueva si no existe ninguna */}
          <div className="rounded-md border border-dashed border-input p-3 text-center">
            <p className="mb-2 text-xs text-muted-foreground">¿No existe la carpeta en Drive?</p>
            <button onClick={crearYVincular} disabled={creando} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60">
              {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4 text-[color:var(--teal)]" />} Crear una nueva para este expediente
            </button>
            {errorCrear && <p className="mt-2 text-xs text-red-600">{errorCrear}</p>}
          </div>

          {(trayendo || msgTraer) && (
            <div className="rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3 text-xs text-[color:var(--teal)]">
              {trayendo ? <><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Trayendo la carpeta a tu área (puede tardar)…</> : msgTraer}
            </div>
          )}
          <ExploradorDrive mostrarEncabezado={false} onElegirCarpeta={elegir} onTraerCarpeta={traerAMiArea} onTraerArchivos={traerArchivosAqui} />
        </div>
      )}

      {docSel && (
        <VisorDocumentoModal url={urlsCopia[docSel.id] || docSel.webViewLink || ""} driveId={urlsCopia[docSel.id] ? null : docSel.id} nombre={docSel.name} onCerrar={() => setDocSel(null)} />
      )}
    </Card>
  );
}
