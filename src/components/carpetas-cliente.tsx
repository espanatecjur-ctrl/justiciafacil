import { useEffect, useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";
import { CarpetaDriveVinculada } from "@/components/carpeta-drive-vinculada";
import { Loader2 } from "lucide-react";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

interface Fila { id: string; drive_carpeta_id: string; drive_carpeta_nombre: string | null; }

// Carpeta de Drive del cliente — reutiliza el MISMO módulo de UCM (CarpetaDriveVinculada):
// Vincular / Crear / Sincronizar / copia fija / vista previa. La carpeta se guarda por cliente
// en cliente_carpeta, y las copias fijas quedan bajo el juicio (visibles para todo el equipo).
export function CarpetasCliente({ casoId, clienteNombre, expediente }: { casoId: string; clienteNombre: string; expediente?: string | null }) {
  const [fila, setFila] = useState<Fila | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = () => fetch(`${SUPABASE_URL}/rest/v1/cliente_carpeta?select=id,drive_carpeta_id,drive_carpeta_nombre&caso_id=eq.${casoId}&cliente_nombre=eq.${encodeURIComponent(clienteNombre)}&order=created_at.asc&limit=1`, { headers })
    .then((r) => (r.ok ? r.json() : [])).then((a) => setFila(a[0] || null)).catch(() => {}).finally(() => setCargando(false));
  useEffect(() => { setCargando(true); cargar(); }, [casoId, clienteNombre]);

  // "caso virtual" del cliente para reutilizar el componente tal cual
  const casoVirtual = {
    id: casoId,
    expediente: expediente ?? null,
    drive_carpeta_id: fila?.drive_carpeta_id ?? null,
    drive_carpeta_nombre: fila?.drive_carpeta_nombre ?? null,
  } as unknown as CasoJuridico;

  const guardar = async (campos: Record<string, string>) => {
    const body = { drive_carpeta_id: campos.drive_carpeta_id, drive_carpeta_nombre: campos.drive_carpeta_nombre };
    if (fila) {
      await fetch(`${SUPABASE_URL}/rest/v1/cliente_carpeta?id=eq.${fila.id}`, { method: "PATCH", headers, body: JSON.stringify(body) });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/cliente_carpeta`, { method: "POST", headers, body: JSON.stringify({ caso_id: casoId, cliente_nombre: clienteNombre, ...body }) });
    }
    cargar();
  };

  if (cargando) return <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>;

  return (
    <div className="p-3">
      <CarpetaDriveVinculada key={fila?.drive_carpeta_id || "sin"} caso={casoVirtual} area="UCM" onGuardar={guardar} />
    </div>
  );
}
