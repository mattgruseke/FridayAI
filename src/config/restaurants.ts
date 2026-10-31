// Filter options for the Restaurants page. Shared by the UI and /api/restaurants;
// keep the ids in sync with the check constraints in supabase/schema.sql.

// Towns shown as location filters. A restaurant matches a town when its
// location contains the town name, so "Downtown Darien" matches Darien.
export const TOWNS = [
  { id: "Darien", label: "Darien" },
  { id: "New Canaan", label: "New Canaan" },
  { id: "Greenwich", label: "Greenwich" },
  { id: "Stamford", label: "Stamford" },
  { id: "Westport", label: "Westport" },
  { id: "Norwalk", label: "Norwalk" },
] as const;

export type Town = (typeof TOWNS)[number]["id"];

export const inTown = (location: string | null, town: string) =>
  !!location && location.toLowerCase().includes(town.toLowerCase());

export const CUISINES = [
  { id: "breakfast", label: "Breakfast" },
  { id: "italian", label: "Italian" },
  { id: "mexican", label: "Mexican" },
  { id: "chinese", label: "Chinese" },
  { id: "poke", label: "Poke" },
  { id: "sushi", label: "Sushi" },
  { id: "indian", label: "Indian" },
  { id: "ramen", label: "Ramen" },
  { id: "greek", label: "Greek" },
  { id: "bakeries", label: "Bakeries" },
  { id: "thai", label: "Thai" },
  { id: "salads", label: "Salads" },
  { id: "bbq", label: "BBQ" },
  { id: "other", label: "Other" },
] as const;

export const OCCASIONS = [
  { id: "datenight", label: "Date Night" },
  { id: "casual", label: "Casual / Family" },
] as const;

export const SERVICES = [
  { id: "dinein", label: "Dine-in" },
  { id: "delivery", label: "Delivery" },
  { id: "takeout", label: "Takeout" },
] as const;

export type Cuisine = (typeof CUISINES)[number]["id"];
export type Occasion = (typeof OCCASIONS)[number]["id"];
export type Service = (typeof SERVICES)[number]["id"];

export const CUISINE_IDS = CUISINES.map((c) => c.id) as Cuisine[];
export const OCCASION_IDS = OCCASIONS.map((o) => o.id) as Occasion[];
export const SERVICE_IDS = SERVICES.map((s) => s.id) as Service[];

const labelOf = (list: readonly { id: string; label: string }[], id: string) =>
  list.find((x) => x.id === id)?.label ?? id;

export const cuisineLabel = (id: string) => labelOf(CUISINES, id);
export const occasionLabel = (id: string) => labelOf(OCCASIONS, id);
export const serviceLabel = (id: string) => labelOf(SERVICES, id);
