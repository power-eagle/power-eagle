import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { canonical } from '../authoring';
import { foundationCatalog } from '../authoring/foundation';
import { builtinCatalogDocument } from '../catalog/builtins';
import { packageSchema, runtimeSchema } from '../schema/model';
import { unwrap, validatePackage, validateRuntime } from '../schema/validate';
import type { ValidationCatalog } from '../schema/validate';
import { emitRuntime, writeAtomic } from './emit';
import example from '../../../examples/runtime-only/document';
import flow from '../../../examples/runtime-flow/document';
import layout from '../../../examples/layout-widgets/document';
import content from '../../../examples/content-widgets/document';
import controls from '../../../examples/control-widgets/document';
import collectionFeedbackMedia from '../../../examples/collection-feedback-media/document';
import clipboardRuntime from '../../../examples/clipboard-runtime/document';

const clipboardDescriptor = {
  kind: 'service' as const, id: 'clipboard', methods: {
    read: { input: { type: 'null' as const }, output: { type: 'string' as const } },
    write: { input: { type: 'string' as const }, output: { type: 'null' as const } },
  },
};
const clipboardCatalog: ValidationCatalog = {
  ...foundationCatalog,
  exports: { 'power-eagle.clipboard/clipboard': { version: '1.0.0', descriptor: clipboardDescriptor } },
};

export async function main(command: string, args: string[]) {
  if (command === 'schemas') {
    for (const [name, schema] of [['runtime', runtimeSchema], ['package', packageSchema]] as const) {
      await writeAtomic(resolve(`docs/schemas/${name}.schema.json`), canonical(z.toJSONSchema(schema)));
    }
    console.log('Exported structural JSON schemas. Semantic validation remains required.');
  } else if (command === 'catalog') {
    await writeAtomic(resolve('docs/catalog/builtins.json'), canonical(builtinCatalogDocument));
    console.log('Exported docs/catalog/builtins.json');
  } else if (command === 'example') {
    for (const [directory, document, catalog] of [
      ['runtime-only', example, foundationCatalog], ['runtime-flow', flow, foundationCatalog],
      ['layout-widgets', layout, foundationCatalog], ['content-widgets', content, foundationCatalog],
      ['control-widgets', controls, foundationCatalog], ['collection-feedback-media', collectionFeedbackMedia, foundationCatalog],
      ['clipboard-runtime', clipboardRuntime, clipboardCatalog],
    ] as const) {
      const manifest = JSON.parse(await readFile(resolve(`examples/${directory}/manifest.json`), 'utf8'));
      unwrap(validatePackage(manifest));
      await emitRuntime(resolve(`examples/${directory}/run.json`), document, catalog);
      console.log(`Built examples/${directory}/run.json`);
    }
  } else if (command === 'validate' && args[0]) {
    const input = JSON.parse(await readFile(resolve(args[0]), 'utf8'));
    const result = input.format === 'power-eagle/package' ? validatePackage(input) : validateRuntime(input, foundationCatalog);
    unwrap<unknown>(result);
    console.log(`Valid: ${args[0]}`);
  } else throw new Error('Usage: npm run language -- schemas|catalog|example|validate <file>');
}
