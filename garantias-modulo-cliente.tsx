// ============================================================
// GarantiasModuloCliente · en la ficha del cliente, por pestaña (URRJ/UCP/UCM).
// Encuentra las garantías de caso_juridico que hacen match por NOMBRE
// (cliente_nombre o demandado) para la unidad indicada, y muestra los
// puntos críticos de esa unidad (dictamen, firmas, documentos).
// Si el match está mal (nombre repetido, persona distinta), se puede
// "Quitar de este cliente" — no borra la garantía, solo la desliga aquí.
// ============================================================
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, FileText, PenLine, X, Landmark, MapPin } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { listarCopias } from "@/lib/drive-explorar";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\(.*$/, "").replace(/\s+/g, " ").trim();

interface Dictamen { id: string; caso_id: string; veredicto: string | null; juridico: any; registral: any; firmas: any; }
interface Predictamen { id: string; caso_id: string; dictamen_sugerido: string | null; dictamen_final: string | null; terminado: boolean | null; }

const veredictoTxt = (v: any) => {
  const s = typeof v === "string" ? v : v?.veredicto;
  return s || "Sin dictaminar";
};
const veredictoColor = (v: any) => {
  const s = (typeof v === "string" ? v : v?.veredicto || "").toUpperCase();
  if (s.includes("POSITIV") || s.includes("PROCEDEN") || s.includes("FAVORABLE")) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (s.includes("NEGATIV") || s.includes("IMPROCEDEN") || s.includes("DESFAVORABLE")) return "text-red-700 bg-red-50 border-red-200";
  return "text-muted-foreground bg-muted border-border";
};
const contarFirmas = (firmas: any) => ["elabora", "dil", "gad", "dgc", "dge"].filter((k) => firmas?.[k]?.fecha).length;
const TIPOS_GARANTIA = ["Derecho litigioso", "Casa", "Prestación de servicios", "Otro"];

