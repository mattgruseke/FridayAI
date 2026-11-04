// Server-side storage and route handlers shared by simple per-user tables. In
// local mode rows are written to .local-data/<file>.json so they survive restarts.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isLocalMode } from "@/lib/local";
import { createClient } from "@/lib/supabase/server";

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status });

// ─── Validation helpers ────────────────────────────────────────────────────

export const text = (value: unknown, max: number) => {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, max) || null;
};

export const isRealDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

// null for blank, undefined for invalid.
export const optionalDate = (value: unknown) => {
  if (value == null || value === "") return null;
  return isRealDate(value) ? value : undefined;
};

// ─── Storage ───────────────────────────────────────────────────────────────

type StoredRow = { id: string; created_at: string };
type LocalData = Record<string, StoredRow[]>;

const localPath = (file: string) => path.join(process.cwd(), ".local-data", `${file}.json`);

const readLocal = async (file: string): Promise<LocalData> => {
  try {
    return JSON.parse(await readFile(localPath(file), "utf8"));
  } catch (err) {
    // Only a missing file means "empty". Treating a damaged file as empty would
    // let the next save wipe it.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
};

// Changes run one at a time and swap the file in whole, so overlapping saves
// can't lose each other's work and a crash can't leave half a file.
let localQueue: Promise<unknown> = Promise.resolve();

const changeLocal = <R>(file: string, change: (data: LocalData) => R): Promise<R> => {
  const run = localQueue.then(async () => {
    const data = await readLocal(file);
    const result = change(data);
    const target = localPath(file);
    await mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.tmp`;
    await writeFile(temp, JSON.stringify(data, null, 2) + "\n");
    await rename(temp, target);
    return result;
  });
  localQueue = run.catch(() => {});
  return run;
};

// One table: `table` in Supabase, or that key of .local-data/<file>.json in local
// mode. onChange runs after an update (with the new row) or delete (without), for
// cleaning up anything the old row pointed at.
export const recordStore = <Row extends StoredRow, Input extends object>(
  file: string,
  table: string,
  onChange?: (before: Row, after?: Row) => Promise<void>
) => ({
  list: async (userId: string): Promise<Row[]> => {
    if (isLocalMode) return ((await readLocal(file))[table] ?? []) as Row[];
    const supabase = await createClient();
    const { data, error } = await supabase.from(table).select("*").eq("user_id", userId);
    if (error) throw error;
    return (data ?? []) as Row[];
  },

  create: async (userId: string, input: Input): Promise<Row> => {
    if (isLocalMode) {
      const row = { id: randomUUID(), created_at: new Date().toISOString(), ...input };
      await changeLocal(file, (data) => {
        data[table] = [...(data[table] ?? []), row];
      });
      return row as unknown as Row;
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

  // Returns null if there's no such row.
  update: async (userId: string, id: string, input: Input): Promise<Row | null> => {
    let before: Row;
    let after: Row;
    if (isLocalMode) {
      const change = await changeLocal(file, (data) => {
        const rows = data[table] ?? [];
        const index = rows.findIndex((r) => r.id === id);
        if (index < 0) return null;
        const old = rows[index];
        rows[index] = { ...old, ...input };
        data[table] = rows;
        return { old, row: rows[index] };
      });
      if (!change) return null;
      before = change.old as Row;
      after = change.row as Row;
    } else {
      const supabase = await createClient();
      const { data: old, error: readError } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (readError) throw readError;
      if (!old) return null;
      const { data, error } = await supabase
        .from(table)
        .update(input)
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error) throw error;
      before = old as Row;
      after = data as Row;
    }
    await onChange?.(before, after);
    return after;
  },

  remove: async (userId: string, id: string): Promise<void> => {
    let removed: Row | undefined;
    if (isLocalMode) {
      removed = (await changeLocal(file, (data) => {
        const rows = data[table] ?? [];
        data[table] = rows.filter((r) => r.id !== id);
        return rows.find((r) => r.id === id);
      })) as Row | undefined;
    } else {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from(table)
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      removed = (data ?? undefined) as Row | undefined;
    }
    if (removed) await onChange?.(removed);
  },
});

// ─── Route handlers ────────────────────────────────────────────────────────

const errorMessage = (err: unknown) =>
  (err as { message?: string })?.message || "Something went wrong";

// GET, POST, PUT ?id=, DELETE ?id= for one table. Row-level security
// (supabase/schema.sql) limits queries to the signed-in user's rows; the user id
// filters in recordStore are belt-and-braces.
export const recordRoutes = <Row extends StoredRow, Input extends object>(
  store: ReturnType<typeof recordStore<Row, Input>>,
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
