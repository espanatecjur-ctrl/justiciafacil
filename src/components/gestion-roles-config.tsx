import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  UserCog, Plus, Save, Check, Loader2, Lock, Trash2, X, ShieldPlus,
} from "lucide-react";
import {
  cargarConfig, rolesCombinados, accionesCombinadas, gruposDisponibles,
  MODULOS_ACCION, agregarRol, eliminarRol, agregarAccion, eliminarAccion,
  guardarModulosDeRol, guardarAccionesDeRol, sugerirCodigo,
  type ConfigPermisos, type RolCombinado,
} from "@/lib/roles-dinamicos";
import { ROLES, MODULOS, TODOS_MODULOS, type ModuloClave } from "@/lib/roles";
import { MATRIZ_DEFAULT, limpiarCachePermisosAcciones, type ModuloPerm } from "@/lib/permisos-acciones";
import { limpiarCacheModulos } from "@/lib/permisos-modulos";

const GOLD = "#C2A24C";

function defaultModulos(codigo: string): ModuloClave[] {
  const r = ROLES.find((x) => x.codigo === codigo);
  if (!r) return [];
  return r.modulos === "todos" ? [...TODOS_MODULOS] : [...r.modulos];
}

export function GestionRolesConfig() {
  const [cfg, setCfg] = useState<ConfigPermisos>({});
  const [cargando, setCargando] = useState(true);
  const [rolSel, setRolSel] = useState<string>("");
  const [mods, setMods] = useState<Set<ModuloClave>>(new Set());
  const [accs, setAccs] = useState<Record<string, Set<string>>>({});
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [nuevoRol, setNuevoRol] = useState(false);

  const roles = useMemo(() => rolesCombinados(cfg), [cfg]);
  const rolActual = roles.find((r) => r.codigo === rolSel) || null;

  useEffect(() => {
    cargarConfig().then((c) => {
      setCfg(c);
      const primero = rolesCombinados(c).find((r) => !r.veTodo);
      if (primero) seleccionar(primero.codigo, c);
    }).finally(() => setCargando(false));
  }, []);

  // Deriva los toggles del rol a partir del config guardado.
  function seleccionar(codigo: string, config: ConfigPermisos = cfg) {
    setRolSel(codigo);
    setMsg(null);
    const m = config.modulos?.[codigo] ?? defaultModulos(codigo);
    setMods(new Set(m));
    const a: Record<string, Set<string>> = {};
    for (const { clave } of MODULOS_ACCION) {
      const saved = config.acciones?.[clave]?.[codigo];
      const base = Array.isArray(saved) ? saved : (MATRIZ_DEFAULT[clave][codigo] ?? []);
      a[clave] = new Set(base);
    }
    setAccs(a);
  }

  const toggleMod = (m: ModuloClave) => {
    setMsg(null);
    setMods((prev) => {
      const s = new Set(prev);
      s.has(m) ? s.delete(m) : s.add(m);
      return s;
    });
  };
  const toggleAcc = (modulo: string, clave: string) => {
    setMsg(null);
    setAccs((prev) => {
      const s = new Set(prev[modulo] ?? []);
      s.has(clave) ? s.delete(clave) : s.add(clave);
      return { ...prev, [modulo]: s };
    });
  };

  async function guardar() {
    if (!rolSel) return;
    setGuardando(true); setMsg(null);
    try {
      let r = await guardarModulosDeRol(rolSel, TODOS_MODULOS.filter((m) => mods.has(m)));
      if (!r.ok) throw new Error(r.error);
      for (const { clave } of MODULOS_ACCION) {
        r = await guardarAccionesDeRol(clave, rolSel, [...(accs[clave] ?? [])]);
        if (!r.ok) throw new Error(r.error);
      }
      limpiarCachePermisosAcciones();
      limpiarCacheModulos();
      setMsg("Permisos guardados ✓");
      setCfg(await cargarConfig());
    } catch (e) {
      setMsg("No se pudo guardar: " + String((e as Error)?.message || e));
    } finally {
      setGuardando(false);
    }
  }

  async function borrarRol(codigo: string) {
    if (!window.confirm(`¿Eliminar el rol ${codigo}? Se quitan sus permisos.`)) return;
    const r = await eliminarRol(codigo);
    if (r.ok) {
      const c = await cargarConfig();
      setCfg(c);
      const otro = rolesCombinados(c).find((x) => !x.veTodo);
      if (otro) seleccionar(otro.codigo, c); else setRolSel("");
    } else setMsg("No se pudo borrar: " + (r.error || ""));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-[color:var(--teal)]" />
          <div>
            <p className="font-display text-base font-semibold">Gestión por rol</p>
            <p className="text-xs text-muted-foreground">Escoge un rol y edita sus módulos y acciones en un solo lugar.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setNuevoRol(true)}><ShieldPlus className="h-4 w-4 mr-1.5" /> Agregar rol</Button>
          <Button size="sm" disabled={guardando || !rolSel || !!rolActual?.veTodo} onClick={guardar} className="text-[#0B1E3A]" style={{ background: GOLD }}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : msg?.startsWith("Permisos") ? <Check className="h-4 w-4 mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {msg && <p className={`text-xs font-medium ${msg.startsWith("Permisos") ? "text-emerald-700" : "text-red-700"}`}>{msg}</p>}

      {cargando ? (
        <Card className="legal-card p-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></Card>
      ) : (
        <>
          {/* Selector de rol */}
          <Card className="legal-card p-4">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Rol</label>
            <div className="mt-1 flex items-center gap-2">
              <select
                value={rolSel}
                onChange={(e) => seleccionar(e.target.value)}
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              >
                {roles.map((r) => (
                  <option key={r.codigo} value={r.codigo}>
                    {r.nombre} · {r.codigo}{r.custom ? " (nuevo)" : ""}{r.veTodo ? " — ve todo" : ""}
                  </option>
                ))}
              </select>
              {rolActual?.custom && (
                <button onClick={() => borrarRol(rolActual.codigo)} title="Eliminar rol" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </Card>

          {rolActual?.veTodo ? (
            <Card className="legal-card p-6">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" /> Este rol tiene acceso completo (no editable).
              </p>
            </Card>
          ) : rolActual ? (
            <>
              {/* Módulos */}
              <Card className="legal-card p-4">
                <p className="mb-3 font-display text-sm font-semibold">Módulos que ve</p>
                <div className="flex flex-wrap gap-2">
                  {MODULOS.map((m) => {
                    const on = mods.has(m.clave);
                    return (
                      <button key={m.clave} onClick={() => toggleMod(m.clave)} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-[#0C5C46] bg-[#0C5C46]/10 text-[#0C5C46]" : "border-input bg-background text-muted-foreground hover:bg-muted"}`}>
                        {on ? "● " : "○ "}{m.label}
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* Acciones por módulo */}
              {MODULOS_ACCION.map((mod) => (
                <BloqueAcciones
                  key={mod.clave}
                  modulo={mod.clave}
                  label={mod.label}
                  cfg={cfg}
                  seleccionadas={accs[mod.clave] ?? new Set()}
                  onToggle={(clave) => toggleAcc(mod.clave, clave)}
                  onCfgCambio={setCfg}
                />
              ))}
            </>
          ) : null}
        </>
      )}

      {nuevoRol && (
        <ModalNuevoRol
          cfg={cfg}
          onCerrar={() => setNuevoRol(false)}
          onCreado={async (codigo) => {
            setNuevoRol(false);
            const c = await cargarConfig();
            setCfg(c);
            seleccionar(codigo, c);
          }}
        />
      )}
    </div>
  );
}

function BloqueAcciones({
  modulo, label, cfg, seleccionadas, onToggle, onCfgCambio,
}: {
  modulo: ModuloPerm;
  label: string;
  cfg: ConfigPermisos;
  seleccionadas: Set<string>;
  onToggle: (clave: string) => void;
  onCfgCambio: (c: ConfigPermisos) => void;
}) {
  const lista = accionesCombinadas(cfg, modulo);
  const [agregando, setAgregando] = useState(false);
  const [label2, setLabel2] = useState("");
  const [clave, setClave] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const crear = async () => {
    setOcupado(true); setErr(null);
    const r = await agregarAccion(modulo, clave || label2, label2);
    setOcupado(false);
    if (r.ok) { setAgregando(false); setLabel2(""); setClave(""); onCfgCambio(await cargarConfig()); }
    else setErr(r.error || "No se pudo agregar.");
  };

  const borrar = async (cl: string) => {
    if (!window.confirm("¿Eliminar esta acción?")) return;
    const r = await eliminarAccion(modulo, cl);
    if (r.ok) onCfgCambio(await cargarConfig());
  };

  return (
    <Card className="legal-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-sm font-semibold">Acciones · {label}</p>
        <button onClick={() => setAgregando((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--teal)] hover:underline">
          <Plus className="h-3.5 w-3.5" /> Agregar acción
        </button>
      </div>

      {agregando && (
        <div className="mb-3 rounded-md border border-dashed border-input bg-muted/20 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input value={label2} onChange={(e) => setLabel2(e.target.value)} placeholder="Nombre visible (ej. Aprobar convenio)" className="h-8 rounded-md border border-input bg-background px-2 text-xs" />
            <input value={clave} onChange={(e) => setClave(e.target.value)} placeholder="clave (opcional)" className="h-8 w-40 rounded-md border border-input bg-background px-2 text-xs font-mono" />
            <Button size="sm" disabled={ocupado || !label2.trim()} onClick={crear} className="h-8 bg-[color:var(--teal)] text-white hover:bg-[color:var(--teal)]/90">{ocupado ? "…" : "Crear"}</Button>
          </div>
          {err && <p className="mt-1 text-[11px] text-red-700">{err}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {lista.map((a) => {
          const on = seleccionadas.has(a.clave);
          return (
            <span key={a.clave} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-[#0C5C46] bg-[#0C5C46]/10 text-[#0C5C46]" : "border-input bg-background text-muted-foreground"}`}>
              <button onClick={() => onToggle(a.clave)}>{on ? "● " : "○ "}{a.label}</button>
              {a.custom && (
                <button onClick={() => borrar(a.clave)} title="Eliminar acción" className="text-muted-foreground hover:text-red-600"><X className="h-3 w-3" /></button>
              )}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

function ModalNuevoRol({ cfg, onCerrar, onCreado }: { cfg: ConfigPermisos; onCerrar: () => void; onCreado: (codigo: string) => void }) {
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [grupo, setGrupo] = useState("Personalizados");
  const [ocupado, setOcupado] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const grupos = gruposDisponibles(cfg);

  const guardar = async () => {
    if (!nombre.trim()) { setErr("Ponle un nombre al rol."); return; }
    setOcupado(true); setErr(null);
    const cod = codigo.trim() || sugerirCodigo(nombre);
    const r = await agregarRol(cod, nombre, grupo);
    setOcupado(false);
    if (r.ok) onCreado(sugerirCodigo(cod));
    else setErr(r.error || "No se pudo crear.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-base font-bold text-[#0B1E3A]">Nuevo rol</p>
          <button onClick={onCerrar} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Nombre del rol</label>
            <input value={nombre} onChange={(e) => { setNombre(e.target.value); if (!codigo) setCodigo(sugerirCodigo(e.target.value)); }} placeholder="Ej. Gerente de Remates" className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" autoFocus />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Código (corto, único)</label>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej. GER_REMATES" className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 font-mono text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Grupo</label>
            <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              {grupos.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
          {err && <span className="mr-auto text-[11px] font-medium text-red-700">{err}</span>}
          <Button variant="outline" size="sm" onClick={onCerrar}>Cancelar</Button>
          <Button size="sm" disabled={ocupado || !nombre.trim()} onClick={guardar} className="bg-[color:var(--teal)] text-white hover:bg-[color:var(--teal)]/90">{ocupado ? "Creando…" : "Crear rol"}</Button>
        </div>
      </div>
    </div>
  );
}
