import { Badge } from "@/components/ui/badge";
import type { EstadoProcesal } from "@/lib/legal-types";

const estiloEstado: Record<EstadoProcesal, string> = {
  admision: "bg-blue-100 text-blue-900 border-blue-200",
  emplazamiento: "bg-cyan-100 text-cyan-900 border-cyan-200",
  contestacion: "bg-indigo-100 text-indigo-900 border-indigo-200",
  pruebas: "bg-amber-100 text-amber-900 border-amber-200",
  alegatos: "bg-orange-100 text-orange-900 border-orange-200",
  sentencia: "bg-emerald-100 text-emerald-900 border-emerald-200",
  apelacion: "bg-purple-100 text-purple-900 border-purple-200",
  amparo: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
  ejecucion: "bg-teal-100 text-teal-900 border-teal-200",
  concluido: "bg-slate-200 text-slate-700 border-slate-300",
  archivado: "bg-zinc-200 text-zinc-700 border-zinc-300",
};

const etiqueta: Record<EstadoProcesal, string> = {
  admision: "Admisión",
  emplazamiento: "Emplazamiento",
  contestacion: "Contestación",
  pruebas: "Pruebas",
  alegatos: "Alegatos",
  sentencia: "Sentencia",
  apelacion: "Apelación",
  amparo: "Amparo",
  ejecucion: "Ejecución",
  concluido: "Concluido",
  archivado: "Archivado",
};

export function EstadoBadge({ estado }: { estado: EstadoProcesal }) {
  return (
    <Badge variant="outline" className={`${estiloEstado[estado]} font-medium`}>
      {etiqueta[estado]}
    </Badge>
  );
}

const estiloRiesgo: Record<string, string> = {
  bajo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medio: "bg-amber-50 text-amber-800 border-amber-200",
  alto: "bg-orange-50 text-orange-800 border-orange-200",
  critico: "bg-red-50 text-red-800 border-red-300",
};

export function RiesgoBadge({ riesgo }: { riesgo: string }) {
  return (
    <Badge variant="outline" className={`${estiloRiesgo[riesgo] ?? ""} capitalize`}>
      {riesgo}
    </Badge>
  );
}
