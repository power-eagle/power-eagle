import { z } from 'zod';
import { identifier, relativePath } from '../../sdui/schema/model';

const revisionId = z.number().int().positive();
export const pluginRevisionSchema = z.strictObject({
  id: revisionId, artifact: relativePath, createdAt: z.string().datetime(),
  basedOn: revisionId.nullable(),
});
export const pluginInstanceSchema = z.strictObject({
  format: z.literal('power-eagle/plugin-instance'), formatVersion: z.literal(1),
  instanceId: identifier, namespace: identifier, name: z.string().trim().min(1).max(120),
  origin: z.strictObject({ kind: z.enum(['built-in', 'acquired', 'local', 'agent']), sourceId: z.string().min(1) }),
  currentRevision: revisionId, revisions: z.array(pluginRevisionSchema).min(1),
  forkOf: z.strictObject({ instanceId: identifier, revision: revisionId }).optional(),
  namespaceConflict: z.strictObject({ namespace: identifier, sourceInstanceId: identifier }).optional(),
}).superRefine((instance, context) => {
  const seen = new Set<number>();
  for (const revision of instance.revisions) {
    if (seen.has(revision.id) || (revision.basedOn !== null && !seen.has(revision.basedOn))) {
      context.addIssue({ code: 'custom', message: 'Revision IDs must be unique with existing earlier bases' });
    }
    seen.add(revision.id);
  }
  if (!seen.has(instance.currentRevision)) context.addIssue({ code: 'custom', message: 'Current revision does not belong to this instance' });
  if (instance.forkOf && instance.forkOf.instanceId === instance.instanceId) context.addIssue({ code: 'custom', message: 'An instance cannot fork itself' });
  if (Boolean(instance.forkOf) !== Boolean(instance.namespaceConflict)
    || (instance.namespaceConflict && (instance.namespaceConflict.namespace !== instance.namespace
      || instance.namespaceConflict.sourceInstanceId !== instance.forkOf?.instanceId))) {
    context.addIssue({ code: 'custom', message: 'A fork must declare its source instance and matching namespace conflict' });
  }
});
export type PluginInstance = z.infer<typeof pluginInstanceSchema>;
export type PluginRevision = z.infer<typeof pluginRevisionSchema>;

export const conversationSchema = z.strictObject({
  format: z.literal('power-eagle/conversation'), formatVersion: z.literal(1), instanceId: identifier,
  draft: z.string(), selectedBase: revisionId,
  context: z.strictObject({ eagle: z.boolean(), web: z.boolean() }),
  nextTurnId: revisionId,
  turns: z.array(z.strictObject({
    id: revisionId, base: revisionId, instruction: z.string(), createdAt: z.string().datetime(),
    status: z.enum(['pending', 'success', 'failed']), revision: revisionId.optional(), error: z.string().optional(), hidden: z.boolean().optional(),
  })),
});
export type PluginConversation = z.infer<typeof conversationSchema>;

export const workspaceCatalogSchema = z.strictObject({
  format: z.literal('power-eagle/workspace-catalog'), formatVersion: z.literal(1),
  order: z.array(identifier), instances: z.array(pluginInstanceSchema),
  conversations: z.record(identifier, conversationSchema).default({}),
}).superRefine((catalog, context) => {
  const ids = catalog.instances.map(item => item.instanceId);
  for (const [id, conversation] of Object.entries(catalog.conversations)) {
    const instance = catalog.instances.find(item => item.instanceId === id);
    if (!instance || conversation.instanceId !== id || !instance.revisions.some(item => item.id === conversation.selectedBase)
      || new Set(conversation.turns.map(item => item.id)).size !== conversation.turns.length
      || conversation.turns.some(turn => turn.id >= conversation.nextTurnId || !instance.revisions.some(item => item.id === turn.base)
        || (turn.revision !== undefined && !instance.revisions.some(item => item.id === turn.revision)))) {
      context.addIssue({ code: 'custom', message: 'Conversation identity, turn IDs or revision ownership are invalid' });
    }
  }
  if (new Set(ids).size !== ids.length || new Set(catalog.order).size !== catalog.order.length
    || catalog.order.length !== ids.length || catalog.order.some(id => !ids.includes(id))) {
    context.addIssue({ code: 'custom', message: 'Catalog order must contain every unique instance exactly once' });
  }
});
export type WorkspaceCatalog = z.infer<typeof workspaceCatalogSchema>;
export interface PluginSelection { instanceId: string; revision: number; exportId?: string; screen?: string }

export function newPluginInstance(name: string, origin: PluginInstance['origin'], source?: PluginInstance): PluginInstance {
  const instanceId = `plugin.${crypto.randomUUID()}`;
  return pluginInstanceSchema.parse({
    format: 'power-eagle/plugin-instance', formatVersion: 1, instanceId,
    namespace: source?.namespace ?? instanceId, name, origin, currentRevision: 1,
    revisions: [{ id: 1, artifact: 'revisions/1', createdAt: new Date().toISOString(), basedOn: null }],
    ...(source ? {
      forkOf: { instanceId: source.instanceId, revision: source.currentRevision },
      namespaceConflict: { namespace: source.namespace, sourceInstanceId: source.instanceId },
    } : {}),
  });
}

export function parseWorkspaceCatalog(value: unknown): WorkspaceCatalog {
  const result = workspaceCatalogSchema.safeParse(value);
  if (!result.success) throw new Error(`Invalid or incompatible plugin workspace catalog: ${result.error.message}`);
  return result.data;
}
