import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Search, Users, Loader2, Gavel, Home, Download, UserPlus, X, Save } from "lucide-react";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes — JusticiaFácil" }] }),
  component: ClientesCRM,
});

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const fmtMXN = (v: any) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(v) || 0);

interface Cli {
  id: string; nombre: string | null; domicilio_garantia: string | null; folio: string | null;
  total: number | null; saldo: number | null; estado: string | null;
  doc_ine: boolean | null; doc_comprobante: boolean | null; doc_acta_nac: boolean | null;
  doc_curp: boolean | null; doc_csf: boolean | null; doc_acta_matri: boolean | null;
  formalizacion_solicitada: boolean | null;
  caso_juridico?: { id: string; expediente: string | null; unidad: string | null; entidad: string | null; no_credito: string | null } | null;
}
const DOCS: (keyof Cli)[] = ["doc_ine", "doc_comprobante", "doc_acta_nac", "doc_curp", "doc_csf", "doc_acta_matri"];
const nDocs = (c: Cli) => DOCS.filter((k) => c[k]).length;

// Progresión de las unidades: URRJ -> UCP -> UCM -> UFC. Si hay formalización iniciada, ya es UFC
// (aunque el caso siga marcado como UCM), porque es la etapa más avanzada.
const AREA_ORDEN = ["URRJ", "UCP", "UCM", "UDP", "UFC"];
const areaClase: Record<string, string> = {
  URRJ: "bg-purple-100 text-purple-800 border-purple-200",
  UCP: "bg-blue-100 text-blue-800 border-blue-200",
  UCM: "bg-emerald-100 text-emerald-800 border-emerald-200",
  UDP: "bg-amber-100 text-amber-800 border-amber-200",
  UFC: "bg-red-100 text-red-800 border-red-200",
};

