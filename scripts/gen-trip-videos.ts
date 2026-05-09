// One-off script to generate two extra Niv "trip" videos for the RUN-NIV
// mini-game splash. Mirrors the pattern from scripts/gen-videos.ts:
// same model + aspect candidates, same polling, atomic manifest update.
import { GoogleGenAI } from '@google/genai';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY missing');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public/niv-videos');
const MEDIA_DIR = path.join(ROOT, 'niv_media');
const MANIFEST = path.join(ROOT, 'lib/niv-videos.ts');

interface VideoSpec {
  slug: string;
  // Ranked list of candidate source photos. Picks the first one that exists
  // and is large enough to be expressive (> 50KB). This satisfies the
  // "read 2-3 candidate photos and pick the most expressive one" brief.
  sourceCandidates: string[];
  prompt: string;
  role: string;
  caption: string;
}

const SPECS: VideoSpec[] = [
  {
    slug: 'tripping',
    // High-detail candidate photos not used by existing 5 videos.
    sourceCandidates: [
      'WhatsApp Image 2026-05-09 at 21.28.45.jpeg',
      'WhatsApp Image 2026-05-09 at 21.26.40.jpeg',
      'WhatsApp Image 2026-05-09 at 21.16.52.jpeg',
    ],
    role: 'trip',
    caption: 'Niv has tripped over nothing.',
    prompt:
      'The bearded man is mid-stumble, arms flailing, mouth open in cartoon shock as he trips on absolutely nothing, exaggerated comedic motion, 8 seconds, side view',
  },
  {
    slug: 'falling',
    sourceCandidates: [
      'WhatsApp Image 2026-05-09 at 21.17.13.jpeg',
      'WhatsApp Image 2026-05-09 at 21.25.54.jpeg',
      'WhatsApp Image 2026-05-09 at 21.26.40.jpeg',
    ],
    role: 'trip',
    caption: 'Niv ate the pavement.',
    prompt:
      "The bearded man is doing a slow-motion theatrical faceplant onto an invisible obstacle, arms outstretched, eyes wide open in mock horror, then settles flat on ground with a 'why me' expression, 8 seconds",
  },
];

const MODEL_CANDIDATES = [
  'veo-3.0-fast-generate-001',
  'veo-3.0-generate-001',
  'veo-2.0-generate-001',
];

const ASPECT_CANDIDATES: (string | null)[] = ['9:16', '16:9', null];

const ai = new GoogleGenAI({ apiKey });

async function pickSource(spec: VideoSpec): Promise<{ file: string; bytes: Buffer } | null> {
  for (const candidate of spec.sourceCandidates) {
    const p = path.join(MEDIA_DIR, candidate);
    try {
      const stat = await fs.stat(p);
      if (stat.size < 50_000) {
        console.log(`    [${spec.slug}] candidate too small (${stat.size}B): ${candidate}`);
        continue;
      }
      const bytes = await fs.readFile(p);
      console.log(`    [${spec.slug}] picked source (${stat.size}B): ${candidate}`);
      return { file: candidate, bytes };
    } catch {
      console.log(`    [${spec.slug}] candidate missing: ${candidate}`);
    }
  }
  return null;
}

