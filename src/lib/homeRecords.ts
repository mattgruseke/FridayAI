// Server-side helpers for /api/home: body validation, receipt files, and the home
// record tables. In local mode records are written to .local-data/home-records.json
// and receipts to .local-data/home-records/, so they survive restarts (like
// restaurants and intake answers).

import { unlink } from "node:fs/promises";
import path from "node:path";
import { isLocalMode } from "@/lib/local";
import { jsonResponse, optionalDate, recordRoutes, recordStore, text } from "@/lib/recordStore";
import type { ParseResult } from "@/lib/recordStore";
import { createClient } from "@/lib/supabase/server";
import { IMPROVEMENT_TYPES, MAINTENANCE_FREQUENCIES } from "@/config/homeRecords";
import { PROVIDER_CATEGORIES } from "@/config/homeManagerIntake";
import { unassignProvider } from "@/lib/taskStore";
import type {
  HomeImprovement,
  HomeImprovementInput,
  MaintenanceItem,
  MaintenanceItemInput,
  MaintenanceService,
  MaintenanceServiceInput,
  Receipt,
  ServiceProvider,
  ServiceProviderInput,
} from "@/api/client";

export { jsonResponse };

// ─── Receipts ──────────────────────────────────────────────────────────────

export const RECEIPTS_BUCKET = "home-records";
export const MAX_RECEIPT_BYTES = 25 * 1024 * 1024;
export const RECEIPT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
};

export const localReceiptsDir = path.join(process.cwd(), ".local-data", "home-records");

// Receipts live in <user id>/<generated name>. The strict name rules out path tricks.
export const isOwnReceiptPath = (receiptPath: string, userId: string) =>
  receiptPath.startsWith(`${userId}/`) &&
  /^[\w-]+\.(pdf|jpg|png|heic)$/.test(receiptPath.slice(userId.length + 1));

export const removeReceiptFiles = async (paths: string[]) => {
  if (paths.length === 0) return;
  if (isLocalMode) {
    await Promise.all(paths.map((p) => unlink(path.join(localReceiptsDir, p)).catch(() => {})));
    return;
  }
  const supabase = await createClient();
  await supabase.storage.from(RECEIPTS_BUCKET).remove(paths);
};

// ─── Validation ────────────────────────────────────────────────────────────

const optionalCost = (value: unknown) => {
  if (value == null || value === "") return null;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1e10
    ? Math.round(value * 100) / 100
    : undefined;
};

const parseReceipts = (value: unknown, userId: string): Receipt[] | undefined => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 50) return undefined;
  const receipts: Receipt[] = [];
  for (const entry of value) {
    const name = text(entry?.name, 200);
    const receiptPath = entry?.path;
    if (!name || typeof receiptPath !== "string" || !isOwnReceiptPath(receiptPath, userId)) {
      return undefined;
    }
    receipts.push({ name, path: receiptPath });
  }
  return receipts;
};

const parseImprovement = async (
  body: Record<string, unknown>,
  userId: string
): Promise<ParseResult<HomeImprovementInput>> => {
  const title = text(body.title, 200);
  if (!title) return { ok: false, error: "Project name is required" };
  if (!IMPROVEMENT_TYPES.some((t) => t.id === body.type)) return { ok: false, error: "Invalid type" };

  const completed_on = optionalDate(body.completed_on);
  if (completed_on === undefined) return { ok: false, error: "Invalid date" };
  const warranty_until = optionalDate(body.warranty_until);
  if (warranty_until === undefined) return { ok: false, error: "Invalid warranty date" };
  const cost = optionalCost(body.cost);
  if (cost === undefined) return { ok: false, error: "Invalid cost" };
  const receipts = parseReceipts(body.receipts, userId);
  if (!receipts) return { ok: false, error: "Invalid receipts" };

  return {
    ok: true,
    data: {
      title,
      type: body.type as HomeImprovementInput["type"],
      completed_on,
      cost,
      done_by: text(body.done_by, 200),
      warranty_until,
      notes: text(body.notes, 5000),
      receipts,
    },
  };
};

