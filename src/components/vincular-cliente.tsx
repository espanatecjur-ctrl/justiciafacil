import { useState } from "react";
import { X, Search, Loader2, UserCheck, AlertTriangle, ShieldAlert, Link2, Phone, Mail, IdCard } from "lucide-react";
import { type CasoJuridico, SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { buscarClientesJC, verificarDobleVentaJC, type ClienteJC } from "@/lib/juris-clientes";

const NAVY = "#0B1E3A";
const TEAL = "#0C5C46";

// Modal para vincular un CLIENTE (de JurisConecta) a la GARANTÍA de este expediente.
// Antes de vincular, verifica DOBLE VENTA: que la garantía no tenga otro cliente y
// que el cliente no tenga otra garantía. Si hay coincidencia, avisa y pide autorización.
export function VincularClienteModal({ caso, onClose, onVinculado }: {
  caso: CasoJuridico; onClose: () => void; onVinculado: (c: ClienteJC) => void;
}) {
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ClienteJC[]>([]);
  const [busco, setBusco] = useState(false);

  // cliente elegido + chequeo de doble venta
  const [elegido, setElegido] = useState<ClienteJC | null>(null);
  const [chequeando, setChequeando] = useState(false);
  const [alerta, setAlerta] = useState<{ garantia: ClienteJC[]; cliente: ClienteJC[] } | null>(null);
  const [autorizado, setAutorizado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buscar = async () => {
    if (texto.trim().length < 2) { setError("Escribe al menos 2 letras para buscar."); return; }
    setBuscando(true); setError(null); setBusco(true);
    try {
      const r = await buscarClientesJC(texto);
      setResultados(r);
    } catch { setError("No se pudo buscar en JurisConecta."); }
    setBuscando(false);
  };

  // al elegir un cliente, verifica doble venta
  const elegir = async (c: ClienteJC) => {
    setElegido(c); setChequeando(true); setAlerta(null); setAutorizado(false); setError(null);
    try {
      const chk = await verificarDobleVentaJC(caso.gar_id, c.id);
      // garantía ocupada por OTRO cliente distinto al elegido
      const garOcupada = chk.garantiaOcupada.filter((x) => x.id !== c.id);
      // el cliente ya tiene una garantía distinta a esta
      const cliOtra = chk.clienteConGarantia.filter((x) => (x.gar_id && x.gar_id !== caso.gar_id) || (!x.gar_id && x.garantia));
      if (garOcupada.length > 0 || cliOtra.length > 0) {
        setAlerta({ garantia: garOcupada, cliente: cliOtra });
      }
    } catch { /* si falla el chequeo, no bloquea */ }
    setChequeando(false);
  };

  // guarda el vínculo en el caso (cliente_nombre + cliente_id + código)
  const vincular = async () => {
    if (!elegido) return;
    if (alerta && !autorizado) { setError("Debes autorizar el 2º procedimiento para continuar."); return; }
    setGuardando(true); setError(null);
    try {
      const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
      const body: any = {
        cliente_nombre: elegido.nombre,
        cliente_codigo: elegido.codigo,
        cliente_jc_id: elegido.id,         // guarda el id de JurisConecta (columna real, bigint)
      };
      const r = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${caso.id}`, { method: "PATCH", headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error();
      onVinculado(elegido);
    } catch {
      setError("No se pudo guardar el vínculo. (Revisa que el caso tenga la columna cliente_jc_id.)");
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 text-white" style={{ background: NAVY }}>
          <p className="flex items-center gap-2 font-semibold"><Link2 className="h-4 w-4" /> Vincular cliente a la garantía</p>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          <p className="text-xs text-muted-foreground">Garantía: <b>{caso.gar_id || caso.expediente || "—"}</b>. Busca al cliente en JurisConecta por nombre, CURP/RFC, correo, teléfono o folio.</p>

          {/* buscador */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && buscar()}
                placeholder="Nombre, CURP, RFC, correo, teléfono…" className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm" />
            </div>
            <button onClick={buscar} disabled={buscando} className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
              {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </button>
          </div>

          {/* resultados */}
          {busco && !buscando && resultados.length === 0 && (
            <p className="rounded-md bg-muted/40 p-3 text-center text-xs text-muted-foreground">No se encontraron clientes con ese dato en JurisConecta.</p>
          )}
          {resultados.length > 0 && !elegido && (
            <div className="space-y-1.5">
              {resultados.map((c) => (
                <button key={c.id} onClick={() => elegir(c)} className="flex w-full items-start justify-between gap-2 rounded-md border border-input p-2.5 text-left text-sm hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.nombre || "Sin nombre"}</p>
                    <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      {c.folio && <span className="inline-flex items-center gap-1"><IdCard className="h-3 w-3" />{c.folio}</span>}
                      {c.curp_rfc && <span>{c.curp_rfc}</span>}
                      {c.telefono && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefono}</span>}
                      {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                    </p>
                  </div>
                  {c.codigo && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{c.codigo}</span>}
                </button>
              ))}
            </div>
          )}

          {/* cliente elegido + chequeo */}
          {elegido && (
            <div className="space-y-3">
              <div className="rounded-md border border-[color:var(--teal)]/30 bg-[color:var(--teal)]/5 p-3">
                <p className="flex items-center gap-2 text-sm font-medium"><UserCheck className="h-4 w-4 text-[color:var(--teal)]" /> {elegido.nombre}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                  {elegido.folio && <span>Folio: {elegido.folio}</span>}
                  {elegido.curp_rfc && <span>{elegido.curp_rfc}</span>}
                  {elegido.codigo && <span>Código: {elegido.codigo}</span>}
                  {elegido.area && <span>Área: {elegido.area}</span>}
                </p>
                <button onClick={() => { setElegido(null); setAlerta(null); setAutorizado(false); }} className="mt-1.5 text-[11px] text-muted-foreground hover:underline">← Elegir otro</button>
              </div>

              {chequeando && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verificando que no haya doble venta…</p>}

              {/* alerta de doble venta */}
              {alerta && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
                  <p className="flex items-center gap-1.5 font-semibold"><ShieldAlert className="h-4 w-4" /> Posible doble venta</p>
                  {alerta.garantia.length > 0 && (
                    <p className="mt-1">⚠️ Esta garantía <b>ya está vinculada</b> a: {alerta.garantia.map((x) => x.nombre).join(", ")}.</p>
                  )}
                  {alerta.cliente.length > 0 && (
                    <p className="mt-1">⚠️ Este cliente <b>ya tiene otra garantía</b>: {alerta.cliente.map((x) => x.garantia || x.gar_id).join(", ")}.</p>
                  )}
                  <label className="mt-2 flex items-start gap-2 rounded-md bg-white/60 p-2">
                    <input type="checkbox" checked={autorizado} onChange={(e) => setAutorizado(e.target.checked)} className="mt-0.5" />
                    <span>Autorizo abrir un <b>2º procedimiento</b> para este cliente/garantía. Entiendo que es una excepción y quedará registrada.</span>
                  </label>
                </div>
              )}

              {!alerta && !chequeando && (
                <p className="flex items-center gap-1.5 rounded-md bg-[color:var(--teal)]/5 p-2 text-[11px] text-[color:var(--teal)]"><UserCheck className="h-3.5 w-3.5" /> Sin conflictos. Puedes vincular con seguridad.</p>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* pie */}
        {elegido && (
          <div className="flex justify-end gap-2 border-t border-border p-3">
            <button onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
            <button onClick={vincular} disabled={guardando || chequeando || (!!alerta && !autorizado)} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: alerta ? "#A32D2D" : TEAL }}>
              {guardando ? <><Loader2 className="h-4 w-4 animate-spin" /> Vinculando…</> : <><Link2 className="h-4 w-4" /> {alerta ? "Vincular (2º proc.)" : "Vincular cliente"}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
