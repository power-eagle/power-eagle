/**
 * The fs-bound install layer. A repo is added as a local git-clone mirror under
 * repos/ (scoop/claude style); a plugin is installed by copying its whole
 * directory into plugins/<id> and recording it in installed.json. Repo
 * classification is static (parse.ts) and never executes plugin code.
 */

import { cloneGitRepository, deriveBucketDirectoryName } from '../../app/utils/git';
import { classifyRepo, parseManifest } from '../registry/parse';
import {
  joinPath,
  homeDir,
  pathExists,
  ensureDir,
  listDir,
  readTextFile,
  writeTextFile,
  removeDir,
  copyDir,
} from './fs-bridge';

/** The on-disk layout of a Power Eagle home. */
export interface StorePaths {
  root: string;
  reposDir: string;
  pluginsDir: string;
  installedFile: string;
}

/** The outcome of adding a repository mirror. */
export interface AddedRepo {
  name: string;
  path: string;
  isPlugin: boolean;
  isMarketplace: boolean;
}

/** One recorded installation in installed.json. */
export interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  source: string;
  path: string;
}

/** Resolve the store layout from a base dir (defaults to ~/.powereagle). */
export function resolveStorePaths(baseDir?: string): StorePaths {
  const root = baseDir ?? joinPath(homeDir(), '.powereagle');
  return {
    root,
    reposDir: joinPath(root, 'repos'),
    pluginsDir: joinPath(root, 'plugins'),
    installedFile: joinPath(root, 'installed.json'),
  };
}

/** Clone a repository into repos/<name> and classify it; reject a non-repo. */
export function addRepo(url: string, baseDir?: string): AddedRepo {
  const paths = resolveStorePaths(baseDir);
  const name = deriveBucketDirectoryName(url);
  const target = joinPath(paths.reposDir, name);

  ensureDir(paths.reposDir);
  const clone = cloneGitRepository(url, target);
  if (!clone.ok) {
    throw new Error(`git clone failed: ${clone.stderr}`);
  }

  try {
    const classification = classifyRepo(listDir(target));
    return { name, path: target, ...classification };
  } catch (err) {
    removeDir(target);
    throw err;
  }
}

/** Copy an added plugin repo into plugins/<id> and record it in installed.json. */
export function installPlugin(repoName: string, baseDir?: string): InstalledPlugin {
  const paths = resolveStorePaths(baseDir);
  const repoDir = joinPath(paths.reposDir, repoName);
  const manifest = parseManifest(JSON.parse(readTextFile(joinPath(repoDir, 'manifest.json'))));
  const destination = joinPath(paths.pluginsDir, manifest.id);

  ensureDir(paths.pluginsDir);
  if (pathExists(destination)) {
    removeDir(destination);
  }
  copyDir(repoDir, destination);

  const entry: InstalledPlugin = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    source: repoName,
    path: destination,
  };
  recordInstall(paths.installedFile, entry);
  return entry;
}

/** Append or replace one plugin's entry in installed.json. */
function recordInstall(installedFile: string, entry: InstalledPlugin): void {
  const existing: InstalledPlugin[] = pathExists(installedFile)
    ? JSON.parse(readTextFile(installedFile))
    : [];
  const next = existing.filter((item) => item.id !== entry.id);
  next.push(entry);
  writeTextFile(installedFile, JSON.stringify(next, null, 2));
}
