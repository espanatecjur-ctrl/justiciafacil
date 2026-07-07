import { useEffect, useState } from "react";
import { GitBranch, ExternalLink, Trash2, Star } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { registrarEvento } from "@/lib/cronologia-caso";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const norm = (s: any) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const AREA_COLOR: Record<string, string> = { UCP: "#0C447C", UCM: "#0C5C46", UDP: "#7A4FB0", UFC: "#B26B00", URRJ: "#2563EB", SVT: "#0891B2" };
function areaDe(u?: string | null): string {
  const s = (u || "").toUpperCase();
  for (const a of ["UDP", "UFC", "UCM", "URRJ", "SVT", "UCP"]) if (s.includes(a)) return a;
  return "UCP";
}

interface Coincidencia { id: string; expediente: string | null; cliente: string | null; area: string; motivos: string[]; es_principal?: boolean }

/**
 * Banner de coincidencias dentro de la ficha.
 * Muestra los otros expedientes que comparten garantía, dirección, expediente o cliente,
 * en qué módulo reposan, y deja: marcar el verdadero (⭐), abrir, o mandar a papelera el repetido.
 * (Requiere la columna es_principal en caso_juridico — ver SQL.)
 */
export function BannerCoincidencias({ caso, onNavegar }: { caso: CasoJuridico; onNavegar: (id: string) => void }) {
  const [coincs, setCoincs] = useState<Coincidencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [accion, setAccion] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCargando(true);
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=id,expediente,gar_id,direccion_garantia,cliente_nombre,cliente_id,unidad,archivado,es_principal`, { headers });
        const todos = r.ok ? await r.json() : [];
        const g = norm((caso as any).gar_id), dir = norm(caso.direccion_garantia), exp = norm(caso.expediente);
        const cli = caso.cliente_id ? "id:" + caso.cliente_id : norm(caso.cliente_nombre);
        const out: Coincidencia[] = [];
        for (const o of todos) {
          if (!o.id || o.id === caso.id || o.archivado) continue;
          const motivos: string[] = [];
          if (g.length >= 3 && norm(o.gar_id) === g) motivos.push("Misma garantía");
          if (dir.length >= 6 && norm(o.direccion_garantia) === dir) motivos.push("Misma dirección");
          if (exp.length >= 3 && norm(o.expediente) === exp) motivos.push("Mismo expediente");
          const ocli = o.cliente_id ? "id:" + o.cliente_id : norm(o.cliente_nombre);
          if (cli.length >= 3 && ocli === cli) motivos.push("Mismo cliente");
          if (motivos.length) out.push({ id: o.id, expediente: o.expediente, cliente: o.cliente_nombre, area: areaDe(o.unidad), motivos, es_principal: o.es_principal });
        }
        if (vivo) setCoincs(out);
      } catch { if (vivo) setCoincs([]); }
      if (vivo) setCargando(false);
    })();
    return () => { vivo = false; };
  }, [caso.id]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify(body) });
  };

  const marcarPrincipal = async (id: string, expediente: string | null, area: string) => {
    setAccion(id);
    await patch(id, { es_principal: true });
    await registrarEvento({ caso_id: id, expediente, area, tipo: "coincidencia", texto: "Marcado como el verdadero (principal)." });
    setCoincs((p) => p.map((x) => (x.id === id ? { ...x, es_principal: true } : x)));
    setAccion(null);
  };
  const aPapelera = async (co: Coincidencia) => {
    if (!confirm(`¿Mandar a la papelera el expediente ${co.expediente || co.id}?\n\nSe marca como repetido y sale de las listas. Se puede recuperar.`)) return;
    setAccion(co.id);
    await patch(co.id, { archivado: true });
    await registrarEvento({ caso_id: co.id, expediente: co.expediente, area: co.area, tipo: "coincidencia", texto: "Enviado a papelera por repetido." });
    setCoincs((p) => p.filter((x) => x.id !== co.id));
    setAccion(null);
  };
  const marcarEste = async () => {
    setAccion(caso.id);
    await patch(caso.id, { es_principal: true });
    await registrarEvento({ caso_id: caso.id, expediente: caso.expediente, area: areaDe(caso.unidad), tipo: "coincidencia", texto: "Marcado como el verdadero (principal)." });
    setAccion(null);
  };

  if (cargando || coincs.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-800"><GitBranch className="h-4 w-4" /> {coincs.length} coincidencia{coincs.length > 1 ? "s" : ""} — revisar</p>
        <button onClick={marcarEste} disabled={accion === caso.id} className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"><Star className="h-3 w-3" /> Este es el verdadero</button>
      </div>
      <p className="mt-0.5 text-xs text-amber-700">Comparte garantía, dirección, expediente o cliente con otros. Escoge cuál es el verdadero (⭐), deja las dos si ambas valen, o manda a papelera las repetidas (🗑).</p>
      <div className="mt-2 space-y-1.5">
        {coincs.map((co) => (
          <div key={co.id} className="flex flex-wrap items-center gap-1.5 rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-xs">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: AREA_COLOR[co.area] || "#64748b" }}>{co.area}</span>
            <span className="font-medium">{co.expediente || "— sin expediente —"}</span>
            {co.cliente && <span className="text-muted-foreground">· {co.cliente}</span>}
            {co.es_principal && <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700"><Star className="h-2.5 w-2.5" /> Principal</span>}
            <span className="flex flex-wrap gap-1">{co.motivos.map((m) => <span key={m} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">{m}</span>)}</span>
            <span className="ml-auto flex items-center gap-1">
              <button onClick={() => marcarPrincipal(co.id, co.expediente, co.area)} disabled={accion === co.id} title="Marcar como el verdadero" className="grid h-6 w-6 place-items-center rounded hover:bg-amber-100"><Star className="h-3.5 w-3.5 text-amber-600" /></button>
              <button onClick={() => onNavegar(co.id)} title="Abrir para revisar" className="grid h-6 w-6 place-items-center rounded hover:bg-amber-100"><ExternalLink className="h-3.5 w-3.5 text-sky-700" /></button>
              <button onClick={() => aPapelera(co)} disabled={accion === co.id} title="Mandar a papelera (repetido)" className="grid h-6 w-6 place-items-center rounded hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-600" /></button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