function ClientesCRM() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cli[]>([]);
  const [casoUFC, setCasoUFC] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [entidad, setEntidad] = useState("todas");
  const [unidadFiltro, setUnidadFiltro] = useState("todas");
  const [pagina, setPagina] = useState(0);
  const [agregando, setAgregando] = useState(false);
  const PAGE = 20;

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/cliente_juicio?select=*,caso_juridico(id,expediente,unidad,entidad,no_credito)&en_papelera=eq.false&order=nombre.asc`, { headers })
      .then((r) => (r.ok ? r.json() : [])).then(setClientes).catch(() => {}).finally(() => setCargando(false));
    // Casos con formalización iniciada (UFC) — para saber cuál mostrar como área más avanzada.
    fetch(`${SUPABASE_URL}/rest/v1/formalizacion?select=caso_id&en_papelera=eq.false`, { headers })
      .then((r) => (r.ok ? r.json() : [])).then((rows: any[]) => setCasoUFC(new Set(rows.map((x) => x.caso_id).filter(Boolean)))).catch(() => {});
  }, []);

  const areaDe = (c: Cli): string => {
    if (c.caso_juridico?.id && casoUFC.has(c.caso_juridico.id)) return "UFC";
    return c.caso_juridico?.unidad || "—";
  };

  const entidades = useMemo(() => {
    const set = new Set<string>();
    for (const c of clientes) if (c.caso_juridico?.entidad) set.add(c.caso_juridico.entidad);
    return Array.from(set).sort();
  }, [clientes]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return clientes.filter((c) => {
      if (entidad !== "todas" && (c.caso_juridico?.entidad || "") !== entidad) return false;
      if (!t) return true;
      return [c.nombre, c.domicilio_garantia, c.folio, c.caso_juridico?.expediente, c.caso_juridico?.no_credito].some((v) => (v || "").toLowerCase().includes(t));
    });
  }, [clientes, q, entidad]);

  // Un renglón por cliente (agrupa sus garantías), con el área más avanzada entre todas sus garantías.
  const filas = useMemo(() => {
    const m = new Map<string, { nombre: string; nGar: number; valor: number; saldo: number; docsMin: number; formalizadas: number; areas: Set<string>; entidades: Set<string>; folios: string[]; expedientes: string[]; caso_id?: string }>();
    for (const c of filtrados) {
      const nk = (c.nombre || "—").toLowerCase().trim();
      if (!m.has(nk)) m.set(nk, { nombre: c.nombre || "—", nGar: 0, valor: 0, saldo: 0, docsMin: 6, formalizadas: 0, areas: new Set(), entidades: new Set(), folios: [], expedientes: [], caso_id: c.caso_juridico?.id });
      const f = m.get(nk)!;
      f.nGar += 1; f.valor += Number(c.total) || 0; f.saldo += Number(c.saldo) || 0;
      f.docsMin = Math.min(f.docsMin, nDocs(c));
      if (c.formalizacion_solicitada) f.formalizadas += 1;
      f.areas.add(areaDe(c));
      if (c.caso_juridico?.entidad) f.entidades.add(c.caso_juridico.entidad);
      if (c.folio) f.folios.push(c.folio);
      if (c.caso_juridico?.expediente) f.expedientes.push(c.caso_juridico.expediente);
    }
    return [...m.values()].map((f) => {
      // la más avanzada de sus áreas, según el orden de la operación
      const areaActual = [...f.areas].filter((a) => a !== "—").sort((a, b) => AREA_ORDEN.indexOf(b) - AREA_ORDEN.indexOf(a))[0] || "—";
      return { ...f, areaActual };
    })
      .filter((f) => unidadFiltro === "todas" || f.areaActual === unidadFiltro)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [filtrados, casoUFC, unidadFiltro]);

  useEffect(() => { setPagina(0); }, [q, entidad, unidadFiltro]);
  const totalPaginas = Math.max(1, Math.ceil(filas.length / PAGE));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const filasPagina = filas.slice(paginaActual * PAGE, paginaActual * PAGE + PAGE);

  const totalClientes = filas.length;
  const saldoTotal = filtrados.reduce((a, c) => a + (Number(c.saldo) || 0), 0);

  const crearCliente = async (datos: { nombre: string; domicilio_garantia: string; valor_inmueble: string; folio: string }) => {
    const v = Number(datos.valor_inmueble.replace(/[^0-9.]/g, "")) || 0;
    const body = {
      nombre: datos.nombre.trim(),
      domicilio_garantia: datos.domicilio_garantia.trim() || null,
      valor_inmueble: v || null,
      total: v || null,
      pagado: 0,
      saldo: v || null,
      folio: datos.folio.trim() || null,
      en_papelera: false,
    };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/cliente_juicio`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) {
      setAgregando(false);
      fetch(`${SUPABASE_URL}/rest/v1/cliente_juicio?select=*,caso_juridico(id,expediente,unidad,entidad,no_credito)&en_papelera=eq.false&order=nombre.asc`, { headers })
        .then((rr) => (rr.ok ? rr.json() : [])).then(setClientes).catch(() => {});
    }
    return r.ok;
  };

  const descargarExcel = () => {
    const cols = ["Cliente", "Garantías", "Área actual", "Estado/Ciudad", "Folio(s)", "Expediente(s)", "Valor total", "Saldo total", "Documentos", "Formalización"];
    const filasCSV = filas.map((f) => [
      f.nombre, f.nGar, f.areaActual, [...f.entidades].join(" / ") || "—",
      f.folios.join(" / ") || "—", f.expedientes.join(" / ") || "—",
      f.valor, f.saldo, `${f.docsMin}/6`, f.formalizadas > 0 ? `${f.formalizadas} en formalización` : "—",
    ]);
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.map(esc).join(","), ...filasCSV.map((r) => r.map(esc).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clientes"
        description="Cada cliente con cuántas garantías tiene y en qué área va cada una. Entra a su ficha para ver el detalle."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setAgregando(true)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "#2E6DA8" }}>
              <UserPlus className="h-4 w-4" /> Agregar cliente
            </button>
            <button onClick={descargarExcel} className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted">
              <Download className="h-4 w-4" /> Descargar Excel
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-2xl font-bold text-[color:#2E6DA8]">{totalClientes}</p><p className="text-xs text-muted-foreground">Clientes</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold">{filtrados.length}</p><p className="text-xs text-muted-foreground">Garantías</p></Card>
        <Card className="p-4"><p className="text-lg font-bold text-[color:#2E6DA8]">{fmtMXN(saldoTotal)}</p><p className="text-xs text-muted-foreground">Saldo total</p></Card>
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por cliente, domicilio, folio, crédito o expediente…" className="pl-9" />
          </div>
          <select value={unidadFiltro} onChange={(e) => setUnidadFiltro(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="todas">Todas las unidades</option>
            {AREA_ORDEN.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <select value={entidad} onChange={(e) => setEntidad(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="todas">Todas las ciudades/estados</option>
            {entidades.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </Card>

      {cargando ? (
        <Card className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></Card>
      ) : filas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{clientes.length === 0 ? "Aún no hay clientes cargados." : "Sin resultados con esos filtros."}</Card>
      ) : (
        <>
          {/* Tabla tipo Excel (compu) */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Cliente</th>
                    <th className="px-3 py-2.5 text-center">Garantías</th>
                    <th className="px-3 py-2.5 text-left">Área actual</th>
                    <th className="px-3 py-2.5 text-left">Ciudad/Estado</th>
                    <th className="px-3 py-2.5 text-left">Folio(s)</th>
                    <th className="px-3 py-2.5 text-right">Valor</th>
                    <th className="px-3 py-2.5 text-right">Saldo</th>
                    <th className="px-3 py-2.5 text-center">Docs</th>
                    <th className="px-3 py-2.5 text-left">Formalización</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filasPagina.map((f) => (
                    <tr key={f.nombre} onClick={() => navigate({ to: "/cliente", search: { nombre: f.nombre } as any })} className="cursor-pointer hover:bg-muted/30">
                      <td className="px-3 py-2.5 font-medium">{f.nombre}</td>
                      <td className="px-3 py-2.5 text-center"><span className="inline-flex items-center gap-1 text-[color:#2E6DA8] font-medium"><Home className="h-3 w-3" /> {f.nGar}</span></td>
                      <td className="px-3 py-2.5"><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${areaClase[f.areaActual] || "bg-muted text-muted-foreground border-border"}`}>{f.areaActual}</span></td>
                      <td className="px-3 py-2.5 text-muted-foreground">{[...f.entidades].join(" / ") || "—"}</td>
                      <td className="max-w-[160px] truncate px-3 py-2.5 text-muted-foreground" title={f.folios.join(" / ")}>{f.folios.join(" / ") || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{fmtMXN(f.valor)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-[color:#2E6DA8]">{fmtMXN(f.saldo)}</td>
                      <td className="px-3 py-2.5 text-center">{f.docsMin}/6{f.docsMin < 6 && <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">faltan</span>}</td>
                      <td className="px-3 py-2.5">{f.formalizadas > 0 ? <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-800">{f.formalizadas} en tramite</span> : <span className="text-muted-foreground">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Tarjetas (celular) — compactas */}
          <div className="space-y-1.5 md:hidden">
            {filasPagina.map((f) => (
              <Card key={f.nombre} onClick={() => navigate({ to: "/cliente", search: { nombre: f.nombre } as any })} className="cursor-pointer p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] font-semibold">{f.nombre}</p>
                  <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${areaClase[f.areaActual] || "bg-muted text-muted-foreground border-border"}`}>{f.areaActual}</span>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5 font-medium text-[color:#2E6DA8]"><Home className="h-2.5 w-2.5" /> {f.nGar}</span>
                  <span>Saldo: <b className="text-[color:#2E6DA8]">{fmtMXN(f.saldo)}</b></span>
                  {[...f.entidades].join(" / ") && <span>{[...f.entidades].join(" / ")}</span>}
                  {f.docsMin < 6 && <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-800">Faltan docs</span>}
                </p>
              </Card>
            ))}
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{filas.length} clientes · pág. {paginaActual + 1} de {totalPaginas}</span>
              <div className="flex gap-2">
                <button onClick={() => setPagina(paginaActual - 1)} disabled={paginaActual === 0} className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40">Anterior</button>
                <button onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual >= totalPaginas - 1} className="rounded-md border border-input px-3 py-1.5 text-xs disabled:opacity-40">Siguiente</button>
              </div>
            </div>
          )}
        </>
      )}

      {agregando && <AgregarClienteModal onClose={() => setAgregando(false)} onCrear={crearCliente} />}
    </div>
  );
}

function AgregarClienteModal({ onClose, onCrear }: { onClose: () => void; onCrear: (d: { nombre: string; domicilio_garantia: string; valor_inmueble: string; folio: string }) => Promise<boolean> }) {
  const [nombre, setNombre] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [valor, setValor] = useState("");
  const [folio, setFolio] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const guardar = async () => {
    if (!nombre.trim()) { setError("El nombre es obligatorio."); return; }
    setGuardando(true); setError("");
    const ok = await onCrear({ nombre, domicilio_garantia: domicilio, valor_inmueble: valor, folio });
    setGuardando(false);
    if (!ok) setError("No se pudo guardar. Intenta de nuevo.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-base font-bold" style={{ color: "#0B1E3A" }}>Agregar cliente</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Nombre completo *</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Ej. Juan Pérez López" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Domicilio de la garantía</span>
            <input value={domicilio} onChange={(e) => setDomicilio(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Valor del inmueble</span>
              <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="0" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Folio (opcional)</span>
              <input value={folio} onChange={(e) => setFolio(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Se puede dejar vacío" />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">Para ligar este cliente a un juicio y sus documentos, entra a su ficha después de crearlo.</p>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#2E6DA8" }}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </button>
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