const parseMaintenanceItem = async (
  body: Record<string, unknown>
): Promise<ParseResult<MaintenanceItemInput>> => {
  const title = text(body.title, 200);
  if (!title) return { ok: false, error: "Item name is required" };
  const interval_months = (body.interval_months ?? null) as number | null;
  if (!MAINTENANCE_FREQUENCIES.some((f) => f.months === interval_months)) {
    return { ok: false, error: "Invalid frequency" };
  }
  return { ok: true, data: { title, interval_months, notes: text(body.notes, 5000) } };
};

const parseService = async (
  body: Record<string, unknown>,
  userId: string
): Promise<ParseResult<MaintenanceServiceInput>> => {
  const items = await maintenanceItems.list(userId);
  if (!items.some((i) => i.id === body.item_id)) return { ok: false, error: "Unknown maintenance item" };

  const service_on = optionalDate(body.service_on);
  if (!service_on) return { ok: false, error: "A valid service date is required" };
  const cost = optionalCost(body.cost);
  if (cost === undefined) return { ok: false, error: "Invalid cost" };
  const receipts = parseReceipts(body.receipts, userId);
  if (!receipts) return { ok: false, error: "Invalid receipts" };

  return {
    ok: true,
    data: {
      item_id: body.item_id as string,
      service_on,
      provider: text(body.provider, 200),
      cost,
      notes: text(body.notes, 5000),
      receipts,
    },
  };
};

// Websites are saved with their scheme, so "smithplumbing.com" becomes a working link.
const optionalWebsite = (value: unknown) => {
  const site = text(value, 500);
  if (!site) return null;
  const withScheme = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes(".") ? withScheme : undefined;
  } catch {
    return undefined;
  }
};

const parseProvider = async (body: Record<string, unknown>): Promise<ParseResult<ServiceProviderInput>> => {
  const name = text(body.name, 200);
  if (!name) return { ok: false, error: "Name is required" };
  if (!PROVIDER_CATEGORIES.includes(body.category as string)) return { ok: false, error: "Pick what they do" };
  const email = text(body.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "That email doesn't look right" };
  const website = optionalWebsite(body.website);
  if (website === undefined) return { ok: false, error: "That website doesn't look right" };

  return {
    ok: true,
    data: {
      name,
      category: body.category as string,
      company: text(body.company, 200),
      phone: text(body.phone, 50),
      email,
      website,
      notes: text(body.notes, 5000),
    },
  };
};

// ─── Tables ────────────────────────────────────────────────────────────────

const receiptPaths = (row: { receipts?: Receipt[] }) => (row.receipts ?? []).map((r) => r.path);

// Deletes the files for receipts taken off a record, or for a deleted record.
const cleanUpReceipts = async (before: { receipts?: Receipt[] }, after?: { receipts?: Receipt[] }) => {
  const kept = after ? receiptPaths(after) : [];
  await removeReceiptFiles(receiptPaths(before).filter((p) => !kept.includes(p)));
};

const LOCAL_FILE = "home-records";

const homeImprovements = recordStore<HomeImprovement, HomeImprovementInput>(
  LOCAL_FILE,
  "home_improvements",
  cleanUpReceipts
);
const maintenanceItems = recordStore<MaintenanceItem, MaintenanceItemInput>(LOCAL_FILE, "maintenance_items");
const maintenanceServices = recordStore<MaintenanceService, MaintenanceServiceInput>(
  LOCAL_FILE,
  "maintenance_services",
  cleanUpReceipts
);

const serviceProviders = recordStore<ServiceProvider, ServiceProviderInput>(LOCAL_FILE, "service_providers");

export const providerExists = async (userId: string, id: unknown) =>
  typeof id === "string" && (await serviceProviders.list(userId)).some((p) => p.id === id);

// Deleting a provider takes them off their tasks; the tasks themselves stay.
export const providerRoutes = recordRoutes(serviceProviders, parseProvider, unassignProvider);

export const improvementRoutes = recordRoutes(homeImprovements, parseImprovement);

export const serviceRoutes = recordRoutes(maintenanceServices, parseService);

// Deleting an item deletes its service history, one row at a time so the receipt
// files go too. The page warns before this happens.
export const maintenanceItemRoutes = recordRoutes(
  maintenanceItems,
  parseMaintenanceItem,
  async (userId, id) => {
    const services = await maintenanceServices.list(userId);
    for (const service of services.filter((s) => s.item_id === id)) {
      await maintenanceServices.remove(userId, service.id);
    }
  }
);
