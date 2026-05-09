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
const MANIFEST = path.join(ROOT, 'lib/niv-videos.ts');

interface VideoSpec {
  slug: string;
  sourceFile: string;
  prompt: string;
  role: string;
  caption: string;
}

const SPECS: VideoSpec[] = [
  {
    slug: 'dancing',
    sourceFile: 'WhatsApp Image 2026-05-09 at 21.15.14.jpeg',
    role: 'victory',
    caption: 'Niv has won. Niv must dance.',
    prompt:
      'The bearded man is dancing terribly to club music, shoulders bouncing, one finger pointing up at the sky in a disco move, big confident smile, looking directly at camera. Cinematic 8 seconds.',
  },
  {
    slug: 'lottery',
    sourceFile: 'WhatsApp Image 2026-05-09 at 21.22.03.jpeg',
    role: 'highscore',
    caption: 'NEW HIGH SCORE',
    prompt:
      'The bearded man is celebrating like he just won the lottery, fist pumping the air, jumping in place, mouth wide open in surprise, ecstatic. 8 seconds.',
  },
  {
    slug: 'crying',
    sourceFile: 'WhatsApp Image 2026-05-09 at 21.22.10.jpeg',
    role: 'gameover',
    caption: 'Niv is sad you lost.',
    prompt:
      'The bearded man is fake-crying dramatically, theatrical sobbing into his hands, then peeking through his fingers with one eye, mock devastation. 8 seconds.',
  },
  {
    slug: 'sideeye',
    sourceFile: 'WhatsApp Image 2026-05-09 at 21.16.33.jpeg',
    role: 'idle',
    caption: 'Niv is judging you.',
    prompt:
      'The bearded man slowly raises one eyebrow, suspicious side-eye to camera, slow smirk forming, judgemental energy. 8 seconds.',
  },
  {
    slug: 'screaming',
    sourceFile: 'WhatsApp Image 2026-05-09 at 21.12.47 (2).jpeg',
    role: 'gameover',
    caption: 'Niv objects.',
    prompt:
      'The bearded man is yelling NOOO at the camera with mock outrage, hands clutching his head, mouth wide open in slow motion. 8 seconds.',
  },
];

const MODEL_CANDIDATES = [
  'veo-3.0-fast-generate-001',
  'veo-3.0-generate-001',
  'veo-2.0-generate-001',
];

const ASPECT_CANDIDATES: (string | null)[] = ['9:16', '16:9', null];

const ai = new GoogleGenAI({ apiKey });

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
          // Quota or auth errors should bail fast across all combos
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

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const completed: VideoSpec[] = [];

  for (const spec of SPECS) {
    const outPath = path.join(OUT_DIR, `${spec.slug}.mp4`);
    try {
      const stat = await fs.stat(outPath);
      if (stat.size > 1000) {
        console.log(`  cached: ${spec.slug}`);
        completed.push(spec);
        continue;
      }
    } catch {
      // not cached
    }

    let imageBytes: Buffer;
    try {
      imageBytes = await fs.readFile(path.join(ROOT, 'niv_media', spec.sourceFile));
    } catch (err) {
      console.warn(`  skipping ${spec.slug}: cannot read ${spec.sourceFile}: ${err}`);
      continue;
    }
    console.log(`  starting: ${spec.slug} (source: ${spec.sourceFile})`);

    let op;
    try {
      op = await startGeneration(spec, imageBytes);
    } catch (err) {
      console.warn(`  failed to start ${spec.slug}: ${err}`);
      continue;
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
      continue;
    }

    const file = op.response?.generatedVideos?.[0]?.video;
    if (!file) {
      console.warn(
        `  no video returned for ${spec.slug}: ${JSON.stringify(op.response).slice(0, 500)}`,
      );
      continue;
    }

    try {
      await ai.files.download({ file, downloadPath: outPath });
      console.log(`  done: ${spec.slug} -> ${outPath}`);
      completed.push(spec);
    } catch (err) {
      console.warn(`  download failed for ${spec.slug}: ${err}`);
    }
  }

  const manifest = {
    version: 1 as const,
    generatedAt: new Date().toISOString(),
    videos: completed.map((s) => ({
      slug: s.slug,
      src: `/niv-videos/${s.slug}.mp4`,
      role: s.role,
      caption: s.caption,
    })),
  };
  const ts = `// AUTO-GENERATED by scripts/gen-videos.ts
export interface NivVideo {
  slug: string;
  src: string;
  role: string;
  caption: string;
}
export const NIV_VIDEOS = ${JSON.stringify(manifest, null, 2)} as const;
`;
  await fs.writeFile(MANIFEST, ts, 'utf8');
  console.log(`\nWrote ${completed.length}/${SPECS.length} videos and manifest`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
