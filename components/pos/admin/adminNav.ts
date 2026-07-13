import {
  Receipt,
  Truck,
  ShoppingCart,
  CreditCard,
  Building2,
  type LucideIcon,
} from "lucide-react";

export type AdminNavRole = "reception" | "accountant" | "master";

export type AdminNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  roles: AdminNavRole[];
  description: string;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    id: "admin-gastos",
    label: "Gastos",
    icon: Receipt,
    roles: ["reception", "accountant", "master"],
    description: "Registro de egresos operativos y contables.",
  },
  {
    id: "admin-proveedores",
    label: "Proveedores",
    icon: Truck,
    roles: ["reception", "accountant", "master"],
    description: "Directorio de proveedores y condiciones de pago.",
  },
  {
    id: "admin-compras",
    label: "Compras",
    icon: ShoppingCart,
    roles: ["reception", "accountant", "master"],
    description: "Órdenes de compra y recepción de mercancía.",
  },
  {
    id: "admin-cuentas-pagar",
    label: "Cuentas por pagar",
    icon: CreditCard,
    roles: ["reception", "accountant", "master"],
    description: "Obligaciones pendientes con proveedores.",
  },
];

export const ADMIN_SECTION_ICON = Building2;
export const ADMIN_SECTION_LABEL = "Administración";

export function isAdminTab(tabId: string) {
  return tabId.startsWith("admin-");
}

export function filterAdminNavByRole(
  items: AdminNavItem[],
  context: {
    isMaster: boolean;
    isAccountant: boolean;
    isReception: boolean;
  }
) {
  return items.filter((item) => {
    if (context.isMaster) return true;
    if (context.isAccountant) return item.roles.includes("accountant");
    if (context.isReception) return item.roles.includes("reception");
    return false;
  });
}

export function getAdminTabIdsForSession(context: {
  isMaster: boolean;
  isAccountant: boolean;
  isReception: boolean;
}) {
  return filterAdminNavByRole(ADMIN_NAV_ITEMS, context).map((item) => item.id);
}
