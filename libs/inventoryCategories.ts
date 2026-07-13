export type InventoryCategoryId =
  | "preparacion"
  | "bases"
  | "geles"
  | "efectos"
  | "top-coat"
  | "semipermanente"
  | "acrilico"
  | "monomero"
  | "acrygel"
  | "consumibles"
  | "herramientas"
  | "acabados";

export type InventorySystemId =
  | "gel"
  | "acrilico"
  | "acrygel"
  | "semi"
  | "universal";

export const INVENTORY_CATEGORIES: {
  id: InventoryCategoryId;
  label: string;
  description: string;
}[] = [
  {
    id: "preparacion",
    label: "Preparación",
    description: "Dehydrator, nail prep, primer ácido y sin ácido, bond enhancer.",
  },
  {
    id: "bases",
    label: "Bases",
    description: "Base coat, rubber base, base constructora clear, milky, nude y pink.",
  },
  {
    id: "geles",
    label: "Geles",
    description: "Gel constructor, hard gel, builder gel, french builder.",
  },
  {
    id: "efectos",
    label: "Efectos",
    description: "Glitter, chrome, cat eye, foil, blooming, aurora y decoración.",
  },
  {
    id: "top-coat",
    label: "Top Coat",
    description: "Brillante, mate, no wipe, flex gel y selladores.",
  },
  {
    id: "semipermanente",
    label: "Semipermanente",
    description: "Colores gel polish para manicura tradicional en gel.",
  },
  {
    id: "acrilico",
    label: "Acrílico",
    description: "Polvo acrílico clear, cover, pink, white y camouflage.",
  },
  {
    id: "monomero",
    label: "Monómero",
    description: "Líquido acrílico, monómero odorless y dappen dish.",
  },
  {
    id: "acrygel",
    label: "Acrygel / Polygel",
    description: "Polygel en distintos tonos y solución premium para modelado.",
  },
  {
    id: "consumibles",
    label: "Consumibles",
    description: "Cleaner, acetona, toallitas, tips, moldes y desinfectante.",
  },
  {
    id: "herramientas",
    label: "Herramientas",
    description: "Pinceles, limas, buffers, empujadores y cortacutículas.",
  },
  {
    id: "acabados",
    label: "Acabados",
    description: "Aceite de cutícula, crema de manos y productos post-servicio.",
  },
];

export const INVENTORY_SYSTEMS: { id: InventorySystemId; label: string }[] = [
  { id: "gel", label: "Sistema gel" },
  { id: "acrilico", label: "Sistema acrílico" },
  { id: "acrygel", label: "Acrygel / Polygel" },
  { id: "semi", label: "Semipermanente" },
  { id: "universal", label: "Universal" },
];

export const INVENTORY_UNITS = [
  { id: "ml", label: "ml" },
  { id: "gr", label: "gr" },
  { id: "pieza", label: "pieza" },
  { id: "par", label: "par" },
  { id: "caja", label: "caja" },
  { id: "litro", label: "litro" },
  { id: "set", label: "set" },
  { id: "rollo", label: "rollo" },
] as const;

export function getInventoryCategoryLabel(categoryId: string) {
  return INVENTORY_CATEGORIES.find((row) => row.id === categoryId)?.label || categoryId;
}

export function getInventorySystemLabel(systemId: string) {
  return INVENTORY_SYSTEMS.find((row) => row.id === systemId)?.label || systemId;
}
