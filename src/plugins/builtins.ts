import type { EagleCapabilities } from '../host/eagle-capabilities';
import type { RuntimeSession } from '../sdui/runtime/session';
import { openBuiltinTool, type BuiltinTool } from './builtin-tool';
import { fileCreatorTool } from './file-creator';
import { recentLibrariesTool } from './recent-libraries';

export const builtinTools = [fileCreatorTool, recentLibrariesTool] as const;

export function getBuiltinTool(id: string): BuiltinTool | undefined {
  return builtinTools.find(tool => tool.manifest.id === id);
}

export async function openBuiltinToolById(id: string, capabilities: EagleCapabilities): Promise<RuntimeSession> {
  const tool = getBuiltinTool(id);
  if (!tool) throw new Error(`Unknown built-in tool ${id}`);
  return openBuiltinTool(tool, capabilities);
}
