import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2, Check, Send, Paperclip, HardDrive, FolderCheck, Folder } from "lucide-react";
import { usuarioActualEtiqueta, getAuth } from "@/lib/auth";
import { ExploradorDrive } from "@/components/explorador-drive";
import { listarTodo, esCarpeta, previewDeId, sincronizarCarpeta } from "@/lib/drive-explorar";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { listarAdministradoras, puedeVerNombreReal, crearAdministradora, type Administradora } from "@/lib/administradoras";
import { listarPredictamenesParaSelector, adjuntarDocumentosAPredictamen, type PredictamenOpcion } from "@/lib/predictamen-guardar";
import { generarResumenIA } from "@/lib/resumen-documentos";
import { generarAnalisisIA, guardarAnalisisEnCache } from "@/lib/analisis-ia";
import {
  casosParaSelector, subirDocPredictamen, crearSolicitudPredictamen, listarSolicitudesPredictamen,
  vincularCarpetaAGarantia, areaDeGarantia,
  type CasoOpcion, type DocRef, type SolicitudPredictamen,
} from "@/lib/solicitud-predictamen";

const headersDb = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export function DireccionDocumentos() {
  const [casos, setCasos] = useState<CasoOpcion[]>([]);
  const [casoId, setCasoId] = useState("");
  const [area, setArea] = useState("URRJ");
  const [tipoDictamen, setTipoDictamen] = useState("Jurídico");
  const [nota, setNota] = useState("");
  const [docs, setDocs] = useState<DocRef[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [lista, setLista] = useState<SolicitudPredictamen[]>([]);
  const inputFile = useRef<HTMLInputElement>(null);

  // Historial de URRJ (predictamen): se usa para que el buscador de garantía
  // encuentre también lo que ya trae URRJ (incluidos los "Pendiente"), no
  // solo lo que ya está registrado en caso_juridico.
  const [predictamenes, setPredictamenes] = useState<PredictamenOpcion[]>([]);
  useEffect(() => { listarPredictamenesParaSelector().then(setPredictamenes); }, []);
  // Cuando se elige un resultado del historial de URRJ que NO tiene caso_id
  // todavía, se guardan sus datos aquí (no hay fila de caso_juridico que leer).
  const [garantiaManual, setGarantiaManual] = useState<{ predictamenId?: string; expediente?: string | null; cliente?: string | null; juzgado?: string | null } | null>(null);

  // Administradora: se guarda el CÓDIGO. El nombre real solo se pinta/edita si eres DGE.
  const [administradoraCodigo, setAdministradoraCodigo] = useState("");
  const [administradoras, setAdministradoras] = useState<Administradora[]>([]);
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const verNombreReal = puedeVerNombreReal(rolUsuario);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [agregandoAdmin, setAgregandoAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const auth = await getAuth();
        const { data } = await auth.auth.getSession();
        const correo = data.session?.user?.email;
        if (!correo) return;
        const r = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers: headersDb });
        const j = r.ok ? await r.json() : [];
        setRolUsuario(j?.[0]?.rol ?? null);
      } catch { /* si falla, se queda sin rol */ }
    })();
    listarAdministradoras().then(setAdministradoras);
  }, []);

  const agregarAdministradora = async () => {
    if (!nuevoCodigo.trim() || !nuevoNombre.trim()) return;
    setAgregandoAdmin(true);
    const r = await crearAdministradora(nuevoCodigo, nuevoNombre);
    setAgregandoAdmin(false);
    if (r.ok) {
      const lista = await listarAdministradoras();
      setAdministradoras(lista);
      setAdministradoraCodigo(nuevoCodigo.trim());
      setNuevoCodigo(""); setNuevoNombre("");
    } else {
      setMsg("No se pudo guardar la administradora: " + (r.error || ""));
    }
  };

  // --- Escoger una carpeta de Drive (en vez de subir archivo por archivo) ---
  const [carpetaSel, setCarpetaSel] = useState<{ id: string; nombre: string } | null>(null);
  const [docsCarpeta, setDocsCarpeta] = useState<DocRef[]>([]);
  const [cargandoCarpeta, setCargandoCarpeta] = useState(false);
  const [errCarpeta, setErrCarpeta] = useState<string | null>(null);
  const [exploradorAbierto, setExploradorAbierto] = useState(false);

  const recargar = () => listarSolicitudesPredictamen("pendiente").then(setLista);
  useEffect(() => { casosParaSelector().then(setCasos); recargar(); }, []);

  const caso = casos.find((c) => c.id === casoId);

  const onArchivos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setSubiendo(true);
    setMsg(null);
    try {
      for (const f of Array.from(files)) {
        const ref = await subirDocPredictamen(f);
        setDocs((d) => [...d, ref]);
      }
    } catch (e) {
      setMsg(String((e as Error)?.message || e));
    }
    setSubiendo(false);
    if (inputFile.current) inputFile.current.value = "";
  };

  // Cuando cambia la garantía, se limpia la carpeta escogida (para no mezclar contextos).
  const cambiarCaso = (id: string) => {
    setCasoId(id);
    setGarantiaManual(null);
    setCarpetaSel(null); setDocsCarpeta([]); setErrCarpeta(null);
  };
  // Se eligió un resultado del historial de URRJ que no tiene caso_id (por
  // ejemplo un borrador "Pendiente"): no hay fila de caso_juridico que leer,
  // así que se guardan sus datos directo y se manda con caso_id vacío.
  const elegirDesdeURRJ = (p: PredictamenOpcion) => {
    setCasoId(p.caso_id || "");
    setGarantiaManual({ predictamenId: p.id, expediente: p.expediente, cliente: p.cliente, juzgado: p.juzgado });
    setCarpetaSel(null); setDocsCarpeta([]); setErrCarpeta(null);
  };

  // Lee TODOS los documentos de una carpeta de Drive (recursivo) y los deja
  // listos como referencias {nombre, url} — igual que los archivos subidos.
  const usarCarpeta = async (id: string, nombre: string) => {
    setExploradorAbierto(false);
    setCarpetaSel({ id, nombre });
    setDocsCarpeta([]);
    setErrCarpeta(null);
    setCargandoCarpeta(true);
    const r = await listarTodo(id);
    if (!r.ok) {
      setErrCarpeta(r.error || "No se pudo leer la carpeta de Drive.");
      setCargandoCarpeta(false);
      return;
    }
    const archivos = r.items.filter((it) => !esCarpeta(it));
    setDocsCarpeta(archivos.map((it) => ({ nombre: it.name, url: previewDeId(it.id) })));
    setCargandoCarpeta(false);
  };

  const quitarCarpeta = () => { setCarpetaSel(null); setDocsCarpeta([]); setErrCarpeta(null); };

  // "Leer con IA" desde aquí mismo (Dirección) — no espera a que URRJ dictamine
  // para leer los documentos: en cuanto están listos, ya se puede analizar y
  // dejar guardadas las sugerencias (resumen + cuestionario) para cuando
  // alguien tome el pre-dictamen, sea Actor o Demandado.
  const [leyendoIA, setLeyendoIA] = useState(false);
  const [msgIA, setMsgIA] = useState<string | null>(null);
  const leerConIA = async () => {
    const todos = [...docs, ...docsCarpeta];
    if (!todos.length) { setMsgIA("Sube archivos o escoge una carpeta de Drive primero."); return; }
    const clave = (caso?.no_credito || garantiaManual?.expediente || caso?.expediente || "").trim();
    if (!clave) { setMsgIA("Necesito al menos el número de crédito o el expediente de la garantía para poder guardar el análisis — captúralo o elígela de la lista."); return; }
    setLeyendoIA(true); setMsgIA(null);
    try {
      const rResumen = await generarResumenIA(clave, todos, clave);
      if (!rResumen.ok) throw new Error(rResumen.error || "No se pudo leer los documentos.");
      const rAnalisis = await generarAnalisisIA(clave, "Actor", todos);
      if (rAnalisis.ok && rAnalisis.analisis) {
        // Actor y Demandado comparten hoy el mismo cuestionario — se reaprovecha
        // la misma respuesta para Demandado SIN volver a gastar IA.
        await guardarAnalisisEnCache({ ...rAnalisis.analisis, posicion: "Demandado" });
      }
      setMsgIA(`✓ Listo — se leyeron ${todos.length} documento(s) y quedaron guardadas las sugerencias para cuando se dictamine (Actor y Demandado).`);
    } catch (e) {
      setMsgIA("⚠️ " + String((e as Error)?.message || e));
    } finally {
      setLeyendoIA(false);
    }
  };

  const enviar = async () => {
    if (!casoId && !garantiaManual) { setMsg("Escoge la garantía / expediente."); return; }
    if (!area) { setMsg("Escoge el área a la que van los documentos."); return; }
    const todos = [...docs, ...docsCarpeta];
    if (!todos.length) { setMsg("Sube archivos o escoge una carpeta de Drive."); return; }
    setEnviando(true);
    setMsg(null);
    const quien = await usuarioActualEtiqueta();
    const usaTipo = area === "URRJ" || area === "UCP";
    const r = await crearSolicitudPredictamen({
      caso_id: casoId || null,
      expediente: caso?.expediente ?? garantiaManual?.expediente ?? null,
      cliente: caso?.cliente_nombre ?? garantiaManual?.cliente ?? null,
      juzgado: caso?.juzgado ?? garantiaManual?.juzgado ?? null,
      area,
      tipo_dictamen: usaTipo ? tipoDictamen : null,
      administradora_codigo: administradoraCodigo || null,
      numero_credito: caso?.no_credito ?? null,
      nota: nota || null,
      documentos: todos,
      solicitado_por: quien,
    });
    setEnviando(false);
    if (r.ok) {
      // Si escogió una carpeta de Drive, la reflejamos en la ficha de la garantía
      // (solo si hay caso_juridico vinculado; los del historial URRJ sin caso_id no aplican).
      const conCarpeta = !!carpetaSel;
      let msgCopia = "";
      if (carpetaSel && casoId) {
        await vincularCarpetaAGarantia(casoId, carpetaSel.id, carpetaSel.nombre);
        // Copia fija: descarga los documentos de esa carpeta al almacén del
        // sistema, para que también se vean en "Ficha → Documentos". Se
        // reintenta unas cuantas veces por si la carpeta trae muchos archivos.
        for (let intento = 0; intento < 5; intento++) {
          const s = await sincronizarCarpeta(casoId, carpetaSel.id, area, caso?.no_credito || undefined, caso?.cliente_nombre || undefined);
          if (!s.ok) { msgCopia = " · aviso: no se pudo copiar a la ficha (" + (s.error || "") + ")"; break; }
          if (!s.restantes || s.restantes <= 0) { msgCopia = " · copia fija lista en la ficha ✓"; break; }
        }
      }
      // Si la garantía venía del historial de URRJ (sin caso_juridico todavía), los
      // documentos también se guardan directo en la ficha de ese pre-dictamen —
      // así "tiene espacio" aunque no exista una garantía formal aún.
      if (!casoId && garantiaManual?.predictamenId) {
        await adjuntarDocumentosAPredictamen(garantiaManual.predictamenId, todos);
      }
      setMsg((conCarpeta ? "Enviado ✓ · carpeta reflejada en la garantía" : "Enviado a pre-dictaminar ✓") + msgCopia);
      setCasoId(""); setNota(""); setDocs([]); setAdministradoraCodigo(""); setGarantiaManual(null);
      setCarpetaSel(null); setDocsCarpeta([]); setErrCarpeta(null);
      recargar();
    } else {
      setMsg("No se pudo enviar: " + (r.error || "") + " (¿corriste el SQL de solicitud_predictamen?)");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="legal-card p-5">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-[color:var(--teal)]" />
          <h3 className="font-display text-base font-semibold">Documentos → pre-dictamen</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Sube documentos de una garantía y mándalos a pre-dictaminar.</p>

        <div className="mt-4 grid gap-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Garantía / expediente</label>
            <SelectorGarantiaBuscable
              casos={casos} casoId={casoId} onElegir={cambiarCaso}
              predictamenes={area === "URRJ" ? predictamenes : []}
              seleccionManual={garantiaManual}
              onElegirDesdeURRJ={elegirDesdeURRJ}
              area={area}
            />
          </div>

          {caso && (
            <p className="text-xs text-muted-foreground">
              <span className="mr-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground">Área actual: {areaDeGarantia(caso.unidad)}</span>
              {caso.cliente_nombre ? <>Cliente: <b>{caso.cliente_nombre}</b> · </> : null}{caso.juzgado || "Sin juzgado"}
            </p>
          )}
          {!caso && garantiaManual && (
            <p className="text-xs text-muted-foreground">
              <span className="mr-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Del historial URRJ (sin caso_juridico todavía)</span>
              {garantiaManual.cliente ? <>Cliente: <b>{garantiaManual.cliente}</b> · </> : null}{garantiaManual.juzgado || "Sin juzgado"}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Área a la que van</label>
              <select value={area} onChange={(e) => setArea(e.target.value)}
                className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="URRJ">URRJ · Resolución Jurídica</option>
                <option value="UCP">UCP · Consolidación Patrimonial</option>
                <option value="UFC">UFC · Formalizaciones</option>
                <option value="UDP">UDP · Defensa y Protección</option>
              </select>
            </div>
            {(area === "URRJ" || area === "UCP") && (
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Tipo de dictamen</label>
                <select value={tipoDictamen} onChange={(e) => setTipoDictamen(e.target.value)}
                  className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="Jurídico">Jurídico (¿es litigable?)</option>
                  <option value="Registral">Registral (RPPC)</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Administradora</label>
            <select value={administradoraCodigo} onChange={(e) => setAdministradoraCodigo(e.target.value)}
              className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">— Sin especificar —</option>
              {administradoras.map((a) => (
                <option key={a.codigo} value={a.codigo}>{a.codigo}{verNombreReal ? ` · ${a.nombre}` : ""}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {verNombreReal ? "Ves el nombre real porque tu rol es DGE. Los demás roles solo ven el código." : "Solo ves el código; el nombre real de la administradora solo lo ve el rol DGE."}
            </p>
            {verNombreReal && (
              <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-2">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground">Código nuevo</label>
                  <input value={nuevoCodigo} onChange={(e) => setNuevoCodigo(e.target.value)} placeholder="ADM-004"
                    className="mt-0.5 h-8 w-28 rounded-md border border-input bg-background px-2 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground">Nombre real</label>
                  <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Nombre de la administradora"
                    className="mt-0.5 h-8 w-48 rounded-md border border-input bg-background px-2 text-xs" />
                </div>
                <button type="button" onClick={agregarAdministradora} disabled={agregandoAdmin || !nuevoCodigo.trim() || !nuevoNombre.trim()}
                  className="h-8 rounded-md bg-[color:var(--teal)] px-3 text-xs font-semibold text-white disabled:opacity-50">
                  {agregandoAdmin ? "Guardando…" : "+ Agregar al catálogo"}
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Nota para el dictaminador (opcional)</label>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2}
              className="mt-0.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Documentos</label>
            <div
              onClick={() => inputFile.current?.click()}
              className="mt-0.5 cursor-pointer rounded-lg border border-dashed border-border bg-muted/20 p-5 text-center text-sm text-muted-foreground hover:bg-muted/40"
            >
              {subiendo ? <><Loader2 className="mx-auto mb-1 h-5 w-5 animate-spin" /> Subiendo…</> : <><Upload className="mx-auto mb-1 h-5 w-5" /> Da clic para subir documentos</>}
            </div>
            <input ref={inputFile} type="file" multiple className="hidden" onChange={(e) => onArchivos(e.target.files)} />
            {docs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {docs.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--teal)]/10 px-2.5 py-1 text-xs text-[color:var(--teal)]">
                    <FileText className="h-3.5 w-3.5" /> {d.nombre}
                    <button onClick={() => setDocs((x) => x.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ---- o escoger una carpeta de Drive ---- */}
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> o escoge una carpeta de Drive <span className="h-px flex-1 bg-border" />
            </div>

            {!carpetaSel ? (
              <div className="flex flex-wrap gap-2">
                {caso?.drive_carpeta_id && (
                  <button
                    onClick={() => usarCarpeta(caso.drive_carpeta_id!, caso.drive_carpeta_nombre || "Carpeta de la garantía")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--teal)]/40 bg-[color:var(--teal)]/5 px-3 py-2 text-xs font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10"
                  >
                    <FolderCheck className="h-4 w-4" /> Usar la carpeta de la garantía
                    <span className="max-w-[180px] truncate font-normal opacity-80">· {caso.drive_carpeta_nombre || "vinculada"}</span>
                  </button>
                )}
                <button
                  onClick={() => setExploradorAbierto(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-white px-3 py-2 text-xs font-medium hover:bg-muted"
                >
                  <HardDrive className="h-4 w-4" /> {caso?.drive_carpeta_id ? "Escoger otra carpeta de Drive" : "Escoger carpeta de Drive"}
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Folder className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[color:var(--teal)]">{carpetaSel.nombre}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {cargandoCarpeta
                          ? "Leyendo documentos de la carpeta…"
                          : errCarpeta
                            ? errCarpeta
                            : `${docsCarpeta.length} documento(s) listos para mandar`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {cargandoCarpeta && <Loader2 className="h-4 w-4 animate-spin text-[color:var(--teal)]" />}
                    <button onClick={() => setExploradorAbierto(true)} className="rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted" title="Cambiar carpeta">cambiar</button>
                    <button onClick={quitarCarpeta} className="rounded p-1 text-muted-foreground hover:bg-muted" title="Quitar carpeta"><X className="h-4 w-4" /></button>
                  </div>
                </div>
                {!cargandoCarpeta && docsCarpeta.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {docsCarpeta.map((d, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[11px] text-muted-foreground">
                        <FileText className="h-3 w-3" /> <span className="max-w-[160px] truncate">{d.nombre}</span>
                      </span>
                    ))}
                  </div>
                )}
                {!cargandoCarpeta && !errCarpeta && docsCarpeta.length === 0 && (
                  <p className="mt-2 text-[11px] text-amber-700">Esta carpeta no tiene documentos (solo subcarpetas o está vacía).</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={enviar} disabled={enviando || subiendo} className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
              <Send className="h-4 w-4 mr-1.5" /> {enviando ? "Enviando…" : "Enviar a pre-dictaminar"}
            </Button>
            <Button onClick={leerConIA} disabled={leyendoIA || (docs.length + docsCarpeta.length === 0)}
              variant="outline" className="border-purple-300 text-purple-800 hover:bg-purple-50">
              🤖 {leyendoIA ? "Leyendo…" : "Leer con IA"}
            </Button>
            {msg && <span className={`text-xs font-medium ${msg.startsWith("Enviado") ? "text-emerald-700" : "text-red-700"}`}>{msg}</span>}
            {msgIA && <span className={`text-xs font-medium ${msgIA.startsWith("✓") ? "text-emerald-700" : "text-red-700"}`}>{msgIA}</span>}
          </div>
        </div>
      </Card>

      <Card className="legal-card p-5">
        <h3 className="font-display text-base font-semibold">Enviadas a pre-dictaminar (pendientes)</h3>
        {lista.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {lista.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-semibold">Exp. {s.expediente || "—"} {s.cliente ? <span className="font-normal text-muted-foreground">· {s.cliente}</span> : null}</p>
                  <p className="text-xs text-muted-foreground">
                    <Paperclip className="mr-1 inline h-3 w-3" />{s.documentos?.length || 0} documento(s){s.created_at ? ` · ${new Date(s.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {s.area && <span className="rounded-full bg-[color:var(--teal)]/10 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--teal)]">{s.area}</span>}
                    {s.tipo_dictamen && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Dictamen {s.tipo_dictamen}</span>}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                  <Check className="h-3 w-3" /> En pre-dictamen
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal: explorador de Drive para escoger la carpeta */}
      {exploradorAbierto && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setExploradorAbierto(false)}>
          <div className="my-6 w-full max-w-3xl rounded-xl border border-border bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold">
                <HardDrive className="h-5 w-5 text-[color:var(--teal)]" /> Escoge la carpeta de Drive
              </h3>
              <button onClick={() => setExploradorAbierto(false)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <p className="px-4 pt-3 text-xs text-muted-foreground">Entra a la carpeta que quieras mandar y dale <b>“Usar”</b>. Se leerán todos sus documentos (incluidas subcarpetas).</p>
            <div className="max-h-[70vh] overflow-y-auto p-4">
              <ExploradorDrive mostrarEncabezado={false} onElegirCarpeta={usarCarpeta} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Selector de garantía BUSCABLE — escribes nombre o expediente
// y filtra las coincidencias (en vez de un dropdown largo).
// ============================================================
function SelectorGarantiaBuscable({ casos, casoId, onElegir, predictamenes = [], seleccionManual, onElegirDesdeURRJ, area }: {
  casos: CasoOpcion[];
  casoId: string;
  onElegir: (id: string) => void;
  /** Historial de URRJ (solo se pasa cuando Área = URRJ) para ampliar la búsqueda. */
  predictamenes?: PredictamenOpcion[];
  seleccionManual?: { expediente?: string | null; cliente?: string | null; juzgado?: string | null } | null;
  onElegirDesdeURRJ?: (p: PredictamenOpcion) => void;
  /** Área elegida arriba (URRJ/UCP/UFC/UDP): solo se buscan garantías de esa unidad. */
  area?: string;
}) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sel = casos.find((c) => c.id === casoId);

  useEffect(() => {
    const cerrar = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtro = norm(q.trim());
  const refDe = (c: CasoOpcion) => norm([
    c.expediente, c.cliente_nombre, c.no_credito, c.direccion_garantia,
    c.juzgado, c.entidad, c.unidad, c.gar_id, c.cliente_codigo, areaDeGarantia(c.unidad),
  ].filter(Boolean).join(" "));
  const casosDeEsaArea = area ? casos.filter((c) => areaDeGarantia(c.unidad) === area) : casos;
  const resultadosCasos = (filtro
    ? casosDeEsaArea.filter((c) => refDe(c).includes(filtro))
    : casosDeEsaArea
  ).slice(0, 40);

  // Del historial URRJ: solo los que NO tienen ya una fila en caso_juridico
  // (esos ya salen arriba desde `casos`) — para no duplicar el mismo resultado dos veces.
  const idsCasosYaListados = new Set(casos.map((c) => c.id));
  const refDePred = (p: PredictamenOpcion) => norm([
    p.expediente, p.cliente, p.no_credito, p.direccion, p.juzgado, p.folio, "URRJ",
  ].filter(Boolean).join(" "));
  const resultadosURRJ = predictamenes
    .filter((p) => !(p.caso_id && idsCasosYaListados.has(p.caso_id)))
    .filter((p) => (filtro ? refDePred(p).includes(filtro) : true))
    .slice(0, 20);

  const etiqueta = (c: CasoOpcion) => `[${areaDeGarantia(c.unidad)}] ${c.expediente || "s/exp"}${c.cliente_nombre ? ` · ${c.cliente_nombre}` : ""}`;
  const etiquetaManual = seleccionManual ? `[URRJ] ${seleccionManual.expediente || "s/exp"}${seleccionManual.cliente ? ` · ${seleccionManual.cliente}` : ""}` : "";

  return (
    <div ref={ref} className="relative mt-0.5">
      <input
        value={abierto ? q : (sel ? etiqueta(sel) : (seleccionManual ? etiquetaManual : ""))}
        onChange={(e) => { setQ(e.target.value); setAbierto(true); }}
        onFocus={() => { setQ(""); setAbierto(true); }}
        placeholder="Busca por cliente, expediente, crédito, dirección…"
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
      {abierto && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-input bg-background shadow-lg">
          {resultadosCasos.length === 0 && resultadosURRJ.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Sin coincidencias.</p>
          ) : (
            <>
              {resultadosCasos.map((c) => {
                const sub = [c.no_credito ? `Créd. ${c.no_credito}` : "", c.direccion_garantia || ""].filter(Boolean).join(" · ");
                return (
                  <button
                    key={c.id}
                    onClick={() => { onElegir(c.id); setAbierto(false); setQ(""); }}
                    className={`block w-full px-3 py-2 text-left hover:bg-muted ${c.id === casoId ? "bg-muted/60" : ""}`}
                  >
                    <span className="block truncate text-sm">{etiqueta(c)}</span>
                    {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
                  </button>
                );
              })}
              {resultadosURRJ.length > 0 && (
                <p className="border-t border-border bg-muted/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Historial de URRJ</p>
              )}
              {resultadosURRJ.map((p) => {
                const sub = [p.folio ? `Folio ${p.folio}` : "", p.no_credito ? `Créd. ${p.no_credito}` : "", p.direccion || ""].filter(Boolean).join(" · ");
                return (
                  <button
                    key={`pred-${p.id}`}
                    onClick={() => { onElegirDesdeURRJ?.(p); setAbierto(false); setQ(""); }}
                    className="block w-full px-3 py-2 text-left hover:bg-muted"
                  >
                    <span className="block truncate text-sm">[URRJ] {p.expediente || "s/exp"}{p.cliente ? ` · ${p.cliente}` : ""}{p.borrador ? " · Pendiente" : ""}</span>
                    {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
