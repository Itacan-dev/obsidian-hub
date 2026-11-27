import { appendFile, copyFile, cp, mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { samplePdf } from '../sample-pdf.mjs';

// The checkout's example can also be opened interactively. Seed only the named
// sample documents so local preferences, recovery files and added papers stay local.
export async function prepareLibraries(tmp) {
  const library = path.join(tmp, 'Field Library');
  const freshLibrary = path.join(tmp, 'Fresh library');
  const project = 'Projects/Forest survey';
  const papers = 'Resources/Research/Papers';
  const fieldNote = project + '/Field notes.md';
  await mkdir(path.join(library, project), { recursive: true });
  await mkdir(path.join(library, papers), { recursive: true });
  await mkdir(freshLibrary);
  for (const file of [fieldNote, project + '/canopy.jpg', papers + '/Sampling protocol.md', papers + '/Hello.md']) {
    await copyFile(path.join('examples/Field Library', file), path.join(library, file));
  }
  await writeFile(path.join(library, 'itacan-library.json'), JSON.stringify({ format: 'itacan-library', version: 1 }));
  await appendFile(path.join(library, fieldNote),
    '\n[Linked method](<../../Resources/Research/Papers/Sampling protocol.md#Method>)\n' + '\nReading position fixture.\n'.repeat(55));
  await writeFile(path.join(library, project, 'Companion.md'), 'Second tab');
  await writeFile(path.join(library, project, 'Sampling.pdf'), samplePdf());
  await writeFile(path.join(library, project, 'Session.md'), '# Lab\n\nLocal equation $x^2 + y^2$.\n\n![Canopy](canopy.jpg)\n');

  const alternate = 'projects/FOREST SURVEY/field notes.md';
  const testCaseAliases = process.platform === 'win32' &&
    await realpath(path.join(library, alternate)).catch(() => null) === await realpath(path.join(library, fieldNote));
  if (testCaseAliases) {
    await writeFile(path.join(library, project, 'Links.md'), '[Alternate spelling](<../../projects/FOREST SURVEY/field notes.md>)');
    const layout = {
      active: 0,
      panes: [
        { tabs: [alternate, fieldNote], file: alternate, edit: false },
        { tabs: [alternate], file: alternate, edit: true }
      ]
    };
    await writeFile(path.join(library, 'itacan-work.json'), JSON.stringify({
      version: 1, tasks: [], inbox: [], plan: null, history: [], lastLayout: null,
      presets: [{ name: 'Legacy casing', layout }]
    }));
  }
  const appCopy = path.join(tmp, 'app');
  await cp('build/app', appCopy, { recursive: true });
  return { tmp, library, freshLibrary, appCopy, fieldNote, testCaseAliases };
}
