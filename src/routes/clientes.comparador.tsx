import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { todosClientesJC, type ClienteJC } from "@/lib/juris-clientes";
import { Loader2, Search, CheckCircle2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/clientes/comparador")({
  head: () => ({ meta: [{ title: "Comparador de clientes — JusticiaFácil" }] }),
  component: ComparadorClientes,
});

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// Mismo normalizador que ya se usa en BannerCoincidencias, para que
// "José García" y "JOSE  GARCIA" cuenten como el mismo nombre.
const norm = (s: any) =>
  (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

interface CliJF {
  nombre: string | null;
  estado: string | null;
  caso_juridico?: { unidad: string | null; entidad: string | null; archivado?: boolean | null } | null;
}

type Fila = {
  clave: string;
  nombreJF: string | null;
  nombreJC: string | null;
  estadoJF: string | null;
  estadoJC: string | null;
  areaJF: string | null;
  codigoJC: string | null;
};

const ESTADOS_CONCLUIDOS_JC = new Set(["entregado", "cancelado"]);

function ComparadorClientes() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientesJF, setClientesJF] = useState<CliJF[]>([]);
  const [clientesJC, setClientesJC] = useState<ClienteJC[]>([]);
  const [q, setQ] = useState("");
  const [pestana, setPestana] = useState<"coinciden" | "soloJF" | "soloJC" | "concluidosJC">("coinciden");

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const [rJF, listaJC] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/cliente_juicio?select=nombre,estado,caso_juridico(unidad,entidad,archivado)&en_papelera=eq.false`, { headers }),
          todosClientesJC(),
        ]);
        const dJF = rJF.ok ? await rJF.json() : [];
        if (!vivo) return;
        setClientesJF(dJF);
        setClientesJC(listaJC);
      } catch {
        if (vivo) setError("No se pudo cargar la comparación. Intenta de nuevo.");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  // Un renglón por nombre normalizado en CADA lado (agrupa por si un
  // mismo cliente aparece varias veces con distintas garantías).
  const { coinciden, soloJF, soloJC } = useMemo(() => {
    const mapaJF = new Map<string, CliJF>();
    for (const c of clientesJF) {
      const k = norm(c.nombre);
      if (k.length < 3) continue;
      if (!mapaJF.has(k)) mapaJF.set(k, c);
    }
    const mapaJC = new Map<string, ClienteJC>();
    for (const c of clientesJC) {
      const k = norm(c.nombre);
      if (k.length < 3) continue;
      if (!mapaJC.has(k)) mapaJC.set(k, c);
    }

    const coinciden: Fila[] = [];
    const soloJF: Fila[] = [];
    const soloJC: Fila[] = [];

    for (const [k, cjf] of mapaJF) {
      const cjc = mapaJC.get(k);
      const fila: Fila = {
        clave: k,
        nombreJF: cjf.nombre,
        nombreJC: cjc?.nombre ?? null,
        estadoJF: cjf.estado || (cjf.caso_juridico?.archivado ? "Archivado" : null),
        estadoJC: cjc?.estatus ?? null,
        areaJF: cjf.caso_juridico?.unidad ?? null,
        codigoJC: cjc?.codigo ?? null,
      };
      if (cjc) coinciden.push(fila);
      else soloJF.push(fila);
    }
    for (const [k, cjc] of mapaJC) {
      if (mapaJF.has(k)) continue;
      soloJC.push({
        clave: k,
        nombreJF: null,
        nombreJC: cjc.nombre,
        estadoJF: null,
        estadoJC: cjc.estatus,
        areaJF: null,
        codigoJC: cjc.codigo,
      });
    }

    const porNombre = (a: Fila, b: Fila) => (a.nombreJF || a.nombreJC || "").localeCompare(b.nombreJF || b.nombreJC || "");
    coinciden.sort(porNombre);
    soloJF.sort(porNombre);
    soloJC.sort(porNombre);
    return { coinciden, soloJF, soloJC };
  }, [clientesJF, clientesJC]);

  const concluidosJC = useMemo(
    () => soloJC.filter((f) => ESTADOS_CONCLUIDOS_JC.has((f.estadoJC || "").toLowerCase())),
    [soloJC]
  );

  const listaActual = pestana === "coinciden" ? coinciden : pestana === "soloJF" ? soloJF : pestana === "soloJC" ? soloJC : concluidosJC;

  const filtrada = useMemo(() => {
    const t = norm(q);
    if (!t) return listaActual;
    return listaActual.filter((f) => norm(f.nombreJF || f.nombreJC || "").includes(t));
  }, [listaActual, q]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Comparador de clientes"
        description="Cruce en vivo entre los clientes de JusticiaFácil y los de JurisConecta, por nombre. Es solo lectura: no cambia nada en ninguno de los dos sistemas."
        actions={
          <Link to="/clientes" className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Volver a Clientes
          </Link>
        }
      />

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {cargando ? (
        <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Comparando clientes de los dos sistemas…
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <button onClick={() => setPestana("coinciden")} className="text-left">
              <Card className={"p-4 " + (pestana === "coinciden" ? "ring-2 ring-emerald-500" : "")}>
                <p className="text-2xl font-bold text-emerald-600">{coinciden.length}</p>
                <p className="text-xs text-muted-foreground">🟢 Coinciden (en los dos)</p>
              </Card>
            </button>
            <button onClick={() => setPestana("soloJF")} className="text-left">
              <Card className={"p-4 " + (pestana === "soloJF" ? "ring-2 ring-[#2E6DA8]" : "")}>
                <p className="text-2xl font-bold text-[color:#2E6DA8]">{soloJF.length}</p>
                <p className="text-xs text-muted-foreground">Solo en JusticiaFácil</p>
              </Card>
            </button>
            <button onClick={() => setPestana("soloJC")} className="text-left">
              <Card className={"p-4 " + (pestana === "soloJC" ? "ring-2 ring-amber-500" : "")}>
                <p className="text-2xl font-bold text-amber-600">{soloJC.length}</p>
                <p className="text-xs text-muted-foreground">Solo en JurisConecta</p>
              </Card>
            </button>
            <button onClick={() => setPestana("concluidosJC")} className="text-left">
              <Card className={"p-4 " + (pestana === "concluidosJC" ? "ring-2 ring-rose-500" : "")}>
                <p className="text-2xl font-bold text-rose-600">{concluidosJC.length}</p>
                <p className="text-xs text-muted-foreground">Ya culminados en JC (entregado/cancelado) y no están aquí</p>
              </Card>
            </button>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre…" className="pl-8" />
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left font-medium">Cliente</th>
                  <th className="p-2 text-left font-medium">En JusticiaFácil</th>
                  <th className="p-2 text-left font-medium">En JurisConecta</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((f) => (
                  <tr key={f.clave} className="border-t">
                    <td className="p-2 font-medium">{f.nombreJF || f.nombreJC}</td>
                    <td className="p-2">
                      {f.nombreJF ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {f.areaJF || "—"} {f.estadoJF ? `· ${f.estadoJF}` : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">— no está</span>
                      )}
                    </td>
                    <td className="p-2">
                      {f.nombreJC ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {f.codigoJC || "—"} {f.estadoJC ? `· ${f.estadoJC}` : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">— no está</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtrada.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-muted-foreground">Sin resultados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
