/**
 * Orchestrate one AI plugin generation: build the prompt from the live
 * registries, ask the model for a module, write it under aidriven/<id>/, load it
 * through the disk loader, and record the attempt (ok or failed) either way. All
 * collaborators are injected so the pipeline is testable without a real model,
 * filesystem home, or Eagle webview import.
 */
import { buildGenerationPrompt, type PromptOptions } from './prompt';
import { generatePluginSource, type AiModule } from './ai-bridge';
import { writeGeneratedPlugin, recordAttempt, type Attempt } from './aidriven-store';
import { loadDiskPlugin, nativeImport, type ModuleImporter } from '../host/install/disk-plugin';
import type { HostContext } from '../app/host-service';
import type { AnyPluginModule } from '../plugins/builtins';

/** Collaborators for one generation run. */
export interface GenerateDeps {
  ai: AiModule;
  home: string;
  context: HostContext;
  newId: () => string;
  importModule?: ModuleImporter;
  promptOptions?: PromptOptions;
}

/** Outcome of a generation: the recorded attempt, its folder, and the module if it loaded. */
export interface GenerateResult {
  attempt: Attempt;
  dir: string;
  module?: AnyPluginModule;
}

/** A short, display-friendly name derived from the instruction. */
function nameFromInstruction(instruction: string): string {
  return instruction.trim().slice(0, 40) || 'untitled';
}

/** Generate one plugin from a prompt, persist it, attempt to load it, and record the attempt. */
export async function generatePlugin(instruction: string, deps: GenerateDeps): Promise<GenerateResult> {
  const id = deps.newId();
  const name = nameFromInstruction(instruction);
  const source = await generatePluginSource(buildGenerationPrompt(instruction, deps.context, deps.promptOptions), deps.ai);
  const dir = writeGeneratedPlugin(deps.home, { id, name, source });

  try {
    const module = await loadDiskPlugin(dir, { importModule: deps.importModule ?? nativeImport });
    const attempt: Attempt = { id, prompt: instruction, name: module.manifest.name || name, status: 'ok' };
    recordAttempt(deps.home, attempt);
    return { attempt, dir, module };
  } catch (error) {
    const attempt: Attempt = { id, prompt: instruction, name, status: 'failed', error: error instanceof Error ? error.message : String(error) };
    recordAttempt(deps.home, attempt);
    return { attempt, dir };
  }
}