async function startGeneration(spec: VideoSpec, imageBytes: Buffer) {
  const errors: string[] = [];
  for (const model of MODEL_CANDIDATES) {
    for (const aspect of ASPECT_CANDIDATES) {
      for (const includePerson of [true, false]) {
        const config: Record<string, unknown> = { numberOfVideos: 1 };
        if (aspect) config.aspectRatio = aspect;
        if (includePerson) config.personGeneration = 'allow_adult';
        try {
          const op = await ai.models.generateVideos({
            model,
            prompt: spec.prompt,
            image: {
              imageBytes: imageBytes.toString('base64'),
              mimeType: 'image/jpeg',
            },
            config,
          });
          console.log(
            `    [${spec.slug}] started with model=${model} aspect=${aspect ?? 'none'} person=${includePerson}`,
          );
          return op;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${model}/${aspect ?? 'none'}/person=${includePerson}: ${msg}`);
          if (/quota|rate|permission|api key|auth/i.test(msg)) {
            console.warn(`    [${spec.slug}] hard error: ${msg}`);
            throw err;
          }
        }
      }
    }
  }
  throw new Error(
    `All model/config combos failed for ${spec.slug}:\n${errors.join('\n')}`,
  );
}

interface ExistingVideo {
  slug: string;
  src: string;
  role: string;
  caption: string;
}

interface ExistingManifest {
  version: 1;
  generatedAt: string;
  videos: ExistingVideo[];
}

async function loadExistingManifest(): Promise<ExistingManifest | null> {
  // Read the existing TS file as text and extract the JSON object literal.
  // Safer than require() under tsx, and avoids bundler/path resolution issues.
  try {
    const src = await fs.readFile(MANIFEST, 'utf8');
    const match = src.match(/NIV_VIDEOS[^=]*=\s*(\{[\s\S]*?\})\s*;\s*$/m);
    if (!match) {
      console.warn('  manifest regex did not match');
      return null;
    }
    const parsed = JSON.parse(match[1]) as ExistingManifest;
    return parsed;
  } catch (err) {
    console.warn(`  could not load existing manifest: ${err}`);
    return null;
  }
}

async function writeManifestAtomic(manifest: ExistingManifest) {
  const ts = `// AUTO-GENERATED by scripts/gen-videos.ts
export interface NivVideo {
  slug: string;
  src: string;
  role: string;
  caption: string;
}
interface NivVideosManifest {
  version: 1;
  generatedAt: string;
  videos: NivVideo[];
}
export const NIV_VIDEOS: NivVideosManifest = ${JSON.stringify(manifest, null, 2)};
`;
  const tmp = `${MANIFEST}.tmp.${process.pid}`;
  await fs.writeFile(tmp, ts, 'utf8');
  await fs.rename(tmp, MANIFEST);
}

async function generateOne(spec: VideoSpec): Promise<ExistingVideo | null> {
  const outPath = path.join(OUT_DIR, `${spec.slug}.mp4`);
  try {
    const stat = await fs.stat(outPath);
    if (stat.size > 1000) {
      console.log(`  cached: ${spec.slug}`);
      return { slug: spec.slug, src: `/niv-videos/${spec.slug}.mp4`, role: spec.role, caption: spec.caption };
    }
  } catch {
    // not cached
  }

  const picked = await pickSource(spec);
  if (!picked) {
    console.warn(`  skipping ${spec.slug}: no usable source photo`);
    return null;
  }
  console.log(`  starting: ${spec.slug} (source: ${picked.file})`);

  let op;
  try {
    op = await startGeneration(spec, picked.bytes);
  } catch (err) {
    console.warn(`  failed to start ${spec.slug}: ${err}`);
    return null;
  }

  let polls = 0;
  while (!op.done && polls < 90) {
    await new Promise((r) => setTimeout(r, 10000));
    try {
      op = await ai.operations.getVideosOperation({ operation: op });
    } catch (err) {
      console.warn(`    poll error for ${spec.slug}: ${err}`);
    }
    polls++;
    if (polls % 3 === 0) console.log(`    ${spec.slug} polling ${polls}...`);
  }
  if (!op.done) {
    console.warn(`  TIMEOUT ${spec.slug}`);
    return null;
  }

  const file = op.response?.generatedVideos?.[0]?.video;
  if (!file) {
    console.warn(
      `  no video returned for ${spec.slug}: ${JSON.stringify(op.response).slice(0, 500)}`,
    );
    return null;
  }

  try {
    await ai.files.download({ file, downloadPath: outPath });
    console.log(`  done: ${spec.slug} -> ${outPath}`);
    return { slug: spec.slug, src: `/niv-videos/${spec.slug}.mp4`, role: spec.role, caption: spec.caption };
  } catch (err) {
    console.warn(`  download failed for ${spec.slug}: ${err}`);
    return null;
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const existing = await loadExistingManifest();
  if (!existing) {
    console.error('Refusing to write manifest: cannot load existing entries.');
    process.exit(1);
  }

  const newEntries: ExistingVideo[] = [];
  for (const spec of SPECS) {
    const entry = await generateOne(spec);
    if (entry) newEntries.push(entry);
  }

  if (newEntries.length === 0) {
    console.warn('No new videos generated. Manifest untouched.');
    return;
  }

  // Append-only: keep all existing, add only slugs not already present.
  const knownSlugs = new Set(existing.videos.map((v) => v.slug));
  const merged: ExistingVideo[] = [...existing.videos];
  for (const e of newEntries) {
    if (!knownSlugs.has(e.slug)) merged.push(e);
  }

  const updated: ExistingManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    videos: merged,
  };

  await writeManifestAtomic(updated);
  console.log(
    `\nWrote ${newEntries.length}/${SPECS.length} new videos. Manifest now has ${merged.length} total.`,
  );
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
