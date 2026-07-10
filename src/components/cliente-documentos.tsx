// ============================================================
// ClienteDocumentos · carpeta de Drive PROPIA del cliente,
// independiente de las carpetas por garantía (URRJ/UCP/UCM/UFC).
// Reusa el mismo par de componentes que usa la ficha de UCM
// (CarpetaDriveVinculada + DocumentosFijos), pero apuntando a la
// tabla cliente_documentos en vez de a caso_juridico.
// ============================================================
import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CarpetaDriveVinculada } from "@/components/carpeta-drive-vinculada";
import { DocumentosFijos } from "@/components/documentos-fijos";
import { SUPABASE_URL, SUPABASE_KEY, type CasoJuridico } from "@/lib/supabase";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\(.*$/, "").replace(/\s+/g, " ").trim();

interface ClienteDocRow {
  id: string;
  nombre_cliente: string;
  nombre_normalizado: string;
  drive_carpeta_id: string | null;
  drive_carpeta_nombre: string | null;
}

export function ClienteDocumentos({ nombreCliente }: { nombreCliente: string }) {
  const [fila, setFila] = useState<ClienteDocRow | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!nombreCliente) { setCargando(false); return; }
    let vivo = true;
    setCargando(true);
    const nn = norm(nombreCliente);
    (async () => {
      // 1) ¿ya existe? busca por nombre normalizado (ignora acentos/mayúsculas)
      const existentes: ClienteDocRow[] = await fetch(
        `${SUPABASE_URL}/rest/v1/cliente_documentos?select=*&nombre_normalizado=eq.${encodeURIComponent(nn)}&limit=1`,
        { headers }
      ).then((r) => (r.ok ? r.json() : [])).catch(() => []);
      if (!vivo) return;
      if (existentes.length > 0) { setFila(existentes[0]); setCargando(false); return; }

      // 2) no existe todavía → se crea la fila vacía (sin carpeta) la primera vez que se abre
      const creada: ClienteDocRow[] = await fetch(`${SUPABASE_URL}/rest/v1/cliente_documentos`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
        body: JSON.stringify({ nombre_cliente: nombreCliente, nombre_normalizado: nn }),
      }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
      if (!vivo) return;
      setFila(creada?.[0] || null);
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [nombreCliente]);

  const guardarCarpeta = async (campos: Record<string, string>) => {
    if (!fila) return;
    await fetch(`${SUPABASE_URL}/rest/v1/cliente_documentos?id=eq.${fila.id}`, {
      method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(campos),
    });
    setFila({ ...fila, ...(campos as any) });
  };

  if (cargando) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> Cargando documentos del cliente…
      </Card>
    );
  }
  if (!fila) return null;

  // Objeto "caso" sintético — nunca se guarda como expediente, solo presta la
  // forma que necesitan CarpetaDriveVinculada / DocumentosFijos.
  const casoCliente: CasoJuridico = {
    id: fila.id,
    estatus_revision: null, tipo_proceso: null, gar_id: null,
    cliente_codigo: null, proveedor: null, no_credito: null,
    expediente: `Cliente - ${fila.nombre_cliente}`,
    drive_carpeta_id: fila.drive_carpeta_id,
    drive_carpeta_nombre: fila.drive_carpeta_nombre,
    juzgado: null, distrito_judicial: null, entidad: null, materia: null, via_procesal: null,
    etapa_actual: null, estatus_general: null, prioridad: null, tiene_cliente: null,
    cliente_nombre: fila.nombre_cliente, cliente_id: null, direccion_garantia: null,
    unidad: "CLIENTE", encargado_unidad: null, nota_adicional: null,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Users className="h-4 w-4 text-[color:#2E6DA8]" />
        <h3 className="text-sm font-semibold" style={{ color: "#2E6DA8" }}>Documentos del cliente</h3>
        <span className="text-xs text-muted-foreground">· propios de {fila.nombre_cliente}, separados de las carpetas por garantía</span>
      </div>
      <CarpetaDriveVinculada caso={casoCliente} area="CLIENTE" onGuardar={guardarCarpeta} />
      <DocumentosFijos caso={casoCliente} area="CLIENTE" />
    </div>
  );
}
