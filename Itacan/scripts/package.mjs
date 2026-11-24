import { packager } from '@electron/packager';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';

const platform = process.argv[2] || process.platform;
const arch = process.argv[3] || process.arch;
if (!['darwin', 'win32'].includes(platform) || !['arm64', 'x64'].includes(arch)) {
  throw Error('Use npm run package -- darwin arm64 or npm run package -- win32 x64.');
}
if (platform === 'darwin' && process.platform !== 'darwin') throw Error('Build the Mac package on macOS.');

const electron = JSON.parse(await readFile('node_modules/electron/package.json', 'utf8'));
const checksums = JSON.parse(await readFile('node_modules/electron/checksums.json', 'utf8'));
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const release = path.resolve('release');
const archive = path.join(release, 'Itacan-' + version + '-' + platform + '-' + arch + '.zip');
// Keep the signing workspace on the local disk. Cloud-provider metadata can invalidate a Mac bundle.
const stage = await mkdtemp(path.join(tmpdir(), 'itacan-package-'));
try {
  await mkdir(release, { recursive: true });
  const [output] = await packager({
    dir: 'build/app', out: stage, name: 'Itacan', appBundleId: 'local.itacan.desktop',
    platform, arch, electronVersion: electron.version, prune: false, asar: true,
    download: { cacheRoot: process.env.ELECTRON_CACHE, checksums }
  });
  if (platform === 'darwin') {
    const bundle = path.join(output, 'Itacan.app');
    for (const file of ['LICENSE', 'LICENSES.chromium.html']) {
      await copyFile(path.join(output, file), path.join(bundle, 'Contents/Resources', file));
    }
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'inherit' });
    execFileSync('codesign', ['--verify', '--deep', '--strict', bundle], { stdio: 'inherit' });
    execFileSync('ditto', ['-c', '-k', '--norsrc', '--noextattr', '--keepParent', bundle, archive]);
  } else {
    execFileSync('tar', ['-a', '-cf', archive, '-C', stage, path.basename(output)]);
  }
  console.log(archive);
} finally {
  await rm(stage, { recursive: true, force: true });
}
