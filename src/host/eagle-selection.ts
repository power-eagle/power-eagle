import type { HostSelectionAdapter, HostSelectionRequest } from '../sdui/runtime/selection-adapter';

interface EagleDialogHost {
  showOpenDialog(options: {
    title?: string;
    defaultPath?: string;
    buttonLabel?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
  }): Promise<{ canceled: boolean; filePaths: string[] }>;
}

function abortError(): DOMException {
  return new DOMException('File selection was aborted', 'AbortError');
}

export function createEagleSelectionAdapter(dialog: EagleDialogHost): HostSelectionAdapter {
  return async (request: HostSelectionRequest) => {
    if (request.signal.aborted) throw abortError();
    const properties: Array<'openFile' | 'openDirectory' | 'multiSelections'> = [
      request.selectionType === 'directory' ? 'openDirectory' : 'openFile',
    ];
    if (request.multiple) properties.push('multiSelections');
    const result = await dialog.showOpenDialog({
      ...(request.title ? { title: request.title } : {}),
      ...(request.initialPath ? { defaultPath: request.initialPath } : {}),
      ...(request.buttonLabel ? { buttonLabel: request.buttonLabel } : {}),
      ...(request.filters?.length ? { filters: request.filters } : {}),
      properties,
    });
    if (request.signal.aborted) throw abortError();
    return result.canceled ? null : result.filePaths;
  };
}

export function eagleSelectionAdapter(): HostSelectionAdapter | undefined {
  const host = globalThis as unknown as { eagle?: { dialog?: Partial<EagleDialogHost> } };
  const select = host.eagle?.dialog?.showOpenDialog;
  if (typeof select !== 'function') return undefined;
  return createEagleSelectionAdapter({ showOpenDialog: options => select.call(host.eagle!.dialog, options) });
}
