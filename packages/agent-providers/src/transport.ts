import { checkBridgeVersion } from './bridge-version.js';
export type CliProvider = 'claude' | 'codex';
export interface GenerationInput { prompt: string; model?: string; effort?: string }
export interface AgentModel { id: string; label: string; isDefault?: boolean; efforts: string[]; defaultEffort?: string }
export interface CliOptions { hostRequire?: (id: string) => unknown; executable?: string }
export interface ProviderAdapter { available(): Promise<boolean>; discover(): Promise<AgentModel[]>; generate(input: GenerationInput): Promise<string> }
export function providerFailure(provider: CliProvider, diagnostic: string): Error {
  const label = provider === 'codex' ? 'Codex' : 'Claude';
  if (/auth|unauthorized|sign.?in|log.?in|credential|401/i.test(diagnostic)) return new Error(`${label} authentication failed. Sign in with ${provider === 'codex' ? 'codex login' : 'claude auth login'}, then retry.`);
  if (/quota|credit|rate.limit|429/i.test(diagnostic)) return new Error(`${label} usage limit reached. Check your provider account and retry later.`);
  if (/model|effort/i.test(diagnostic)) return new Error(`${label} rejected the model or effort. Check the model and effort, then refresh models.`);
  return new Error(`${label} request failed. Check the CLI connection and account, then retry.`);
}

