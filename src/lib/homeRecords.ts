// Server-side helpers for /api/home: body validation, receipt files, and storage
// for the home record tables. In local mode records are written to
// .local-data/home-records.json and receipts to .local-data/home-records/, so
// they survive restarts (like restaurants and intake answers).

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isLocalMode } from "@/lib/local";
import { createClient } from "@/lib/supabase/server";
import { IMPROVEMENT_TYPES, MAINTENANCE_FREQUENCIES } from "@/config/homeRecords";
import type {
  HomeImprovement,
  HomeImprovementInput,
  MaintenanceItem,
  MaintenanceItemInput,
  MaintenanceService,
  MaintenanceServiceInput,
  Receipt,
} from "@/api/client";

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

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

const text = (value: unknown, max: number) => {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, max) || null;
};

const isRealDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

// null for blank, undefined for invalid.
const optionalDate = (value: unknown) => {
  if (value == null || value === "") return null;
  return typeof value === "string" && isRealDate(value) ? value : undefined;
};

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

// ─── Storage ───────────────────────────────────────────────────────────────

type Table = "home_improvements" | "maintenance_items" | "maintenance_services";
type StoredRow = { id: string; created_at: string; receipts?: Receipt[] };
type LocalData = Record<Table, StoredRow[]>;

const localFile = path.join(process.cwd(), ".local-data", "home-records.json");

const readLocal = async (): Promise<LocalData> => {
  try {
    return JSON.parse(await readFile(localFile, "utf8"));
  } catch (err) {
    // Only a missing file means "empty". Treating a damaged file as empty would
    // let the next save wipe it.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { home_improvements: [], maintenance_items: [], maintenance_services: [] };
    }
    throw err;
  }
};

// Changes run one at a time and swap the file in whole, so overlapping saves
// can't lose each other's work and a crash can't leave half a file.
let localQueue: Promise<unknown> = Promise.resolve();

const changeLocal = <R>(change: (data: LocalData) => R): Promise<R> => {
  const run = localQueue.then(async () => {
    const data = await readLocal();
    const result = change(data);
    await mkdir(path.dirname(localFile), { recursive: true });
    const temp = `${localFile}.tmp`;
    await writeFile(temp, JSON.stringify(data, null, 2) + "\n");
    await rename(temp, localFile);
    return result;
  });
  localQueue = run.catch(() => {});
  return run;
};

const removedReceipts = (before: StoredRow, after?: { receipts?: Receipt[] }) =>
  (before.receipts ?? [])
    .map((r) => r.path)
    .filter((p) => !after?.receipts?.some((r) => r.path === p));

const tableStore = <Row extends StoredRow, Input extends object>(table: Table) => ({
  list: async (userId: string): Promise<Row[]> => {
    if (isLocalMode) return (await readLocal())[table] as Row[];
    const supabase = await createClient();
    const { data, error } = await supabase.from(table).select("*").eq("user_id", userId);
    if (error) throw error;
    return (data ?? []) as Row[];
  },

  create: async (userId: string, input: Input): Promise<Row> => {
    if (isLocalMode) {
      const row = { id: randomUUID(), created_at: new Date().toISOString(), ...input } as unknown as Row;
      await changeLocal((data) => data[table].push(row));
      return row;
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(table)
      .insert({ user_id: userId, ...input })
      .select("*")
      .single();
    if (error) throw error;
    return data as Row;
  },

  // Returns null if there's no such row. Files for receipts taken off the record are deleted.
  update: async (userId: string, id: string, input: Input): Promise<Row | null> => {
    if (isLocalMode) {
      const change = await changeLocal((data) => {
        const index = data[table].findIndex((r) => r.id === id);
        if (index < 0) return null;
        const before = data[table][index];
        const row = { ...before, ...input };
        data[table][index] = row;
        return { before, row };
      });
      if (!change) return null;
      await removeReceiptFiles(removedReceipts(change.before, change.row));
      return change.row as unknown as Row;
    }
    const supabase = await createClient();
    const { data: before, error: readError } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw readError;
    if (!before) return null;
    const { data, error } = await supabase
      .from(table)
      .update(input)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    await removeReceiptFiles(removedReceipts(before as StoredRow, data as StoredRow));
    return data as Row;
  },

  remove: async (userId: string, id: string): Promise<void> => {
    if (isLocalMode) {
      const removed = await changeLocal((data) => {
        const row = data[table].find((r) => r.id === id);
        data[table] = data[table].filter((r) => r.id !== id);
        return row;
      });
      if (removed) await removeReceiptFiles(removedReceipts(removed));
      return;
    }
    const supabase = await createClient();
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (data) await removeReceiptFiles(removedReceipts(data as StoredRow));
  },
});

const homeImprovements = tableStore<HomeImprovement, HomeImprovementInput>("home_improvements");
const maintenanceItems = tableStore<MaintenanceItem, MaintenanceItemInput>("maintenance_items");
const maintenanceServices = tableStore<MaintenanceService, MaintenanceServiceInput>("maintenance_services");

// ─── Route handlers ────────────────────────────────────────────────────────

type Store<Row extends StoredRow, Input extends object> = ReturnType<typeof tableStore<Row, Input>>;

const errorMessage = (err: unknown) =>
  (err as { message?: string })?.message || "Something went wrong";

// GET, POST, PUT ?id=, DELETE ?id= for one table. Row-level security
// (supabase/schema.sql) limits queries to the signed-in user's rows; the user id
// filters in tableStore are belt-and-braces.
const recordRoutes = <Row extends StoredRow, Input extends object>(
  store: Store<Row, Input>,
  parse: (body: Record<string, unknown>, userId: string) => Promise<ParseResult<Input>>,
  beforeDelete?: (userId: string, id: string) => Promise<void>
) => {
  const withUser =
    (handler: (userId: string, request: Request) => Promise<Response>) =>
    async (request: Request) => {
      const { user, errorResponse } = await requireUser();
      if (errorResponse) return errorResponse;
      try {
        return await handler(user!.id, request);
      } catch (err) {
        return jsonResponse({ message: errorMessage(err) }, 500);
      }
    };

  const idOf = (request: Request) => new URL(request.url).searchParams.get("id");

  return {
    GET: withUser(async (userId) => jsonResponse(await store.list(userId))),

    POST: withUser(async (userId, request) => {
      const parsed = await parse(await request.json(), userId);
      if (!parsed.ok) return jsonResponse({ message: parsed.error }, 400);
      return jsonResponse(await store.create(userId, parsed.data), 201);
    }),

    PUT: withUser(async (userId, request) => {
      const id = idOf(request);
      if (!id) return jsonResponse({ message: "Missing id" }, 400);
      const parsed = await parse(await request.json(), userId);
      if (!parsed.ok) return jsonResponse({ message: parsed.error }, 400);
      const row = await store.update(userId, id, parsed.data);
      return row ? jsonResponse(row) : jsonResponse({ message: "Not found" }, 404);
    }),

    DELETE: withUser(async (userId, request) => {
      const id = idOf(request);
      if (!id) return jsonResponse({ message: "Missing id" }, 400);
      await beforeDelete?.(userId, id);
      await store.remove(userId, id);
      return new NextResponse(null, { status: 204 });
    }),
  };
};

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
