import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { compile } from '../authoring';
import type { RuntimeDocument } from '../schema/model';
import type { ValidationCatalog } from '../schema/validate';

export async function writeAtomic(file: string, content: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { flag: 'wx' });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}
export async function emitRuntime(file: string, document: RuntimeDocument, catalog: ValidationCatalog): Promise<void> {
  // Validate the entire input before touching the destination or its parent.
  const content = compile(document, catalog);
  await writeAtomic(file, content);
}
