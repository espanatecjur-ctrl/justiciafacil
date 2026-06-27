import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { FirmaParte, type DatosFirma } from "@/components/firma-parte";
import { HITOS_UCP } from "@/lib/ucp-dictamen";
import { descargarDictamenFinalPDF, type FirmaConTitulo } from "@/lib/dictamen-final-pdf";
import { type DictamenRow, type PredFuente } from "@/components/ficha-ucp";
import { cargarPermisosUCP, puedeFirmar, puedePasarEtapaB } from "@/lib/ucp-permisos";
import {
  Save, Loader2, FileDown, ArrowRightCircle, CheckCircle2, AlertTriangle, Calculator, Stamp,
} from "lucide-react";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// los 6 espacios de firma del dictamen final (en el orden que pidió DGE)
type SlotFirma = "elabora" | "dil" | "ucm" | "dge" | "dgc" | "gad";
const SLOTS: { clave: SlotFirma; titulo: string; cargo: string }[] = [
  { clave: "elabora", titulo: "Elabora · UCP",          cargo: "UCP — Consolidación Patrimonial" },
  { clave: "dil",     titulo: "Jurídico · DIL",         cargo: "Director de Integridad Legal" },
  { clave: "ucm",     titulo: "Seguimiento · UCM",      cargo: "Encargado UCM" },
  { clave: "dge",     titulo: "Dirección General · DGE",cargo: "Administradora Única / DGE" },
  { clave: "dgc",     titulo: "Comercial · DGC",        cargo: "Director Comercial" },
  { clave: "gad",     titulo: "Administración · GAD",   cargo: "Gerencia Administrativa" },
];

type Firmas = Partial<Record<SlotFirma, DatosFirma | null>>;

interface Contable { gastos: string; cobros: string; valorActual: string; nota: string; validada: boolean; }
const CONT_VACIO = (): Contable => ({ gastos: "", cobros: "", valorActual: "", nota: "", validada: false });

const VER_CLS: Record<string, string> = {
  POSITIVO: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CONDICIONADO: "bg-amber-50 text-amber-800 border-amber-200",
  NEGATIVO: "bg-red-50 text-red-800 border-red-200",
  PENDIENTE: "bg-muted text-muted-foreground border-border",
};

function combinar(vj?: string, vr?: string): string {
  const v = [vj, vr];
  if (v.includes("NEGATIVO")) return "NEGATIVO";
  if (v.some((x) => !x || x === "PENDIENTE" || x === "FALTAN DATOS")) return "PENDIENTE";
  if (v.includes("CONDICIONADO")) return "CONDICIONADO";
  return "POSITIVO";
}
const num = (s: string) => { const x = parseFloat(String(s).replace(/[^0-9.\-]/g, "")); return isNaN(x) ? 0 : x; };

interface Props {
  caso: CasoJuridico;
  dictamen: DictamenRow;
  pred?: PredFuente;
  onGuardado: () => void;
}

