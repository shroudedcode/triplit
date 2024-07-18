import path from 'path';
import fs, { existsSync, readFileSync } from 'fs';
import esbuild from 'esbuild';

export function createDirIfNotExists(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const CWD = process.cwd();

export const TRIPLIT_DIR = path.join(CWD, 'triplit');
export function getTriplitDir() {
  createDirIfNotExists(TRIPLIT_DIR);
  return TRIPLIT_DIR;
}

export const MIGRATIONS_DIR = path.join(TRIPLIT_DIR, 'migrations');

export const SEED_DIR = path.join(TRIPLIT_DIR, 'seeds');

export function getMigrationsDir() {
  createDirIfNotExists(MIGRATIONS_DIR);
  return MIGRATIONS_DIR;
}

export function getSeedsDir() {
  createDirIfNotExists(SEED_DIR);
  return SEED_DIR;
}

// Contains data for the local db if in filesystem (ie sqlite)
export const DATA_DIR = path.join(TRIPLIT_DIR, '.data');
export function getDataDir() {
  createDirIfNotExists(DATA_DIR);
  return DATA_DIR;
}

export function bundleTsFile(filename: string, outpath: string) {
  const packagePath = findClosestPackageDirectory(process.cwd());

  const isModule = isPackageEsm(packagePath);
  const potentialTsconfigPath = path.join(packagePath, 'tsconfig.json');

  const tsconfigPath = fs.existsSync(potentialTsconfigPath)
    ? potentialTsconfigPath
    : undefined;

  esbuild.buildSync({
    entryPoints: [filename],
    outfile: outpath,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: isModule ? 'esm' : 'cjs',
    tsconfig: tsconfigPath,
  });
}

function findClosestPackageDirectory(startPath: string) {
  let dir = startPath;
  while (dir !== path.parse(dir).root) {
    const packageJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function getModuleType(packagePath: string | null) {
  if (!packagePath) {
    // default to commonjs
    return 'commonjs';
  }

  const packageJsonPath = path.join(packagePath, 'package.json');
  const packageData = fs.readFileSync(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(packageData);

  return packageJson.type === 'module' ? 'esm' : 'commonjs';
}

function isPackageEsm(packagePath: string | null) {
  return getModuleType(packagePath) === 'esm';
}

// Within a process, break the import cache in case of file changes
// I'd rather not do this, but had issues with tests not picking up changes
export async function importFresh(modulePath: string) {
  const cacheBustingModulePath = `${modulePath}?update=${Date.now()}`;
  return await import(cacheBustingModulePath);
}

export async function loadTsModule(filepath: string) {
  if (!filepath.endsWith('.ts')) throw new Error('File must be a .ts file');
  const absolutePath = path.resolve(filepath);
  const dir = path.dirname(absolutePath);
  const filename = path.basename(absolutePath, '.ts');
  const tmpDir = path.join(dir, 'tmp');
  const ext = isCallerESM() ? 'js' : 'mjs';
  const transpiledJsPath = path.join(tmpDir, `_${filename}.${ext}`);
  try {
    if (!fs.existsSync(absolutePath)) return undefined;
    fs.mkdirSync(path.dirname(transpiledJsPath), { recursive: true });
    await bundleTsFile(absolutePath, transpiledJsPath);
    const result = await importFresh('file:///' + transpiledJsPath);
    return result;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function evalJSString(
  source: string,
  options: { tmpFile?: string } = {},
) {
  let transpiledJsPath = options.tmpFile;
  try {
    // If no tmpFile is provided, create a temporary file and cleanup after
    if (!options.tmpFile) {
      const cwd = process.cwd();
      const tmpDir = path.join(cwd, 'tmp');
      transpiledJsPath = path.join(tmpDir, `_temp.js`);
    }
    fs.mkdirSync(path.dirname(transpiledJsPath), { recursive: true });
    fs.writeFileSync(transpiledJsPath, source, 'utf8');

    return await importFresh('file:///' + transpiledJsPath);
  } finally {
    if (!options.tmpFile) {
      fs.rmSync(transpiledJsPath, { recursive: true, force: true });
    }
  }
}

export function inferProjectName() {
  let name = path.basename(CWD);
  const packageJsonPath = CWD + '/package.json';
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.name) {
      name = packageJson.name;
    }
  }
  return name;
}
