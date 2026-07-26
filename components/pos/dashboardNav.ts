import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck2,
  TrendingUp,
  Clock,
  Banknote,
  HandCoins,
  CalendarDays,
  GitCompareArrows,
  LineChart,
  Users,
  UserRoundSearch,
} from "lucide-react";

export type DashboardSectionId =
  | "citas-finalizadas"
  | "ventas-totales"
  | "ocupacion-cabinas"
  | "cortes-caja"
  | "propinas-semana"
  | "citas-semana"
  | "comparativo-semanal"
  | "historico-semanal"
  | "ranking-manicuristas"
  | "historico-manicurista";

export type DashboardNavItem = {
  id: DashboardSectionId;
  label: string;
  icon: LucideIcon;
};

/** Submenús del Dashboard, alineados a los títulos de cada indicador. */
export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { id: "citas-finalizadas", label: "Citas Finalizadas", icon: CalendarCheck2 },
  { id: "ventas-totales", label: "Ventas Totales", icon: TrendingUp },
  { id: "ocupacion-cabinas", label: "Ocupación Cabinas", icon: Clock },
  { id: "cortes-caja", label: "Cortes de Caja", icon: Banknote },
  { id: "propinas-semana", label: "Propinas de la semana", icon: HandCoins },
  { id: "citas-semana", label: "Citas de la semana", icon: CalendarDays },
  { id: "comparativo-semanal", label: "Comparativo semanal", icon: GitCompareArrows },
  { id: "historico-semanal", label: "Histórico semanal", icon: LineChart },
  { id: "ranking-manicuristas", label: "Ranking de manicuristas", icon: Users },
  { id: "historico-manicurista", label: "Histórico por manicurista", icon: UserRoundSearch },
];

export function dashboardSectionDomId(sectionId: DashboardSectionId | string) {
  return `dash-${sectionId}`;
}
