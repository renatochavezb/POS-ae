import { INITIAL_SERVICES } from "@/components/pos/data";

/** Precios base en MXN para el catálogo (editables después en Mongo). */
export const DEFAULT_SERVICE_PRICES = {
  "SRV-SGEL": 220,
  "SRV-RUBBER": 250,
  "SRV-ACR": 280,
  "SRV-TIPS": 260,
  "SRV-RET": 120,
  "SRV-DIS": 300,
  "SRV-POLY": 260,
  "SRV-GCON": 240,
  "SRV-ACRIG": 270,
  "SRV-TECH": 250,
  "SRV-DUAL": 290,
  "SRV-GMAN": 220,
  "SRV-HIBR": 320,
  "SRV-MAN": 180,
  "SRV-PED": 220,
  "SRV-ACPIE": 280,
  "SRV-LAMC": 350,
  "SRV-LAMPE": 380,
  "SRV-LASH": 450,
  "SRV-BROW": 200,
  "SRV-BLOW": 280,
  "SRV-CUT": 200,
  "SRV-COLOR": 450,
  "SRV-FAC": 350,
  "SRV-WAX": 150,
};

export function buildServiceSeedDocs() {
  return INITIAL_SERVICES.map((service) => ({
    serviceCode: service.id,
    name: service.name,
    category: service.category,
    subtitle: service.subtitle,
    price: DEFAULT_SERVICE_PRICES[service.id] ?? service.price ?? 0,
    duration: service.duration,
    image: service.image || "",
    description: service.description || "",
    staffIds: service.staffIds || [],
    exclusive: Boolean(service.exclusive),
    isActive: true,
  }));
}
