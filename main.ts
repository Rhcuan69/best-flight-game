// Kestrel Run — the entrypoint (Node 22, standard library only).
//
// The game is plain static files under game/ (index.html plus its ES modules
// and stylesheet, no libraries and no network requests), and this program
// hands it in: it copies game/ and screenshots/ from beside this file into
// the output directory and writes output/dossier.json with buildDossier from
// the vendored make.fun library, so the judge reads exactly what is shipped.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program writes the same bytes on every run: it copies files in a fixed
// order, never stamps a time into anything, and the dossier is a pure
// function of the copied files.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own caps, so a build that would be refused fails loudly here
// instead of silently shipping an entry the scorer rejects.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(source, target) {
  if (!existsSync(source)) {
    throw new Error(`entrypoint: missing ${source}`);
  }
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}

// Start from a clean output directory so a stale file from an earlier build
// can never leak into this one, and the two grader runs agree byte for byte.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const gameDir = join(repoRoot, 'game');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('entrypoint: game/index.html is missing — nothing to hand in');
}
copyTree(gameDir, join(outDir, 'game'));
copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

const dossier = buildDossier(outDir, DOSSIER_CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

// A short, deterministic summary on stdout: the same files always print the
// same line, so the two grader runs stay byte-identical in /output.
console.log(
  `kestrel-run: wrote ${outDir} (dossier ${dossier.length} bytes)`,
);