export function GarantiasModuloCliente({ nombreCliente, unidad, color }: { nombreCliente: string; unidad: "URRJ" | "UCP" | "UCM"; color: string }) {
  const [casos, setCasos] = useState<CasoJuridico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [extra, setExtra] = useState<Record<string, Dictamen | Predictamen | undefined>>({});
  const [docsN, setDocsN] = useState<Record<string, number>>({});
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());

  const cargar = async () => {
    setCargando(true);
    try {
      // 1) Match amplio por nombre (cliente_nombre o demandado), filtrado por unidad, luego normalizado en el cliente.
      const objetivo = norm(nombreCliente);
      const tok = (nombreCliente || "").split(/\s+/)[0] || nombreCliente;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&unidad=eq.${unidad}&or=(cliente_nombre.ilike.*${encodeURIComponent(tok)}*,demandado.ilike.*${encodeURIComponent(tok)}*)`, { headers });
      const candidatos: CasoJuridico[] = r.ok ? await r.json() : [];
      const filtrados = candidatos.filter((c) => {
        const n1 = norm(c.cliente_nombre || ""); const n2 = norm((c as any).demandado || "");
        return (n1 && (n1 === objetivo || n1.startsWith(objetivo) || objetivo.startsWith(n1))) ||
               (n2 && (n2 === objetivo || n2.startsWith(objetivo) || objetivo.startsWith(n2)));
      });

      // 2) Excluidos (desligados a mano)
      const re = await fetch(`${SUPABASE_URL}/rest/v1/cliente_garantia_excluida?select=caso_id&cliente_nombre=eq.${encodeURIComponent(nombreCliente)}`, { headers });
      const exRows = re.ok ? await re.json() : [];
      const exSet = new Set<string>((exRows || []).map((x: any) => x.caso_id));
      setExcluidos(exSet);

      const visibles = filtrados.filter((c) => !exSet.has(c.id));
      setCasos(visibles);

      // 3) Datos extra por unidad
      const ids = visibles.map((c) => c.id);
      if (ids.length > 0) {
        if (unidad === "URRJ") {
          const rp = await fetch(`${SUPABASE_URL}/rest/v1/predictamen?select=id,caso_id,dictamen_sugerido,dictamen_final,terminado&vigente=eq.true&caso_id=in.(${ids.join(",")})`, { headers });
          const rows: Predictamen[] = rp.ok ? await rp.json() : [];
          const m: Record<string, Predictamen> = {};
          for (const x of rows) m[x.caso_id] = x;
          setExtra(m);
        } else {
          const rd = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?select=id,caso_id,veredicto,juridico,registral,firmas&vigente=eq.true&caso_id=in.(${ids.join(",")})`, { headers });
          const rows: Dictamen[] = rd.ok ? await rd.json() : [];
          const m: Record<string, Dictamen> = {};
          for (const x of rows) m[x.caso_id] = x;
          setExtra(m);
        }
        // documentos (copia fija) por caso
        const dn: Record<string, number> = {};
        await Promise.all(visibles.map(async (c) => { dn[c.id] = Object.keys(await listarCopias(c.id)).length; }));
        setDocsN(dn);
      } else {
        setExtra({}); setDocsN({});
      }
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => { cargar(); }, [nombreCliente, unidad]);

  const quitar = async (casoId: string) => {
    if (!confirm("¿Quitar esta garantía de este cliente? No se borra, solo se desliga de esta ficha.")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/cliente_garantia_excluida`, { method: "POST", headers, body: JSON.stringify({ cliente_nombre: nombreCliente, caso_id: casoId }) });
    cargar();
  };

  const setTipoGarantia = async (casoId: string, tipo: string) => {
    setCasos((p) => p.map((c) => (c.id === casoId ? { ...c, tipo_garantia: tipo } as any : c)));
    await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${casoId}`, { method: "PATCH", headers, body: JSON.stringify({ tipo_garantia: tipo || null }) });
  };

  if (cargando) return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando en {unidad}…</div>;

  if (casos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No se encontró ninguna garantía de <b>{nombreCliente}</b> en {unidad}
        {excluidos.size > 0 && <span> ({excluidos.size} desligada{excluidos.size === 1 ? "" : "s"} a mano).</span>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {casos.map((c) => {
        const dat = extra[c.id];
        return (
          <div key={c.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color }}><Landmark className="h-4 w-4" /> {c.expediente || "Sin expediente"}</p>
                <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {c.direccion_garantia || "—"}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Crédito: {c.no_credito || "—"}</p>
                <select value={(c as any).tipo_garantia || ""} onChange={(e) => setTipoGarantia(c.id, e.target.value)} className="mt-1 rounded-md border border-input bg-background px-2 py-1 text-[11px]">
                  <option value="">Tipo de garantía…</option>
                  {TIPOS_GARANTIA.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <button onClick={() => quitar(c.id)} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] text-muted-foreground hover:border-red-300 hover:text-red-600"><X className="h-3 w-3" /> Quitar de este cliente</button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              {unidad === "URRJ" ? (
                dat ? (
                  <>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${veredictoColor((dat as Predictamen).dictamen_final || (dat as Predictamen).dictamen_sugerido)}`}>Dictamen: {veredictoTxt((dat as Predictamen).dictamen_final || (dat as Predictamen).dictamen_sugerido)}</span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">{(dat as Predictamen).terminado ? "Terminado" : "En proceso"}</span>
                  </>
                ) : <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">Sin pre-dictamen</span>
              ) : (
                dat ? (
                  <>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${veredictoColor((dat as Dictamen).juridico)}`}>Jurídico: {veredictoTxt((dat as Dictamen).juridico)}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${veredictoColor((dat as Dictamen).registral)}`}>Registral: {veredictoTxt((dat as Dictamen).registral)}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${veredictoColor((dat as Dictamen).veredicto)}`}>Final: {veredictoTxt((dat as Dictamen).veredicto)}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"><PenLine className="h-3 w-3" /> {contarFirmas((dat as Dictamen).firmas)}/5 firmas</span>
                  </>
                ) : <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">Sin dictamen</span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"><FileText className="h-3 w-3" /> {docsN[c.id] ?? 0} documentos</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
