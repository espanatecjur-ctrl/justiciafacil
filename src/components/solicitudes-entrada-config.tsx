// ============================================================
//  SolicitudesEntradaConfig · Bandeja de altas de personal
// ------------------------------------------------------------
//  Muestra quién se registró al entrar. El validador revisa,
//  le asigna un rol y aprueba (o rechaza). Al aprobar, la persona
//  queda en `colaboradores` con su rol y ya puede entrar.
// ============================================================
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/lib/roles";
import { usuarioActualEtiqueta } from "@/lib/auth";
import {
  listarSolicitudesEntrada, aprobarEntrada, resolverSolicitudEntrada,
  type SolicitudEntrada,
} from "@/lib/solicitud-entrada";
import { Loader2, Check, X, Phone, IdCard, UserCheck } from "lucide-react";

export function SolicitudesEntradaConfig() {
  const [filtro, setFiltro] = useState<"pendiente" | "aprobado" | "rechazado">("pendiente");
  const [lista, setLista] = useState<SolicitudEntrada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = () => {
    setCargando(true);
    listarSolicitudesEntrada(filtro).then(setLista).finally(() => setCargando(false));
  };
  useEffect(recargar, [filtro]); // eslint-disable-line

  const aprobar = async (s: SolicitudEntrada) => {
    const rol = roles[s.id!];
    if (!rol) { setError("Primero escoge un rol para esa persona."); return; }
    setError(null);
    setOcupado(s.id!);
    const quien = await usuarioActualEtiqueta();
    const r = await aprobarEntrada(s, rol, quien);
    setOcupado(null);
    if (r.ok) recargar();
    else setError("No se pudo aprobar: " + (r.error || ""));
  };

  const rechazar = async (s: SolicitudEntrada) => {
    const nota = window.prompt("Motivo del rechazo (opcional):") ?? undefined;
    setOcupado(s.id!);
    const quien = await usuarioActualEtiqueta();
    const ok = await resolverSolicitudEntrada(s.id!, "rechazado", { revisado_por: quien, nota });
    setOcupado(null);
    if (ok) recargar();
    else setError("No se pudo rechazar.");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Personas que se registraron al entrar. Asígnale un rol y aprueba para darle acceso.
      </p>

      <div className="inline-flex rounded-md border border-border overflow-hidden text-sm">
        {(["pendiente", "aprobado", "rechazado"] as const).map((f) => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 capitalize ${filtro === f ? "bg-[#0B1E3A] text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}>
            {f === "pendiente" ? "Pendientes" : f === "aprobado" ? "Aprobadas" : "Rechazadas"}
          </button>
        ))}
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}

      {cargando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay solicitudes {filtro === "pendiente" ? "pendientes" : filtro + "s"}.</p>
      ) : (
        <div className="grid gap-3">
          {lista.map((s) => (
            <Card key={s.id} className="legal-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[220px]">
                  <p className="font-display font-bold">{s.nombre || "(sin nombre)"} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{s.tipo}</span></p>
                  <p className="text-xs text-muted-foreground">{s.correo}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-foreground/80">
                    <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {s.telefono || "—"}</span>
                    <span className="inline-flex items-center gap-1"><IdCard className="h-3 w-3" /> Céd. {s.cedula_profesional || "—"}</span>
                  </div>
                </div>

                {filtro === "pendiente" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={roles[s.id!] || ""}
                      onChange={(e) => setRoles((r) => ({ ...r, [s.id!]: e.target.value }))}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">— Asignar rol —</option>
                      {ROLES.map((r) => <option key={r.codigo} value={r.codigo}>{r.codigo} · {r.nombre}</option>)}
                    </select>
                    <Button size="sm" disabled={ocupado === s.id} onClick={() => aprobar(s)}
                      className="bg-[color:var(--teal)] hover:bg-[color:var(--teal)]/90 text-white">
                      {ocupado === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1.5" /> Aprobar</>}
                    </Button>
                    <Button size="sm" variant="outline" disabled={ocupado === s.id} onClick={() => rechazar(s)}
                      className="text-red-600"><X className="h-4 w-4 mr-1.5" /> Rechazar</Button>
                  </div>
                ) : (
                  <div className="text-right text-xs text-muted-foreground">
                    {s.estado === "aprobado" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800"><UserCheck className="h-3 w-3" /> Rol: {s.rol_asignado}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">Rechazada</span>
                    )}
                    {s.revisado_por && <p className="mt-1">por {s.revisado_por}</p>}
                    {s.nota && <p className="mt-0.5 italic">“{s.nota}”</p>}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