/** No Node imports are evaluated until an operation is called. Supply createRequire(import.meta.url) in Node ESM. */
export function createCliTransport(provider: CliProvider, options: CliOptions) {
  const host = () => {
    if (!options.hostRequire) throw new Error('CLI providers require a Node module loader. Supply hostRequire (createRequire in Node ESM).');
    return { fs: options.hostRequire('node:fs') as typeof import('node:fs'), path: options.hostRequire('node:path') as typeof import('node:path'),
      os: options.hostRequire('node:os') as typeof import('node:os'), process: options.hostRequire('node:process') as typeof import('node:process'),
      cp: options.hostRequire('node:child_process') as typeof import('node:child_process') };
  };
  const executable = (): string => {
    const { fs, path, os, process } = host();
    const override = options.executable;
    if (override) return override;
    const binary = process.platform === 'win32' ? `${provider}.exe` : provider;
    const directories = (process.env.PATH ?? process.env.Path ?? '').split(path.delimiter);
    directories.push(path.join(os.homedir(), '.local', 'bin'), path.join(os.homedir(), 'scoop', 'apps', provider === 'claude' ? 'claude-code' : 'codex', 'current'));
    for (const directory of directories) {
      const candidate = path.join(directory, binary);
      if (!fs.existsSync(candidate)) continue;
      // Scoop launchers are separate processes. Resolve their declared native target so kill owns the CLI.
      const shim = path.join(directory, `${provider}.shim`);
      if (process.platform === 'win32' && fs.existsSync(shim)) {
        const target = /^path\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(shim, 'utf8'))?.[1];
        if (target && fs.existsSync(target)) return target;
      }
      return candidate;
    }
    if (provider === 'codex' && process.platform === 'win32') {
      const extensions = path.join(os.homedir(), '.vscode', 'extensions');
      if (fs.existsSync(extensions)) {
        const candidates = fs.readdirSync(extensions).filter(name => name.startsWith('openai.chatgpt-'))
          .map(name => path.join(extensions, name, 'bin', process.arch === 'arm64' ? 'windows-aarch64' : 'windows-x86_64', 'codex.exe'))
          .filter(file => fs.existsSync(file)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        if (candidates[0]) return candidates[0];
      }
    }
    return binary;
  };
  type Exchange = (line: string, send: (value: unknown) => void, finish: (value: unknown) => void) => void;
  const run = (args: string[], directory: string, input: string | unknown, timeout: number, exchange?: Exchange): Promise<unknown> => {
    const { cp, process } = host();
    return new Promise((resolve, reject) => {
      const child = cp.spawn(executable(), args, { cwd: directory, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, DISABLE_TELEMETRY: '1', DISABLE_ERROR_REPORTING: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_SKIP_PROMPT_HISTORY: '1' } });
      let output = '', buffer = '', diagnostic = '', bytes = 0, settled = false, result: unknown, problem: Error | undefined;
      // Resolve only after close: cleanup must not race a still-running child holding temporary files.
      const stop = (error?: Error, value?: unknown) => {
        if (settled) return;
        settled = true; problem = error; result = value; clearTimeout(timer);
        // Teardown cannot replace the original error, and cleanup waits for close.
        try { child.stdin.end(); } catch { /* A broken pipe is already terminal. */ }
        child.kill('SIGKILL');
      };
      const timer = setTimeout(() => stop(new Error(`${provider} request timed out. Retry when the provider is available.`)), timeout);
      const send = (value: unknown) => { if (!settled) child.stdin.write(`${JSON.stringify(value)}\n`); };
      child.on('error', () => stop(new Error(`${provider} CLI unavailable. Check installation and reconnect.`)));
      child.stdin.on('error', () => stop(new Error(`${provider} connection closed before the request could be sent.`)));
      child.stderr.setEncoding('utf8'); child.stdout.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => { diagnostic = (diagnostic + chunk).slice(-16_000); });
      child.stdout.on('data', (chunk: string) => {
        if (settled) return;
        bytes += new TextEncoder().encode(chunk).length;
        if (bytes > 4_000_000) return stop(new Error(`${provider} output exceeded the size limit.`));
        if (!exchange) { output += chunk; return; }
        buffer += chunk;
        let end: number;
        while ((end = buffer.indexOf('\n')) >= 0 && !settled) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
          if (line.trim()) { try { exchange(line, send, value => stop(undefined, value)); } catch { stop(new Error(`${provider} returned an invalid model catalog.`)); } }
        }
      });
      child.on('close', code => {
        clearTimeout(timer);
        if (problem) reject(problem);
        else if (settled) resolve(result);
        else if (code !== 0) reject(providerFailure(provider, diagnostic + output));
        else if (exchange) reject(new Error(`${provider} closed before returning its model catalog.`));
        else resolve(output);
        settled = true;
      });
      try { if (exchange) send(input); else child.stdin.end(input as string); }
      catch { stop(new Error(`${provider} connection closed before the request could be sent.`)); }
    });
  };
  const temporary = async <T,>(operation: (directory: string) => Promise<T>): Promise<T> => {
    const { fs, path, os } = host();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-cli-'));
    const resolved = path.resolve(directory);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('agent-cli-')) throw new Error('Invalid Agent temporary directory');
    const ownedPath = fs.realpathSync(resolved);
    const cleanup = () => {
      if (fs.lstatSync(resolved).isSymbolicLink() || fs.realpathSync(resolved) !== ownedPath) throw new Error('Agent temporary directory ownership changed; cleanup refused.');
      fs.rmSync(resolved, { recursive: true, force: true });
    };
    try { return await operation(directory); }
    finally { cleanup(); }
  };

  const probe = () => run(['--version'], host().os.tmpdir(), '', 5_000);
  const validateVersion = (output: unknown) => {
    const label = provider === 'claude' ? 'Claude Code' : 'Codex CLI';
    const pattern = provider === 'claude' ? /^(\S+) \(Claude Code\)$/ : /^codex-cli (\S+)$/;
    const version = pattern.exec(String(output).trim())?.[1] ?? '';
    const major = provider === 'claude' ? 2 : 0;
    const issue = checkBridgeVersion(version, { major });
    if (issue === 'invalid') throw new Error(`${label} returned an unrecognized version. Check the selected executable and its --version output.`);
    if (issue) throw new Error(`${label} ${version} needs bridge compatibility review. This bridge supports major ${major}; select a supported executable or update the bridge.`);
  };
  return { run, temporary, checkVersion: async () => validateVersion(await probe()), available: async () => {
    host();
    let output: unknown;
    try { output = await probe(); } catch { return false; }
    validateVersion(output); return true;
  } };
}
