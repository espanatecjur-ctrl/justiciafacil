// ============================================================
//  Solicitudes pendientes de URRJ (gate de entrada al dictamen)
// ------------------------------------------------------------
//  El abogado NO dictamina en el aire: parte de una solicitud que
//  la Dirección ya envió (documentos + "están completos"). Cada
//  solicitud dice a qué dictamen va: Jurídico o Registral.
//
//  Administradora: en toda la tarjeta se ve el CÓDIGO. El nombre
//  real solo se resuelve y se pinta si el rol es DGE/Super_Admin.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { Inbox, Paperclip, FileText, ArrowRight, RefreshCw, Search } from "lucide-react";
import { listarSolicitudesPredictamen, type SolicitudPredictamen } from "@/lib/solicitud-predictamen";
import { listarAdministradoras, puedeVerNombreReal, type Administradora } from "@/lib/administradoras";
import { getAuth } from "@/lib/auth";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

const headersDb = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export function SolicitudesURRJ({ onDictaminar }: { onDictaminar: (sol: SolicitudPredictamen) => void }) {
  const [lista, setLista] = useState<SolicitudPredictamen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [verTodas, setVerTodas] = useState(false);
  const [q, setQ] = useState("");
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [administradoras, setAdministradoras] = useState<Administradora[]>([]);
  const verNombreReal = puedeVerNombreReal(rolUsuario);

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
      } catch { /* si falla, se queda sin rol y no ve nombres reales */ }
    })();
  }, []);

  useEffect(() => { if (verNombreReal) listarAdministradoras().then(setAdministradoras); }, [verNombreReal]);
  const nombreDe = (codigo?: string | null) => administradoras.find((a) => a.codigo === codigo)?.nombre;

  const cargar = () => {
    setCargando(true);
    listarSolicitudesPredictamen("pendiente")
      .then((l) => setLista(l.filter((s) => s.area === "URRJ")))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  // Buscador inteligente: filtra por expediente, cliente, juzgado, nota,
  // código de administradora y — solo si eres DGE — también por el nombre real.
  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return lista;
    return lista.filter((s) => {
      const campos = [s.expediente, s.cliente, s.juzgado, s.nota, s.tipo_dictamen, s.administradora_codigo];
      if (verNombreReal) campos.push(nombreDe(s.administradora_codigo));
      return campos.filter(Boolean).join(" ").toLowerCase().includes(t);
    });
  }, [lista, q, verNombreReal, administradoras]);

  const visibles = verTodas ? filtradas : filtradas.slice(0, 3);

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center gap-2">
        <Inbox className="h-5 w-5 text-[color:var(--teal)]" />
        <h3 className="font-display text-base font-semibold">Solicitudes de URRJ para dictaminar</h3>
        <button onClick={cargar} className="ml-auto inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted">
          <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Estas son las garantías que la Dirección ya envió con sus documentos. Elige una para dictaminar.</p>

      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={verNombreReal ? "Busca por expediente, cliente, código o administradora…" : "Busca por expediente, cliente, código de administradora…"}
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
        />
      </div>

      {cargando ? (
        <p className="mt-4 text-sm text-muted-foreground">Cargando…</p>
      ) : lista.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 p-5 text-center text-sm text-muted-foreground">
          No hay solicitudes pendientes para URRJ. La Dirección debe enviar los documentos desde “Documentos → pre-dictamen”.
        </div>
      ) : filtradas.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/20 p-5 text-center text-sm text-muted-foreground">Sin resultados para “{q}”.</div>
      ) : (
        <div className="mt-3 divide-y divide-border">
          {visibles.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Exp. {s.expediente || "—"}{s.cliente ? <span className="font-normal text-muted-foreground"> · {s.cliente}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  <Paperclip className="mr-1 inline h-3 w-3" />{s.documentos?.length || 0} documento(s){s.juzgado ? ` · ${s.juzgado}` : ""}
                </p>
                {s.nota && <p className="mt-0.5 text-xs italic text-muted-foreground">“{s.nota}”</p>}
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.tipo_dictamen === "Registral" ? "bg-amber-100 text-amber-800" : "bg-[color:var(--teal)]/10 text-[color:var(--teal)]"}`}>
                    Dictamen {s.tipo_dictamen || "Jurídico"}
                  </span>
                  {s.administradora_codigo && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-700" title={verNombreReal ? (nombreDe(s.administradora_codigo) || "") : "Solo DGE ve el nombre real"}>
                      {s.administradora_codigo}
                      {verNombreReal && nombreDe(s.administradora_codigo) && <span className="font-sans font-normal text-slate-500">· {nombreDe(s.administradora_codigo)}</span>}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onDictaminar(s)}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white"
                style={{ background: "#0C5C46" }}
              >
                <FileText className="h-4 w-4" /> Dictaminar <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
          {filtradas.length > 3 && (
            <button onClick={() => setVerTodas((v) => !v)} className="w-full py-2 text-center text-xs font-medium text-[color:var(--teal)] hover:underline">
              {verTodas ? "Ver menos" : `Ver todas (${filtradas.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
