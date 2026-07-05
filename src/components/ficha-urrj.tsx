// ============================================================
//  FichaURRJ · ficha 360 de una garantía — AQUÍ SE DICTAMINA
//  Datos · Jurídico · Registral · Avances (reusa los motores)
// ============================================================
import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { LineaVidaAreas } from "@/components/linea-vida-areas";
import { DictaminadorPosicion, type VistaPosicion } from "@/components/dictaminador-posicion";
import { DictamenRegistral } from "@/components/dictamen-registral";
import { cargarPermisosURRJ } from "@/lib/urrj-permisos";
import { getAuth } from "@/lib/auth";
import { type Precarga } from "@/lib/predictamen-guardar";
import { ArrowLeft, Scale, Landmark, FileText, Activity } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface RefGarantia {
  id?: string;
  expediente?: string;
  direccion_garantia?: string;
  juzgado?: string;
  cliente_nombre?: string;
  deudor?: string;
  entidad?: string;
}

type Tab = "datos" | "juridico" | "registral" | "avances";

export function FichaURRJ({ garantia, onVolver }: { garantia: RefGarantia; onVolver: () => void }) {
  const [tab, setTab] = useState<Tab>("datos");
  const [vista, setVista] = useState<VistaPosicion>("elegir");
  const [permisos, setPermisos] = useState<string[]>([]);
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);

  useEffect(() => { cargarPermisosURRJ().then((p) => setPermisos(p.acciones)); }, []);
  useEffect(() => {
    (async () => {
      try {
        const auth = await getAuth();
        const { data } = await auth.auth.getSession();
        const correo = data.session?.user?.email;
        if (!correo) return;
        const r = await fetch(`${SUPABASE_URL}/rest/v1/colaboradores?select=rol&correo=eq.${encodeURIComponent(correo)}`, { headers });
        const j = r.ok ? await r.json() : [];
        setRolUsuario(j?.[0]?.rol ?? null);
      } catch { /* sin rol admin */ }
    })();
  }, []);
  const puede = (a: string) => permisos.length === 0 || permisos.includes(a);
  const puedeAdmin = ["GAD", "Super_Admin", "DGE"].includes(rolUsuario || "");

  const precargaJuridico: Precarga = {
    datos: {
      caso_id: garantia.id || "",
      expediente: garantia.expediente || "",
      juzgado: garantia.juzgado || "",
      deudor: garantia.deudor || garantia.cliente_nombre || "",
      ubicacion: garantia.direccion_garantia || "",
    },
  };

  const casoLV: CasoJuridico = {
    id: garantia.id || "",
    expediente: garantia.expediente || "",
    direccion_garantia: garantia.direccion_garantia,
    juzgado: garantia.juzgado,
    cliente_nombre: garantia.cliente_nombre,
  } as CasoJuridico;

  const TABS: { k: Tab; label: string; icon: any }[] = [
    { k: "datos", label: "Datos", icon: FileText },
    { k: "juridico", label: "Jurídico", icon: Scale },
    { k: "registral", label: "Registral (RPPC)", icon: Landmark },
    { k: "avances", label: "Avances", icon: Activity },
  ];

  const Dato = ({ label, valor }: { label: string; valor?: string }) => (
    <div><p className="text-[11px] font-medium text-muted-foreground">{label}</p><p className="text-sm">{valor || "—"}</p></div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onVolver} className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"><ArrowLeft className="h-4 w-4" /> Volver al registro</button>
        <h2 className="text-lg font-bold">Ficha · {garantia.expediente || garantia.direccion_garantia || "Garantía"}</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => { setTab(t.k); setVista("elegir"); }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${tab === t.k ? "border-[color:var(--teal)] bg-[color:var(--teal)]/10 text-[color:var(--teal)]" : "border-border text-muted-foreground hover:bg-muted"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "datos" && (
        <div className="rounded-xl border border-border p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Dato label="Expediente" valor={garantia.expediente} />
            <Dato label="Juzgado" valor={garantia.juzgado} />
            <Dato label="Garantía / dirección" valor={garantia.direccion_garantia} />
            <Dato label="Entidad" valor={garantia.entidad} />
            <Dato label="Cliente" valor={garantia.cliente_nombre} />
            <Dato label="Deudor" valor={garantia.deudor} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Para dictaminar, entra a la pestaña <b>Jurídico</b> (recorrido con boletín y firmas) o <b>Registral (RPPC)</b>. Los avances se ven en <b>Avances</b>.</p>
        </div>
      )}

      {tab === "juridico" && (
        <DictaminadorPosicion
          casos={[]}
          vista={vista}
          onVista={setVista}
          precargar={precargaJuridico}
          onVolver={() => setVista("elegir")}
          puedeElaborar={puede("elaborar")}
          puedeFirmarElabora={puede("firmar_elabora")}
          puedeValidar={puede("validar")}
          puedeAdmin={puedeAdmin}
        />
      )}

      {tab === "registral" && (
        <DictamenRegistral
          precarga={{ acreditado: garantia.cliente_nombre || garantia.deudor || "", numeroCredito: garantia.expediente || "", direccion: garantia.direccion_garantia || "" }}
          casoId={garantia.id || ""}
          onVolver={() => setTab("datos")}
          puedeFirmarElabora={puede("firmar_elabora")}
          puedeValidar={puede("validar")}
        />
      )}

      {tab === "avances" && <div className="rounded-xl border border-border p-5"><LineaVidaAreas caso={casoLV} /></div>}
    </div>
  );
}
