import { z } from 'zod';
import { identifier } from '../../sdui/schema/model';
import type { EnablementPersistence } from '../activation/enablement';

const schema = z.strictObject({
  format: z.literal('power-eagle/instance-preferences'), formatVersion: z.literal(1),
  instances: z.record(identifier, z.boolean()),
  exports: z.record(identifier, z.record(identifier, z.boolean())),
});
export class InstancePreferences {
  private constructor(private readonly storage: EnablementPersistence, private data: z.infer<typeof schema>) {}
  static open(storage: EnablementPersistence): InstancePreferences {
    const raw = storage.read();
    try {
      return new InstancePreferences(storage, raw === null
        ? { format: 'power-eagle/instance-preferences', formatVersion: 1, instances: {}, exports: {} }
        : schema.parse(JSON.parse(raw)));
    } catch { throw new Error('Invalid or incompatible plugin preferences; reset preferences to continue'); }
  }
  enabled(instanceId: string, defaultValue = true): boolean { return this.data.instances[instanceId] ?? defaultValue; }
  exportEnabled(instanceId: string, exportId: string): boolean { return this.data.exports[instanceId]?.[exportId] ?? true; }
  setInstance(instanceId: string, enabled: boolean): void {
    identifier.parse(instanceId);
    this.write({ ...this.data, instances: { ...this.data.instances, [instanceId]: enabled } });
  }
  setExport(instanceId: string, exportId: string, enabled: boolean): void {
    identifier.parse(instanceId); identifier.parse(exportId);
    this.write({ ...this.data, exports: { ...this.data.exports, [instanceId]: { ...this.data.exports[instanceId], [exportId]: enabled } } });
  }
  private write(next: z.infer<typeof schema>): void {
    this.storage.write(JSON.stringify(next));
    this.data = next;
  }
}
