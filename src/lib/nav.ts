import {
  Home, FolderOpen, Newspaper, Send, Shield, GitBranch, Bot,
  FileText, FileSignature, FileCheck2, Building2, Network, Scale, Gavel, ShieldHalf, Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  sub?: string;
  to: string;
  search?: Record<string, unknown>;
  icon: LucideIcon;
  badge?: string;
  group: "Núcleo" | "Procesal" | "Inteligencia" | "Documentos" | "Trámites" | "Operación";
}

export const navItems: NavItem[] = [
  { label: "Inicio", to: "/", icon: Home, group: "Núcleo" },
  { label: "Expedientes", to: "/expedientes", icon: FolderOpen, group: "Núcleo" },

  { label: "UCM · Seguimiento", to: "/ucm", icon: Gavel, group: "Procesal" },
  { label: "UDP · Defensa y Protección", to: "/udp", icon: ShieldHalf, group: "Procesal" },
  { label: "UFC · Formalizaciones", to: "/ufc", icon: FileSignature, group: "Procesal" },

  { label: "Boletines Judiciales", to: "/boletines", icon: Newspaper, group: "Procesal" },
  { label: "Exhortos", to: "/exhortos", icon: Send, group: "Procesal" },
  { label: "Amparos", to: "/amparos", icon: Shield, group: "Procesal" },
  { label: "Recursos", to: "/recursos", icon: GitBranch, group: "Procesal" },

  { label: "JUFA", sub: "Pre-dictaminador", to: "/urrj", icon: Bot, group: "Inteligencia" },
  { label: "URRJ", sub: "Unidad de Resolución Jurídica · registro", to: "/urrj", search: { soloRegistro: true }, icon: Scale, group: "Inteligencia" },
  { label: "UCP", sub: "Unidad de Consolidación Patrimonial", to: "/ucp", icon: Building2, group: "Inteligencia" },

  { label: "Contratos", to: "/contratos", icon: FileSignature, group: "Documentos" },
  { label: "Editor de Contratos", to: "/contratos/editor", icon: FileText, group: "Documentos" },

  { label: "Trámites Gob.", to: "/tramites", icon: FileCheck2, group: "Trámites" },

  { label: "Conectores Juzgados", to: "/conectores", icon: Network, group: "Operación" },
];