export function SeccionFinal({ caso, dictamen, pred, onGuardado }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [pasando, setPasando] = useState(false);
  const [rol, setRol] = useState<string | null>(null);

  useEffect(() => { cargarPermisosUCP().then((p) => setRol(p.rol)).catch(() => {}); }, []);

  const [cont, setCont] = useState<Contable>(() => {
    const c = (dictamen.contable as any) || {};
    return { ...CONT_VACIO(), gastos: String(c.gastos ?? ""), cobros: String(c.cobros ?? ""), valorActual: String(c.valorActual ?? ""), nota: c.nota ?? "", validada: !!c.validada };
  });
  const setC = (k: keyof Contable, v: any) => setCont((p) => ({ ...p, [k]: v }));

  const [firmas, setFirmas] = useState<Firmas>(() => (dictamen.firmas as Firmas) || {});

  const vJur = dictamen.juridico?.veredicto || "PENDIENTE";
  const vReg = (dictamen.registral as any)?.veredicto || "PENDIENTE";
  const vFinal = useMemo(() => combinar(vJur, vReg), [vJur, vReg]);

  const antecedente = (pred?.resultados as any)?.firmas || {};
  const firmasCompletas = SLOTS.every((s) => !!firmas[s.clave]?.fecha);
  const puedeEtapaB = firmasCompletas && vFinal === "POSITIVO" && cont.validada && puedePasarEtapaB(rol);
  const yaEtapaB = dictamen.estado === "etapa_b";

  // ---- guardar relación contable ----
  const guardarContable = async () => {
    setGuardando(true); setError(null);
    try {
      const payload = { gastos: num(cont.gastos), cobros: num(cont.cobros), valorActual: num(cont.valorActual), nota: cont.nota || null, validada: cont.validada };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${dictamen.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ contable: payload, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      onGuardado();
    } catch (e: any) { setError("No se pudo guardar la relación contable: " + e.message); }
    finally { setGuardando(false); }
  };

  // ---- firmar (persiste de inmediato; cada quien firma desde su sesión) ----
  const firmar = async (clave: SlotFirma, f: DatosFirma) => {
    const nuevo = { ...firmas, [clave]: f.fecha ? f : null };
    setFirmas(nuevo);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${dictamen.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ firmas: nuevo, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      onGuardado();
    } catch (e: any) { setError("No se pudo guardar la firma: " + e.message); }
  };

  // ---- pasar a Etapa B (UCM) ----
  const pasarEtapaB = async () => {
    setPasando(true); setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/dictamen?id=eq.${dictamen.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ estado: "etapa_b", veredicto: vFinal, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);

      // sincroniza el área en la fuente: el caso pasa a UCM
      const rc = await fetch(`${SUPABASE_URL}/rest/v1/caso_juridico?id=eq.${caso.id}`, {
        method: "PATCH", headers, body: JSON.stringify({ unidad: "UCM" }),
      }).catch(() => null);
      if (rc && !rc.ok) {
        setError("El dictamen pasó a Etapa B, pero no pude actualizar el área del caso a UCM (revisa el permiso de update en caso_juridico).");
      }

      onGuardado();
    } catch (e: any) { setError("No se pudo pasar a Etapa B: " + e.message); }
    finally { setPasando(false); }
  };

  // ---- PDF ----
  const descargarPDF = async () => {
    const hitos = HITOS_UCP.map((h) => {
      const e = dictamen.juridico?.hitos?.[h.clave];
      return { num: h.num, label: h.label, semaforo: e?.semaforo, etiqueta: e?.etiqueta, nota: e?.nota };
    });
    const firmasPDF: FirmaConTitulo[] = SLOTS.map((s) => ({ titulo: s.titulo, firma: firmas[s.clave] || null }));
    try {
      await descargarDictamenFinalPDF({
        expediente: caso.expediente || "", juzgado: caso.juzgado || "", garantia: caso.direccion_garantia || "",
        cliente: caso.cliente_nombre || caso.cliente_codigo || "", entidad: caso.entidad || "",
        veredictoJuridico: vJur, veredictoRegistral: vReg, veredictoFinal: vFinal,
        hitos,
        contable: { gastos: num(cont.gastos), cobros: num(cont.cobros), valorActual: num(cont.valorActual), nota: cont.nota, validada: cont.validada },
        antecedente: { elabora: antecedente.elabora || null, valida: antecedente.valida || null },
        firmas: firmasPDF,
      });
    } catch (e: any) { setError("No se pudo generar el PDF: " + e.message); }
  };

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* veredictos */}
      <Card className="legal-card">
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Stamp className="h-4 w-4 text-[color:var(--teal)]" />
          <p className="text-sm font-semibold">Veredicto del dictamen</p>
          <div className="ml-auto flex flex-wrap gap-2">
            <Badge variant="outline" className={`border ${VER_CLS[vJur] || VER_CLS.PENDIENTE}`}>Jurídico: {vJur}</Badge>
            <Badge variant="outline" className={`border ${VER_CLS[vReg] || VER_CLS.PENDIENTE}`}>Registral: {vReg}</Badge>
            <Badge variant="outline" className={`border text-sm font-semibold ${VER_CLS[vFinal] || VER_CLS.PENDIENTE}`}>FINAL: {vFinal}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* relación contable */}
      <Card className="legal-card">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-[color:var(--teal)]" />
            <p className="text-sm font-semibold">Relación contable (GAD)</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Campo label="Gastos"><Input inputMode="numeric" value={cont.gastos} onChange={(e) => setC("gastos", e.target.value)} /></Campo>
            <Campo label="Cobros"><Input inputMode="numeric" value={cont.cobros} onChange={(e) => setC("cobros", e.target.value)} /></Campo>
            <Campo label="Valor actual de la garantía"><Input inputMode="numeric" value={cont.valorActual} onChange={(e) => setC("valorActual", e.target.value)} /></Campo>
          </div>
          <Textarea className="min-h-[40px] text-sm" placeholder="Nota de la relación contable…" value={cont.nota} onChange={(e) => setC("nota", e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cont.validada} onChange={() => setC("validada", !cont.validada)} />
            Relación contable validada por GAD <span className="text-xs text-muted-foreground">(Regla 3: sin esto no hay cobro)</span>
          </label>
          <Button size="sm" onClick={guardarContable} disabled={guardando}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar relación contable
          </Button>
        </CardContent>
      </Card>

      {/* antecedente: firmas del pre-dictamen */}
      <Card className="legal-card">
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-semibold">Antecedente · firmas del pre-dictamen URRJ</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[{ k: "elabora", t: "Elabora" }, { k: "valida", t: "Valida" }].map(({ k, t }) => {
              const f = antecedente[k] as DatosFirma | undefined;
              return (
                <div key={k} className="rounded-md border border-dashed border-border bg-muted/30 p-2 text-xs">
                  <span className="font-medium">{t}: </span>
                  {f?.nombre
                    ? <span>{f.nombre}{f.cargo ? ` · ${f.cargo}` : ""}{f.fecha ? ` · ${new Date(f.fecha).toLocaleDateString("es-MX")}` : ""}</span>
                    : <span className="text-muted-foreground">sin firma registrada en el pre-dictamen</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 6 firmas nuevas */}
      <Card className="legal-card">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">Firmas del dictamen final</p>
            <span className="text-xs text-muted-foreground">{SLOTS.filter((s) => firmas[s.clave]?.fecha).length}/6 firmadas</span>
            {firmasCompletas && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SLOTS.map((s) => (
              <FirmaParte
                key={s.clave}
                titulo={s.titulo}
                cargoSugerido={s.cargo}
                valor={firmas[s.clave] || null}
                onFirmar={(f) => firmar(s.clave, f)}
                bloqueado={!puedeFirmar(s.clave, rol)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* cierre: PDF + Etapa B */}
      <Card className="legal-card">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={descargarPDF}>
              <FileDown className="h-4 w-4" /> Descargar dictamen final (PDF)
            </Button>
            {yaEtapaB ? (
              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">Ya pasó a UCM (Etapa B)</Badge>
            ) : (
              <Button size="sm" onClick={pasarEtapaB} disabled={!puedeEtapaB || pasando}>
                {pasando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightCircle className="h-4 w-4" />} Pasar a Etapa B (UCM)
              </Button>
            )}
          </div>
          {!yaEtapaB && !puedeEtapaB && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Para pasar a Etapa B (Regla 4): veredicto final POSITIVO ({vFinal === "POSITIVO" ? "✓" : "falta"}),
                las 6 firmas ({firmasCompletas ? "✓" : "faltan"}), la relación contable validada ({cont.validada ? "✓" : "falta"}) y tu rol con permiso ({puedePasarEtapaB(rol) ? "✓" : "no"}).
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
