// Swaps a freshly written temp file in over the real one. On Windows that can briefly
// fail while something else has the file open, like OneDrive syncing the folder or
// antivirus scanning it, so those errors are retried for a few seconds first.

import { rename } from "node:fs/promises";

const RETRYABLE = new Set(["EPERM", "EBUSY", "EACCES"]);
const ATTEMPTS = 8; // waits of 25ms doubling each time, about 3 seconds in all

export const replaceFile = async (temp: string, target: string) => {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(temp, target);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? "";
      if (!RETRYABLE.has(code) || attempt >= ATTEMPTS) throw err;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** (attempt - 1)));
    }
  }
};
