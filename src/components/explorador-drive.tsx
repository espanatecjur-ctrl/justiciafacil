// ============================================================
// ExploradorDrive · escoger una carpeta / Unidad compartida de Drive
// y ver la VISTA PREVIA de todos sus documentos, dentro de UCM.
// Solo lee (no crea, no borra). Reutiliza el visor /preview.
// ============================================================
import { useEffect, useMemo, useState, type ElementType } from "react";
import {
  HardDrive, Folder, FileText, Search, RefreshCw, ChevronRight,
  ExternalLink, Maximize2, Link2, Loader2, AlertTriangle, Copy, Home,
  LayoutGrid, List as ListIcon, FolderCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { VisorDocumentoModal } from "@/components/visor-documento";
import {
  listarUnidades, listarCarpeta, resolverEntrada, correoCuentaServicio,
  esCarpeta, previewDeId, tipoLegible, buscarEnDrive, normaliza,
  type ItemDrive, type Unidad, type ArchivoEncontrado,
} from "@/lib/drive-explorar";

type Miga = { id: string; name: string };

export function ExploradorDrive({ mostrarEncabezado = true, onElegirCarpeta, onTraerCarpeta }: { mostrarEncabezado?: boolean; onElegirCarpeta?: (id: string, nombre: string) => void; onTraerCarpeta?: (id: string, nombre: string) => void }) {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [correoSA, setCorreoSA] = useState("");
  const [cargUnidades, setCargUnidades] = useState(true);
  const [errUnidades, setErrUnidades] = useState<string | null>(null);

  const [ruta, setRuta] = useState<Miga[]>([]);        // [] = pantalla de escoger unidad
  const [items, setItems] = useState<ItemDrive[]>([]);
  const [cargItems, setCargItems] = useState(false);
  const [errItems, setErrItems] = useState<string | null>(null);

  const [manual, setManual] = useState("");
  const [resolviendo, setResolviendo] = useState(false);
  const [q, setQ] = useState("");
  const [modo, setModo] = useState<"grid" | "lista">("grid");
  const [docSel, setDocSel] = useState<ItemDrive | null>(null);
  const [copiado, setCopiado] = useState(false);

  // buscador inteligente (filtra Unidades al instante + busca dentro bajo botón)
  const [busq, setBusq] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resBusq, setResBusq] = useState<{ carpetas: Unidad[]; archivos: ArchivoEncontrado[] } | null>(null);
  const buscarDentro = async () => {
    if (normaliza(busq).length < 2) return;
    setBuscando(true); setResBusq(null);
    const r = await buscarEnDrive(busq.trim());
    setBuscando(false);
    setResBusq({ carpetas: r.carpetas, archivos: r.archivos });
  };
  const unidadesFiltradas = useMemo(() => {
    const t = normaliza(busq);
    return t ? unidades.filter((u) => normaliza(u.name).includes(t)) : unidades;
  }, [unidades, busq]);

  // --- cargar Unidades compartidas + correo de la cuenta de servicio ---
  const cargarUnidades = () => {
    setCargUnidades(true); setErrUnidades(null);
    listarUnidades()
      .then((r) => {
        if (r.correo) setCorreoSA(r.correo);
        if (!r.ok) { setErrUnidades(r.error || "No se pudieron leer las Unidades."); setUnidades([]); }
        else setUnidades(r.unidades);
      })
      .finally(() => setCargUnidades(false));
    correoCuentaServicio().then((c) => c && setCorreoSA(c));
  };
  useEffect(() => { cargarUnidades(); }, []);

  // --- abrir una carpeta (unidad o subcarpeta) ---
  const abrirCarpeta = (id: string, name: string, nuevaRuta?: Miga[]) => {
    if (nuevaRuta) setRuta(nuevaRuta);
    setCargItems(true); setErrItems(null); setItems([]); setQ("");
    listarCarpeta(id)
      .then((r) => {
        if (!r.ok) setErrItems(r.error || "No se pudo leer la carpeta.");
        setItems(r.items);
      })
      .finally(() => setCargItems(false));
  };

  const entrarUnidad = (u: Unidad) => abrirCarpeta(u.id, u.name, [{ id: u.id, name: u.name }]);
  const entrarSub = (it: ItemDrive) => abrirCarpeta(it.id, it.name, [...ruta, { id: it.id, name: it.name }]);
  const irMiga = (i: number) => { const nueva = ruta.slice(0, i + 1); abrirCarpeta(nueva[i].id, nueva[i].name, nueva); };
  const volverInicio = () => { setRuta([]); setItems([]); setErrItems(null); setQ(""); };

  // --- pegar enlace / ID ---
  const resolverManual = async () => {
    if (!manual.trim()) return;
    setResolviendo(true); setErrItems(null);
    const r = await resolverEntrada(manual.trim());
    setResolviendo(false);
    if (!r.ok || !r.item) { setErrItems(r.error || "No se pudo abrir ese enlace."); return; }
    setManual("");
    if (esCarpeta(r.item)) abrirCarpeta(r.item.id, r.item.name, [{ id: r.item.id, name: r.item.name }]);
    else setDocSel(r.item); // es un archivo suelto → vista previa directa
  };

  const copiarCorreo = () => {
    if (!correoSA) return;
    navigator.clipboard?.writeText(correoSA).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); }).catch(() => {});
  };

  // --- separar carpetas / archivos + filtro ---
  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((it) => (it.name || "").toLowerCase().includes(t)) : items;
  }, [items, q]);
  const carpetas = useMemo(() => filtrados.filter(esCarpeta), [filtrados]);
  const archivos = useMemo(() => filtrados.filter((it) => !esCarpeta(it)), [filtrados]);

  // paginación de la vista previa (para no cargar 50 iframes a la vez)
  const PAGE = 9;
  const [pagina, setPagina] = useState(0);
  useEffect(() => { setPagina(0); }, [q, ruta]);
  const totalPag = Math.max(1, Math.ceil(archivos.length / PAGE));
  const pag = Math.min(pagina, totalPag - 1);
  const archivosPag = archivos.slice(pag * PAGE, pag * PAGE + PAGE);

  const Marco: ElementType = mostrarEncabezado ? Card : "div";
  const marcoClase = mostrarEncabezado ? "legal-card p-4 space-y-4" : "space-y-4";

  return (
    <Marco className={marcoClase}>
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {mostrarEncabezado ? (
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-[color:var(--teal)]/10 text-[color:var(--teal)]"><HardDrive className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#0B1E3A" }}>Documentos desde Drive</p>
              <p className="text-xs text-muted-foreground">Escoge una carpeta y ve la vista previa de todos sus documentos.</p>
            </div>
          </div>
        ) : <span />}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setModo(modo === "grid" ? "lista" : "grid")} className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted">
            {modo === "grid" ? <><ListIcon className="h-3.5 w-3.5" /> Lista</> : <><LayoutGrid className="h-3.5 w-3.5" /> Vista previa</>}
          </button>
          <button onClick={ruta.length ? () => irMiga(ruta.length - 1) : cargarUnidades} className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted">
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar
          </button>
        </div>
      </div>

      {/* Buscador inteligente (arriba, prominente) */}
      {ruta.length === 0 && (
        <div className="space-y-2">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={busq} onChange={(e) => setBusq(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscarDentro()} placeholder="Buscar por garantía, calle, crédito…" className="pl-8" />
              </div>
              <button onClick={buscarDentro} disabled={buscando || normaliza(busq).length < 2} className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--teal)]/40 px-3 py-2 text-xs font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10 disabled:opacity-50">
                {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar también dentro de las carpetas
              </button>
            </div>

            {/* Resultados de "buscar dentro" */}
            {resBusq && (
              <div className="space-y-2 rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3">
                {resBusq.carpetas.length === 0 && resBusq.archivos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin coincidencias para “{busq}”.</p>
                ) : (
                  <>
                    {resBusq.carpetas.length > 0 && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-[color:var(--teal)]">Carpetas que coinciden</p>
                        <div className="space-y-1">
                          {resBusq.carpetas.map((c) => (
                            <div key={c.id} className="flex items-center gap-2 rounded-md border border-input bg-white px-2.5 py-1.5">
                              <Folder className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
                              <button onClick={() => abrirCarpeta(c.id, c.name, [{ id: c.id, name: c.name }])} className="min-w-0 flex-1 truncate text-left text-sm hover:underline" title={c.name}>{c.name}</button>
                              {onElegirCarpeta && <button onClick={() => onElegirCarpeta(c.id, c.name)} className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10">Usar</button>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {resBusq.archivos.length > 0 && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-[color:var(--teal)]">Documentos que coinciden</p>
                        <div className="space-y-1">
                          {resBusq.archivos.map((a) => (
                            <div key={a.id} className="flex items-center gap-2 rounded-md border border-input bg-white px-2.5 py-1.5">
                              <FileText className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm" title={a.name}>{a.name}</p>
                                {a.carpeta ? <p className="truncate text-[10px] text-muted-foreground">📁 en: {a.carpeta}</p> : null}
                              </div>
                              <button onClick={() => setDocSel({ id: a.id, name: a.name, mimeType: a.mimeType, webViewLink: a.webViewLink })} className="shrink-0 text-[color:var(--teal)] hover:underline" title="Vista previa"><Maximize2 className="h-4 w-4" /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pegar enlace / ID (funciona aunque la unidad no aparezca en la lista) */}
      <p className="text-[11px] text-muted-foreground">¿Ya tienes el enlace de la carpeta? Pégalo aquí (opcional):</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Link2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={manual} onChange={(e) => setManual(e.target.value)} onKeyDown={(e) => e.key === "Enter" && resolverManual()} placeholder="Pega el enlace o ID de una carpeta de Drive…" className="pl-8" />
        </div>
        <button onClick={resolverManual} disabled={resolviendo || !manual.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#0C5C46" }}>
          {resolviendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Abrir carpeta
        </button>
      </div>

      {/* Migas de pan */}
      {ruta.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <button onClick={volverInicio} className="inline-flex items-center gap-1 text-[color:var(--teal)] hover:underline"><Home className="h-3.5 w-3.5" /> Unidades</button>
          {ruta.map((m, i) => (
            <span key={m.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button onClick={() => irMiga(i)} className={`max-w-[220px] truncate ${i === ruta.length - 1 ? "font-semibold text-foreground" : "text-[color:var(--teal)] hover:underline"}`}>{m.name}</button>
            </span>
          ))}
        </div>
      )}

      {/* Filtro dentro de la carpeta */}
      {ruta.length > 0 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar documento por nombre…" className="pl-8" />
        </div>
      )}

      {/* ---------- Pantalla: escoger Unidad compartida ---------- */}
      {ruta.length === 0 && (
        <div className="space-y-3">
          {cargUnidades ? (
            <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Leyendo tus Unidades compartidas…</p>
          ) : (
            <>
              {unidadesFiltradas.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {unidadesFiltradas.map((u) => (
                    <div key={u.id} className="flex items-center gap-1 rounded-md border border-input hover:border-[color:var(--teal)]">
                      <button onClick={() => entrarUnidad(u)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[color:var(--teal)]/5">
                        <Folder className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
                        <span className="min-w-0 truncate">{u.name}</span>
                      </button>
                      {onElegirCarpeta && (
                        <button onClick={() => onElegirCarpeta(u.id, u.name)} title="Usar esta carpeta" className="mr-1 inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10">
                          <FolderCheck className="h-3.5 w-3.5" /> Usar
                        </button>
                      )}
                      {onTraerCarpeta && (
                        <button onClick={() => onTraerCarpeta(u.id, u.name)} title="Mover/copiar a mi área y renombrar" className="mr-1 inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-white" style={{ background: "#0C5C46" }}>
                          Traer
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Aviso cuando no ve Unidades: hay que agregar la cuenta de servicio */}
              {(unidades.length === 0 || errUnidades) && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" /> Aún no veo tus Unidades compartidas</p>
                  <p className="mt-1 text-xs">Para que el sistema pueda leerlas, agrega este correo como <b>Lector</b> en cada Unidad compartida (Administrar miembros):</p>
                  {correoSA ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="rounded bg-white px-2 py-1 text-xs">{correoSA}</code>
                      <button onClick={copiarCorreo} className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-1 text-xs hover:bg-amber-100">
                        <Copy className="h-3 w-3" /> {copiado ? "¡Copiado!" : "Copiar"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs italic">Cargando el correo de la cuenta de servicio…</p>
                  )}
                  <p className="mt-2 text-xs">Mientras tanto, puedes pegar arriba el <b>enlace de la carpeta</b> y compartir esa carpeta con ese correo.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------- Pantalla: contenido de la carpeta ---------- */}
      {ruta.length > 0 && (
        <div className="space-y-3">
          {cargItems ? (
            <p className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Abriendo carpeta…</p>
          ) : (
            <>
              {errItems && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errItems}</div>}

              {/* Modo escoger: usar la carpeta abierta actualmente */}
              {onElegirCarpeta && ruta.length > 0 && (
                <button onClick={() => { const u = ruta[ruta.length - 1]; onElegirCarpeta(u.id, u.name); }} className="flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white" style={{ background: "#0C5C46" }}>
                  <FolderCheck className="h-4 w-4" /> Usar esta carpeta: {ruta[ruta.length - 1].name}
                </button>
              )}
              {onTraerCarpeta && ruta.length > 0 && (
                <button onClick={() => { const u = ruta[ruta.length - 1]; onTraerCarpeta(u.id, u.name); }} className="flex w-full items-center justify-center gap-2 rounded-md border border-[color:var(--teal)]/50 px-4 py-2 text-sm font-semibold text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10">
                  Traer esta carpeta a mi área: {ruta[ruta.length - 1].name}
                </button>
              )}

              {/* Subcarpetas */}
              {carpetas.length > 0 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {carpetas.map((cp) => (
                    <div key={cp.id} className="flex items-center gap-1 rounded-md border border-input hover:border-[color:var(--teal)]">
                      <button onClick={() => entrarSub(cp)} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[color:var(--teal)]/5">
                        <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                        <span className="min-w-0 truncate">{cp.name}</span>
                      </button>
                      {onElegirCarpeta && (
                        <button onClick={() => onElegirCarpeta(cp.id, cp.name)} title="Usar esta carpeta" className="mr-1 inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[color:var(--teal)] hover:bg-[color:var(--teal)]/10">
                          <FolderCheck className="h-3.5 w-3.5" /> Usar
                        </button>
                      )}
                      {onTraerCarpeta && (
                        <button onClick={() => onTraerCarpeta(cp.id, cp.name)} title="Mover/copiar a mi área y renombrar" className="mr-1 inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-white" style={{ background: "#0C5C46" }}>
                          Traer
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Documentos */}
              {archivos.length === 0 && !errItems ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Esta carpeta no tiene documentos.</p>
              ) : modo === "grid" ? (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {archivosPag.map((a) => (
                      <div key={a.id} className="overflow-hidden rounded-lg border border-border bg-white">
                        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                          <FileText className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
                          <p className="min-w-0 flex-1 truncate text-xs font-medium" title={a.name}>{a.name}</p>
                          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tipoLegible(a.mimeType)}</span>
                        </div>
                        <button onClick={() => setDocSel(a)} className="group relative block h-44 w-full bg-muted" title="Ampliar vista previa">
                          <iframe src={previewDeId(a.id)} title={a.name} loading="lazy" className="pointer-events-none h-full w-full border-0" />
                          <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
                            <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-foreground"><Maximize2 className="h-3.5 w-3.5" /> Ampliar</span>
                          </span>
                        </button>
                        <div className="flex items-center justify-between px-3 py-1.5">
                          <button onClick={() => setDocSel(a)} className="inline-flex items-center gap-1 text-xs text-[color:var(--teal)] hover:underline"><Maximize2 className="h-3.5 w-3.5" /> Vista previa</button>
                          {a.webViewLink && <a href={a.webViewLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /> Drive</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {archivos.length > PAGE && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{archivos.length} documentos · pág. {pag + 1} de {totalPag}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setPagina(pag - 1)} disabled={pag === 0} className="rounded-md border border-input px-3 py-1.5 disabled:opacity-40">Anterior</button>
                        <button onClick={() => setPagina(pag + 1)} disabled={pag >= totalPag - 1} className="rounded-md border border-input px-3 py-1.5 disabled:opacity-40">Siguiente</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="divide-y divide-border rounded-md border border-border">
                  {archivos.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30">
                      <FileText className="h-4 w-4 shrink-0 text-[color:var(--teal)]" />
                      <button onClick={() => setDocSel(a)} className="min-w-0 flex-1 truncate text-left hover:underline" title={a.name}>{a.name}</button>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tipoLegible(a.mimeType)}</span>
                      <button onClick={() => setDocSel(a)} className="shrink-0 text-[color:var(--teal)] hover:underline" title="Vista previa"><Maximize2 className="h-4 w-4" /></button>
                      {a.webViewLink && <a href={a.webViewLink} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground" title="Abrir en Drive"><ExternalLink className="h-4 w-4" /></a>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Vista previa a pantalla grande */}
      {docSel && (
        <VisorDocumentoModal url={docSel.webViewLink || ""} driveId={docSel.id} nombre={docSel.name} onCerrar={() => setDocSel(null)} />
      )}
    </Marco>
  );
}
