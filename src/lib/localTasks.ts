// Keeps local mode's tasks in .local-data/tasks.json so they survive restarts. This is
// separate from lib/local.ts because that file also reaches the browser, and this one
// needs the file system.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { localStore } from "@/lib/local";

const filePath = () => path.join(process.cwd(), ".local-data", "tasks.json");

const g = globalThis as typeof globalThis & { __localTasksSynced?: boolean };

export const loadLocalTasks = async () => {
  if (g.__localTasksSynced) return;
  try {
    const saved = JSON.parse(await readFile(filePath(), "utf8"));
    localStore.items = (saved.items ?? []).map((item: (typeof localStore.items)[number]) => ({
      ...item,
      box: item.box ?? null,
    }));
  } catch (err) {
    // Only a missing file means "nothing saved yet". Treating a damaged file as
    // empty would let the next save wipe it, so that error stops here.
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    // No file yet, but a running server can already hold tasks from before they were
    // saved to disk. Write those now, so a restart can't lose them.
    if (localStore.items.length > 0) await saveLocalTasks();
  }
  g.__localTasksSynced = true;
};

// Saves run one at a time and swap the file in whole, so overlapping saves can't
// lose each other's work and a crash can't leave half a file.
let queue: Promise<unknown> = Promise.resolve();

export const saveLocalTasks = () => {
  const run = queue.then(async () => {
    const target = filePath();
    await mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.tmp`;
    await writeFile(temp, JSON.stringify({ items: localStore.items }, null, 2) + "\n");
    await rename(temp, target);
  });
  queue = run.catch(() => {});
  return run;
};
