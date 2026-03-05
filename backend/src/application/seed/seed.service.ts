import { createHash } from 'crypto';
import { readdirSync, statSync, existsSync } from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

export interface SeedItem {
  id: string;
  name: string;
  relativePath: string;
  /** Hangi root klasöründen (örn. prisma/seed, scripts) — çalıştırma path'i için */
  sourceDir: string;
}

/**
 * Seed root: taranacak klasör ve hangi dosyaların seed sayılacağı.
 */
export interface SeedRoot {
  /** baseDir'e göre relative klasör (örn. prisma/seed, scripts) */
  dir: string;
  /** Dosya adı bu predicate'ı geçiyorsa seed listesine eklenir */
  include: (filename: string) => boolean;
}

/** Varsayılan seed kökleri: prisma/seed (*.seed.ts) + scripts (*.ts) */
export const DEFAULT_SEED_ROOTS: SeedRoot[] = [
  { dir: 'prisma/seed', include: (name) => name.endsWith('.seed.ts') },
  { dir: 'scripts', include: (name) => name.endsWith('.ts') },
];

/** Uygulama genelinde kullanılacak seed root listesi (override için) */
let configuredRoots: SeedRoot[] = DEFAULT_SEED_ROOTS;

export function setSeedRoots(roots: SeedRoot[]): void {
  configuredRoots = roots.length > 0 ? roots : DEFAULT_SEED_ROOTS;
}

export function getSeedRoots(): SeedRoot[] {
  return configuredRoots;
}

/**
 * Seed dosya adından veya (sourceDir + relativePath) birleşiminden SHA-256 id üretir.
 */
export function seedNameToId(nameOrPath: string): string {
  return createHash('sha256').update(nameOrPath).digest('hex');
}

/**
 * Tek bir root klasörünü tarar.
 */
function walkRoot(
  baseDir: string,
  root: SeedRoot,
  out: SeedItem[]
): void {
  const rootPath = path.resolve(baseDir, root.dir);
  if (!existsSync(rootPath)) return;

  function walk(dir: string, base: string): void {
    let entries: Array<{ name: string; path: string }>;
    try {
      entries = readdirSync(dir, { withFileTypes: true }).map((e) => ({
        name: e.name,
        path: path.join(dir, e.name),
      }));
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = path.relative(base, entry.path).replace(/\\/g, '/');
      if (statSync(entry.path).isDirectory()) {
        walk(entry.path, base);
      } else if (root.include(entry.name)) {
        out.push({
          id: seedNameToId(root.dir + '/' + rel),
          name: entry.name,
          relativePath: rel,
          sourceDir: root.dir,
        });
      }
    }
  }

  walk(rootPath, rootPath);
}

/**
 * Tüm tanımlı seed root'ları tarayıp birleşik seed listesi döndürür.
 * id = hash(sourceDir + '/' + relativePath) ile root'lar arasında tekil kalır.
 */
export function listSeeds(baseDir: string, roots?: SeedRoot[]): SeedItem[] {
  const useRoots = roots ?? configuredRoots;
  const items: SeedItem[] = [];

  for (const root of useRoots) {
    walkRoot(baseDir, root, items);
  }

  items.sort((a, b) => (a.sourceDir + '/' + a.relativePath).localeCompare(b.sourceDir + '/' + b.relativePath));
  return items;
}

export type SeedLogChunk = { type: 'stdout' | 'stderr'; line: string };
export type SeedLogWriter = (chunk: SeedLogChunk) => void;

/**
 * Ortak process çalıştırma: stdout/stderr'ı anında onLog'a yazar.
 */
function runProcess(
  cwd: string,
  command: string,
  args: string[],
  onLog: SeedLogWriter
): Promise<{ exitCode: number }> {
  return new Promise((resolve) => {
    const proc: ChildProcess = spawn(command, args, {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    const write = (type: 'stdout' | 'stderr', data: Buffer | string) => {
      const text = (typeof data === 'string' ? data : data.toString()).replace(/\r\n/g, '\n');
      for (const line of text.split('\n')) {
        if (line.trim().length > 0) onLog({ type, line });
      }
    };

    proc.stdout?.on('data', (d) => write('stdout', d));
    proc.stderr?.on('data', (d) => write('stderr', d));

    proc.on('close', (code, signal) => {
      const exitCode = code ?? (signal ? 1 : 0);
      resolve({ exitCode });
    });

    proc.on('error', (err) => {
      onLog({ type: 'stderr', line: `Process error: ${err.message}` });
      resolve({ exitCode: 1 });
    });
  });
}

/**
 * Tüm seed'leri çalıştırır (npx prisma db seed).
 */
export function runSeed(
  cwd: string,
  onLog: SeedLogWriter
): Promise<{ exitCode: number }> {
  return runProcess(cwd, 'npx', ['prisma', 'db', 'seed'], onLog);
}

/**
 * Tek bir seed dosyasını çalıştırır (npx ts-node <sourceDir>/<relativePath>).
 * seedId: listSeeds ile dönen id (hash).
 */
export function runSingleSeed(
  cwd: string,
  seedId: string,
  onLog: SeedLogWriter
): Promise<{ exitCode: number }> {
  const seeds = listSeeds(cwd);
  const seed = seeds.find((s) => s.id === seedId);
  if (!seed) {
    onLog({ type: 'stderr', line: `Seed not found: ${seedId}` });
    return Promise.resolve({ exitCode: 1 });
  }
  const seedFilePath = path.join(seed.sourceDir, seed.relativePath);
  return runProcess(cwd, 'npx', ['ts-node', '--transpile-only', seedFilePath], onLog);
}
