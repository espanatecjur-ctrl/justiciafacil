import {
  Home, FolderOpen, Newspaper, Send, Shield, GitBranch, Clock, Bot,
  FileText, FileSignature, FileCheck2, Building2, Network, Scale, Gavel, Swords, ShieldHalf, Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: string;
  group: "Núcleo" | "Procesal" | "Inteligencia" | "Documentos" | "Trámites" | "Operación";
}

export const navItems: NavItem[] = [
  { label: "Inicio", to: "/", icon: Home, group: "Núcleo" },
  { label: "Expedientes", to: "/expedientes", icon: FolderOpen, group: "Núcleo" },
  { label: "Hitos & Agenda", to: "/hitos", icon: Clock, group: "Núcleo" },

  { label: "UCM · Seguimiento", to: "/ucm", icon: Gavel, group: "Procesal" },
  { label: "UDP · Defensa y Protección", to: "/udp", icon: ShieldHalf, group: "Procesal" },
  { label: "Control de demandas", to: "/control-demandas", icon: Swords, group: "Procesal" },
  { label: "Boletines Judiciales", to: "/boletines", icon: Newspaper, group: "Procesal" },
  { label: "Exhortos", to: "/exhortos", icon: Send, group: "Procesal" },
  { label: "Amparos", to: "/amparos", icon: Shield, group: "Procesal" },
  { label: "Recursos", to: "/recursos", icon: GitBranch, group: "Procesal" },

  { label: "Robot Pre-Dictaminador", to: "/dictamen-ia", icon: Bot, badge: "IA", group: "Inteligencia" },
  { label: "URRJ · Pre-dictamen", to: "/urrj", icon: Scale, group: "Inteligencia" },

  { label: "Contratos", to: "/contratos", icon: FileSignature, group: "Documentos" },
  { label: "Editor de Contratos", to: "/contratos/editor", icon: FileText, group: "Documentos" },

  { label: "Trámites Gob.", to: "/tramites", icon: FileCheck2, group: "Trámites" },
  { label: "UCP", to: "/ucp", icon: Building2, group: "Trámites" },

  { label: "Conectores Juzgados", to: "/conectores", icon: Network, group: "Operación" },
];
