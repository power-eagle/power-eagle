export interface FileSelectionFilter {
  name: string;
  extensions: string[];
}

export interface FileSelectionOptions {
  selectionType: 'file' | 'directory';
  multiple: boolean;
  title?: string;
  initialPath?: string;
  buttonLabel?: string;
  filters?: FileSelectionFilter[];
}

export interface HostSelectionRequest extends FileSelectionOptions {
  signal: AbortSignal;
}

/** A null result means the user cancelled without committing a new value. */
export type HostSelectionAdapter = (request: HostSelectionRequest) => Promise<string[] | null>;
export type RuntimeSelectionAdapter = (request: FileSelectionOptions) => Promise<string[] | null>;
