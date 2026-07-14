// ============================================================
//  Importar cartera (Excel) → historial de URRJ
// ------------------------------------------------------------
//  Sube uno o varios .xlsx con el formato "1407COR26_*": ESTADO,
//  CARTERA, CRÉDITO, NOMBRE DEL DEUDOR, TERRENO, CONSTRUCCION,
//  CALLE, COLONIA, CIUDAD, ESTADO, C.P, GPS BLUE, ADEUDO INICIAL,
//  VALOR GARANTIA, ETAPA PROCESAL, CREDITO INFONAVIT, SALDO
//  INFONAVIT, MINIMO. Cada fila se convierte en un borrador
//  "Pendiente" en el historial de URRJ — igual que el checkpoint
//  de "Datos básicos" — listo para que lo tome un dictaminador.
//
//  Sin repetidas: se revisa por NÚMERO DE CRÉDITO contra lo que ya
//  existe en el historial (y contra el resto del mismo archivo).
// ============================================================
import { useMemo, useRef, useState } from "react";
import { Upload, Search, MapPin, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import {
  type FilaCartera, listarCreditosExistentes, crearBorradoresEnLote,
} from "@/lib/predictamen-guardar";
import { listarAdministradoras, puedeVerNombreReal, type Administradora } from "@/lib/administradoras";

// Encabezados esperados (en el orden del Excel real) → llave interna.
const MAPA_COLUMNAS: Record<string, keyof FilaCartera> = {
  "ESTADO": "estado", "CARTERA": "cartera", "CRÉDITO": "numeroCredito", "CREDITO": "numeroCredito",
  "NOMBRE DEL DEUDOR": "deudor", "TERRENO": "terreno", "CONSTRUCCION": "construccion", "CONSTRUCCIÓN": "construccion",
  "CALLE": "calle", "COLONIA": "colonia", "CIUDAD": "ciudad", "C.P": "cp", "C.P.": "cp",
  "GPS BLUE": "gps", "ADEUDO INICIAL": "adeudoInicial", "VALOR GARANTIA": "valorGarantia", "VALOR GARANTÍA": "valorGarantia",
  "ETAPA PROCESAL": "etapaProcesal", "CREDITO INFONAVIT": "creditoInfonavit", "CRÉDITO INFONAVIT": "creditoInfonavit",
  "SALDO INFONAVIT": "saldoInfonavit", "MINIMO": "minimo", "MÍNIMO": "minimo",
};

interface FilaTabla extends FilaCartera {
  _archivo: string;
  _yaExiste: boolean;
  _repetidaEnLote: boolean;
}

/** Convierte un número de crédito que Excel a veces guarda como float gigante
 *  (por notación científica) de vuelta a texto entero, sin perder dígitos. */
function creditoATexto(v: any): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isInteger(v) ? v.toFixed(0) : String(v);
  return String(v).trim();
}

function leerHoja(wb: XLSX.WorkBook): FilaCartera[] {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const filas: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (!filas.length) return [];
  const encabezados = (filas[0] as any[]).map((h) => String(h ?? "").trim().toUpperCase());
  const idx: Partial<Record<keyof FilaCartera, number>> = {};
  encabezados.forEach((h, i) => { const k = MAPA_COLUMNAS[h]; if (k && idx[k] === undefined) idx[k] = i; });

  const out: FilaCartera[] = [];
  for (let r = 1; r < filas.length; r++) {
    const fila = filas[r];
    if (!fila || !fila.some((v) => v != null && v !== "")) continue;
    const get = (k: keyof FilaCartera) => (idx[k] !== undefined ? fila[idx[k]!] : undefined);
    const numeroCredito = creditoATexto(get("numeroCredito"));
    if (!numeroCredito) continue; // sin crédito no hay con qué evitar repetidos — se descarta
    out.push({
      estado: get("estado") ?? undefined, cartera: get("cartera") ?? undefined, numeroCredito,
      deudor: get("deudor") ?? undefined, terreno: get("terreno") ?? undefined, construccion: get("construccion") ?? undefined,
      calle: get("calle") ?? undefined, colonia: get("colonia") ?? undefined, ciudad: get("ciudad") ?? undefined,
      cp: get("cp") != null ? String(get("cp")) : undefined, gps: get("gps") ?? undefined,
      adeudoInicial: get("adeudoInicial") ?? undefined, valorGarantia: get("valorGarantia") ?? undefined,
      etapaProcesal: get("etapaProcesal") ?? undefined, creditoInfonavit: get("creditoInfonavit") ?? undefined,
      saldoInfonavit: get("saldoInfonavit") ?? undefined, minimo: get("minimo") ?? undefined,
    });
  }
  return out;
}

const norm = (s: any) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

