export const MARKET_REFERENCE = {
  locations: {
    "College Campus": { footfall: 800, segment: "Students" },
    "IT Park": { footfall: 500, segment: "Young Professionals" },
    "Residential Area": { footfall: 400, segment: "Families" },
    "Health Club Zone": { footfall: 300, segment: "Health-conscious" },
  },
  menus: {
    "Trendy & Affordable": { segment: "Students", unitCost: 25 },
    "Quality & Convenience": { segment: "Young Professionals", unitCost: 40 },
    "Variety & Hygiene": { segment: "Families", unitCost: 45 },
    "Healthy Options": { segment: "Health-conscious", unitCost: 55 },
  },
  segments: {
    Students: { min: 40, max: 80, sensitivity: "High" },
    "Young Professionals": { min: 80, max: 150, sensitivity: "Medium" },
    Families: { min: 100, max: 180, sensitivity: "Low" },
    "Health-conscious": { min: 120, max: 200, sensitivity: "Low" },
  },
  fixedCost: 8_000,
  capacityUnitCost: 15,
  promotionBoostCap: 50_000,
} as const;

export type MarketLocation = keyof typeof MARKET_REFERENCE.locations;
export type MarketMenu = keyof typeof MARKET_REFERENCE.menus;