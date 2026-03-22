import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Package metadata for Discord API requests (User-Agent must identify the integration).
 * Values come from the project root `package.json` so forks can change name, version,
 * and repository URLs in one place.
 */
type PackageJson = {
  name?: string;
  version?: string;
  homepage?: string;
  repository?: string | { url?: string; type?: string };
};

function readPackageJson(): PackageJson {
  const dir = dirname(fileURLToPath(import.meta.url));
  const path = join(dir, '..', 'package.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as PackageJson;
}

let cachedPkg: PackageJson | undefined;

function getPackageJson(): PackageJson {
  if (cachedPkg == null) cachedPkg = readPackageJson();
  return cachedPkg;
}

function normalizeRepoUrl(raw: string | undefined): string | undefined {
  if (raw == null || raw === '') return undefined;
  let u = raw.trim().replace(/^git\+/, '');
  if (u.startsWith('git@github.com:')) {
    u = `https://github.com/${u.slice('git@github.com:'.length)}`;
  }
  u = u.replace(/\.git$/i, '');
  return u;
}

function projectUrl(pkg: PackageJson): string {
  const fromHome = pkg.homepage?.replace(/#.*$/, '').trim();
  if (fromHome) return fromHome;

  const r = pkg.repository;
  const raw = typeof r === 'string' ? r : r?.url;
  const normalized = normalizeRepoUrl(raw);
  if (normalized) return normalized;

  return 'https://example.com';
}

let cachedUserAgent: string | undefined;

/** Discord-recommended form: `Name (url, version)`. */
export function discordUserAgent(): string {
  if (cachedUserAgent != null) return cachedUserAgent;
  const pkg = getPackageJson();
  const name = (pkg.name ?? 'discord-bot').replace(/[^\w\-./]/g, '-');
  const version = pkg.version ?? '0.0.0';
  const url = projectUrl(pkg);
  cachedUserAgent = `${name} (${url}, ${version})`;
  return cachedUserAgent;
}

/** Short label for Gateway IDENTIFY `properties.browser` / `device` (from `package.json` `name`). */
export function gatewayClientLabel(): string {
  const pkg = getPackageJson();
  const raw = (pkg.name ?? 'discord-bot').replace(/[^\w\-./]/g, '-');
  return raw.slice(0, 64);
}