/** Liga de Google Maps / Street View para la columna GPS BLUE ("lat,lng"). */
function ligaGoogleMaps(gps?: string): string | null {
  if (!gps) return null;
  const m = gps.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (!m) return null;
  return `https://www.google.com/maps?q=&layer=c&cbll=${m[1]},${m[2]}`;
}

type Columna = { key: keyof FilaTabla; label: string; ancho?: string };
const COLUMNAS: Columna[] = [
  { key: "numeroCredito", label: "Crédito", ancho: "w-28" },
  { key: "deudor", label: "Deudor" },
  { key: "cartera", label: "Cartera", ancho: "w-24" },
  { key: "ciudad", label: "Ciudad", ancho: "w-32" },
  { key: "estado", label: "Estado", ancho: "w-28" },
  { key: "valorGarantia", label: "Valor garantía", ancho: "w-28" },
  { key: "etapaProcesal", label: "Etapa procesal", ancho: "w-40" },
];

export function ImportarCarteraURRJ({ onCerrar, onImportado }: { onCerrar: () => void; onImportado?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filas, setFilas] = useState<FilaTabla[]>([]);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState<{ col: keyof FilaTabla; asc: boolean } | null>(null);
  const [cargandoArchivo, setCargandoArchivo] = useState(false);
  const [administradoras, setAdministradoras] = useState<Administradora[]>([]);
  const [administradoraCodigo, setAdministradoraCodigo] = useState("");
  const [rolUsuario] = useState<string | null>(null); // se resuelve arriba en URRJ; aquí solo importa el código
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useState(() => { listarAdministradoras().then(setAdministradoras); });

  const onArchivos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setCargandoArchivo(true);
    setMsg(null);
    try {
      const existentes = await listarCreditosExistentes();
      const vistasEnLote = new Set<string>();
      const nuevas: FilaTabla[] = [];
      for (const file of Array.from(files)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const parsed = leerHoja(wb);
        for (const p of parsed) {
          const key = norm(p.numeroCredito);
          const repetidaEnLote = vistasEnLote.has(key);
          if (!repetidaEnLote) vistasEnLote.add(key);
          nuevas.push({ ...p, _archivo: file.name, _yaExiste: existentes.has(key), _repetidaEnLote: repetidaEnLote });
        }
      }
      setFilas((prev) => [...prev, ...nuevas]);
      setSeleccion((prev) => {
        const s = new Set(prev);
        nuevas.forEach((f, i) => { if (!f._yaExiste && !f._repetidaEnLote) s.add(filas.length + i); });
        return s;
      });
      setMsg(`Se leyeron ${nuevas.length} filas de ${files.length} archivo(s).`);
    } catch (e) {
      setMsg("No se pudo leer el Excel: " + String((e as Error)?.message || e));
    }
    setCargandoArchivo(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const filtradas = useMemo(() => {
    const t = norm(q);
    let r = filas.map((f, i) => ({ f, i }));
    if (t) r = r.filter(({ f }) => norm([f.numeroCredito, f.deudor, f.cartera, f.ciudad, f.estado, f.colonia, f.calle, f.etapaProcesal].filter(Boolean).join(" ")).includes(t));
    if (orden) {
      const { col, asc } = orden;
      r = [...r].sort((a, b) => {
        const va = String(a.f[col] ?? ""); const vb = String(b.f[col] ?? "");
        const cmp = va.localeCompare(vb, "es", { numeric: true });
        return asc ? cmp : -cmp;
      });
    }
    return r;
  }, [filas, q, orden]);

  const ordenarPor = (col: keyof FilaTabla) => setOrden((o) => (o?.col === col ? { col, asc: !o.asc } : { col, asc: true }));

  const totalSeleccionadas = seleccion.size;
  const totalDuplicadas = filas.filter((f) => f._yaExiste || f._repetidaEnLote).length;

  const toggleFila = (i: number) => setSeleccion((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const toggleTodas = () => {
    const disponibles = filtradas.filter(({ f }) => !f._yaExiste && !f._repetidaEnLote).map(({ i }) => i);
    const todasMarcadas = disponibles.every((i) => seleccion.has(i));
    setSeleccion((s) => { const n = new Set(s); disponibles.forEach((i) => (todasMarcadas ? n.delete(i) : n.add(i))); return n; });
  };

  const importar = async () => {
    const elegidas = filas.filter((_, i) => seleccion.has(i));
    if (!elegidas.length) { setMsg("No hay filas seleccionadas."); return; }
    setImportando(true);
    setMsg(null);
    const LOTE = 50;
    let hecho = 0;
    setProgreso({ hecho: 0, total: elegidas.length });
    for (let i = 0; i < elegidas.length; i += LOTE) {
      const lote = elegidas.slice(i, i + LOTE).map((f) => ({ ...f, administradoraCodigo: administradoraCodigo || undefined }));
      const r = await crearBorradoresEnLote(lote);
      if (!r.ok) { setMsg(`Se importaron ${hecho} y luego falló: ${r.error}`); setImportando(false); return; }
      hecho += r.creados;
      setProgreso({ hecho, total: elegidas.length });
    }
    setImportando(false);
    setMsg(`✓ Se importaron ${hecho} garantías como "Pendiente" al historial de URRJ.`);
    setFilas([]); setSeleccion(new Set());
    onImportado?.();
  };

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">📥 Importar cartera (Excel) → historial de URRJ</h3>
        <button onClick={onCerrar} className="text-xs font-medium text-muted-foreground underline">Cerrar</button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Sube uno o varios .xlsx. Se revisan los números de crédito contra lo que ya existe en el historial —
        las repetidas se marcan y no se importan por default.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Administradora de este lote</label>
          <select value={administradoraCodigo} onChange={(e) => setAdministradoraCodigo(e.target.value)}
            className="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">— Sin especificar —</option>
            {administradoras.map((a) => (
              <option key={a.codigo} value={a.codigo}>{a.codigo}{puedeVerNombreReal(rolUsuario) ? ` · ${a.nombre}` : ""}</option>
            ))}
          </select>
        </div>
        <button onClick={() => inputRef.current?.click()} disabled={cargandoArchivo}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-semibold hover:bg-muted disabled:opacity-60">
          <Upload className="h-4 w-4" /> {cargandoArchivo ? "Leyendo…" : "Subir Excel(es)"}
        </button>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={(e) => onArchivos(e.target.files)} />
      </div>

      {msg && <p className="mt-2 text-xs font-medium text-[color:var(--teal)]">{msg}</p>}

      {filas.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por crédito, deudor, ciudad, colonia, etapa…"
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              {filas.length} filas leídas
            </span>
            {totalDuplicadas > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" /> {totalDuplicadas} repetidas (no se importan)
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--teal)]/10 px-2.5 py-1 text-xs font-semibold text-[color:var(--teal)]">
              <CheckCircle2 className="h-3.5 w-3.5" /> {totalSeleccionadas} seleccionadas
            </span>
          </div>

          {/* Tabla estilo Excel: encabezados fijos, ordenable por columna, scroll horizontal */}
          <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100">
                <tr>
                  <th className="w-8 border border-slate-200 p-1.5">
                    <input type="checkbox" onChange={toggleTodas}
                      checked={filtradas.filter(({ f }) => !f._yaExiste && !f._repetidaEnLote).every(({ i }) => seleccion.has(i)) && filtradas.some(({ f }) => !f._yaExiste && !f._repetidaEnLote)} />
                  </th>
                  {COLUMNAS.map((c) => (
                    <th key={c.key} onClick={() => ordenarPor(c.key)}
                      className={`cursor-pointer select-none border border-slate-200 p-1.5 text-left font-semibold hover:bg-slate-200 ${c.ancho || ""}`}>
                      {c.label} {orden?.col === c.key ? (orden.asc ? "▲" : "▼") : ""}
                    </th>
                  ))}
                  <th className="w-20 border border-slate-200 p-1.5 text-left font-semibold">Foto</th>
                  <th className="w-24 border border-slate-200 p-1.5 text-left font-semibold">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(({ f, i }) => {
                  const dup = f._yaExiste || f._repetidaEnLote;
                  const liga = ligaGoogleMaps(f.gps);
                  return (
                    <tr key={i} className={dup ? "bg-red-50 text-muted-foreground" : seleccion.has(i) ? "bg-[color:var(--teal)]/5" : "hover:bg-muted/40"}>
                      <td className="border border-slate-100 p-1.5 text-center">
                        <input type="checkbox" disabled={dup} checked={seleccion.has(i)} onChange={() => toggleFila(i)} />
                      </td>
                      {COLUMNAS.map((c) => (
                        <td key={c.key} className="truncate border border-slate-100 p-1.5">{String(f[c.key] ?? "—")}</td>
                      ))}
                      <td className="border border-slate-100 p-1.5">
                        {liga ? (
                          <a href={liga} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[color:var(--teal)] hover:underline">
                            <MapPin className="h-3.5 w-3.5" /> Ver
                          </a>
                        ) : <span className="text-muted-foreground">s/gps</span>}
                      </td>
                      <td className="border border-slate-100 p-1.5">
                        {f._yaExiste ? <span className="font-medium text-red-700">Ya existe</span>
                          : f._repetidaEnLote ? <span className="font-medium text-amber-700">Repetida en archivo</span>
                          : <span className="font-medium text-emerald-700">Nueva</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button onClick={importar} disabled={importando || !totalSeleccionadas}
              className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {importando ? <><RefreshCw className="h-4 w-4 animate-spin" /> Importando…</> : `Importar ${totalSeleccionadas} al historial`}
            </button>
            {progreso && <p className="text-xs text-muted-foreground">Lote {progreso.hecho} de {progreso.total}</p>}
          </div>
        </>
      )}
    </div>
  );
}
