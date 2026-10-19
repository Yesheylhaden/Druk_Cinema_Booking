import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { seedData } from '../data/seed-data.js';

// Serialize mutations and atomically replace the file so concurrent requests
// cannot lose updates. Intended for one local backend process.
export async function createDataStore(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
  let data;
  try {
    data = JSON.parse(await readFile(filePath, 'utf8'));
    for (const key of ['movies', 'bookings', 'showtimes']) {
      if (!Array.isArray(data[key])) throw new Error(`Invalid database: missing ${key}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    data = structuredClone(seedData);
    await writeFile(filePath, JSON.stringify(data, null, 2), { flag: 'wx' });
  }
  let queue = Promise.resolve();
  return {
    read: () => structuredClone(data),
    update(mutate) {
      const operation = queue.then(async () => {
        const next = structuredClone(data);
        const result = mutate(next);
        await writeFile(`${filePath}.tmp`, JSON.stringify(next, null, 2));
        await rename(`${filePath}.tmp`, filePath);
        data = next;
        return result;
      });
      queue = operation.catch(() => {});
      return operation;
    }
  };
}
