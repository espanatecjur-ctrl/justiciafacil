// ============================================================
// GarantiasModuloCliente · en la ficha del cliente, por pestaña (URRJ/UCP/UCM).
// Encuentra las garantías de caso_juridico que hacen match por NOMBRE
// (cliente_nombre o demandado), comparando la unidad en el cliente
// (igual que en ucm.tsx/ucp.tsx: nunca por filtro exacto en el server,
// porque la columna trae mayúsculas/minúsculas distintas según el caso).
// Formato copiado de la ficha de UCM (secciones con filas dato:valor),
// no tarjetas de banner — con azul claro (color de confianza) para clientes.
// Si el match está mal (nombre repetido, persona distinta), se puede
// "Quitar de este cliente" — no borra la garantía, solo la desliga aquí.
// ============================================================
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, FileText, PenLine, X, Landmark } from "lucide-react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { listarCopias } from "@/lib/drive-explorar";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\(.*$/, "").replace(/\s+/g, " ").trim();
const AZUL = "#2E6DA8"; // azul claro — "de confianza" para la parte de clientes

interface Dictamen { id: string; caso_id: string; veredicto: string | null; juridico: any; registral: any; firmas: any; }
interface Predictamen { id: string; caso_id: string; dictamen_sugerido: string | null; dictamen_final: string | null; terminado: boolean | null; }

const veredictoTxt = (v: any) => {
  const s = typeof v === "string" ? v : v?.veredicto;
  return s || "Sin dictaminar";
};
const contarFirmas = (firmas: any) => ["elabora", "dil", "gad", "dgc", "dge"].filter((k) => firmas?.[k]?.fecha).length;
const TIPOS_GARANTIA = ["Derecho litigioso", "Casa", "Prestación de servicios", "Otro"];

// Fila dato:valor — mismo patrón que DatoUCP de la ficha de UCM.
function Dato({ label, valor, importante }: { label: string; valor?: string | null; importante?: boolean }) {
  const vacio = !valor || !String(valor).trim();
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{vacio ? (importante ? <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3" /> falta</span> : "—") : valor}</span>
    </div>
  );
}
function Seccion({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: AZUL }}>{icon} {titulo}</p>
      {children}
    </div>
  );
}

export function GarantiasModuloCliente({ nombreCliente, unidad }: { nombreCliente: string; unidad: "URRJ" | "UCP" | "UCM" }) {
  const [casos, setCasos] = useState<CasoJuridico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [extra, setExtra] = useState<Record<string, Dictamen | Predictamen | undefined>>({});
  const [docsN, setDocsN] = useState<Record<string, number>>({});
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  const [totalNombre, setTotalNombre] = useState(0);

  const cargar = async () => {
    setCargando(true);
    try {
      // 1) Match amplio por nombre (cliente_nombre o demandado) — SIN filtrar unidad en el server.
      const objetivo = norm(nombreCliente);
      const tok = (nombreCliente || "").split(/\s+/)[0] || nombreCliente;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?select=*&or=(cliente_nombre.ilike.*${encodeURIComponent(tok)}*,demandado.ilike.*${encodeURIComponent(tok)}*)`, { headers });
      const candidatos: CasoJuridico[] = r.ok ? await r.json() : [];
      const porNombre = candidatos.filter((c) => {
        const n1 = norm(c.cliente_nombre || ""); const n2 = norm((c as any).demandado || "");
        return (n1 && (n1 === objetivo || n1.startsWith(objetivo) || objetivo.startsWith(n1))) ||
               (n2 && (n2 === objetivo || n2.startsWith(objetivo) || objetivo.startsWith(n2)));
      });
      setTotalNombre(porNombre.length);
      // 2) Filtra por unidad EN EL CLIENTE, comparando en mayúsculas (la columna trae formatos distintos).
      const filtrados = porNombre.filter((c) => (c.unidad || "").toUpperCase().trim() === unidad);

      // 3) Excluidos (desligados a mano)
      const re = await fetch(`${SUPABASE_URL}/rest/v1/cliente_garantia_excluida?select=caso_id&cliente_nombre=eq.${encodeURIComponent(nombreCliente)}`, { headers });
      const exRows = re.ok ? await re.json() : [];
      const exSet = new Set<string>((exRows || []).map((x: any) => x.caso_id));
      setExcluidos(exSet);

      const visibles = filtrados.filter((c) => !exSet.has(c.id));
      setCasos(visibles);

      // 4) Datos extra por unidad
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
        No se encontró ninguna garantía de <b>{nombreCliente}</b> en {unidad}.
        {totalNombre > 0 && <span> (Sí hay {totalNombre} garantía{totalNombre === 1 ? "" : "s"} con ese nombre en otras unidades.)</span>}
        {excluidos.size > 0 && <span> {excluidos.size} desligada{excluidos.size === 1 ? "" : "s"} a mano.</span>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {casos.map((c) => {
        const dat = extra[c.id];
        return (
          <div key={c.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: AZUL }}><Landmark className="h-4 w-4" /> {c.expediente || "Sin expediente"}</p>
              <button onClick={() => quitar(c.id)} className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-[11px] text-muted-foreground hover:border-red-300 hover:text-red-600"><X className="h-3 w-3" /> Quitar de este cliente</button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Seccion icon={<Landmark className="h-4 w-4" style={{ color: AZUL }} />} titulo="Antecedente de la garantía">
                <Dato label="Dirección de la garantía" valor={c.direccion_garantia} importante />
                <Dato label="No. de crédito" valor={c.no_credito} importante />
                <Dato label="Entidad" valor={c.entidad} />
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-xs text-muted-foreground">Tipo de garantía</span>
                  <select value={(c as any).tipo_garantia || ""} onChange={(e) => setTipoGarantia(c.id, e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs">
                    <option value="">Sin clasificar</option>
                    {TIPOS_GARANTIA.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </Seccion>

              <Seccion icon={<PenLine className="h-4 w-4" style={{ color: AZUL }} />} titulo={unidad === "URRJ" ? "Pre-dictamen" : "Dictamen"}>
                {unidad === "URRJ" ? (
                  dat ? (
                    <>
                      <Dato label="Dictamen" valor={veredictoTxt((dat as Predictamen).dictamen_final || (dat as Predictamen).dictamen_sugerido)} />
                      <Dato label="Estatus" valor={(dat as Predictamen).terminado ? "Terminado" : "En proceso"} />
                    </>
                  ) : <Dato label="Dictamen" valor={null} importante />
                ) : (
                  dat ? (
                    <>
                      <Dato label="Jurídico" valor={veredictoTxt((dat as Dictamen).juridico)} />
                      <Dato label="Registral" valor={veredictoTxt((dat as Dictamen).registral)} />
                      <Dato label="Veredicto final" valor={veredictoTxt((dat as Dictamen).veredicto)} />
                      <Dato label="Firmas" valor={`${contarFirmas((dat as Dictamen).firmas)}/5`} />
                    </>
                  ) : <Dato label="Dictamen" valor={null} importante />
                )}
                <Dato label="Documentos en el sistema" valor={String(docsN[c.id] ?? 0)} />
              </Seccion>
            </div>
          </div>
        );
      })}
    </div>
  );
}
