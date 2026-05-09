/**
 * Generate stylized variant images for platinum-tier Niv assets via
 * Google's Gemini 2.5 Flash Image model ("nanobanana"). Outputs land at
 * public/niv/<slug>/stylized-<style>.webp. Skips outputs that already exist.
 *
 * Usage:
 *   GEMINI_API_KEY=... pnpm tsx scripts/gen-stylized.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { NIV_MANIFEST } from "../lib/niv-manifest";
import type { NivAsset } from "../lib/niv-types";

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

const STYLE_PROMPTS: Record<string, string> = {
  pixel:
    "16-bit pixel art sprite of this man's face, retro arcade style, 64x64 sprite, transparent or solid background, vibrant colors, big expressive eyes, exact same beard.",
  renaissance:
    "Renaissance oil painting portrait of this man, gilt frame around it, dramatic chiaroscuro lighting, exact same face and beard, royal purple background, signed by Caravaggio.",
  anime:
    "Anime portrait of this man, vivid saturated colors, sharp linework, big shiny eyes, dynamic pose, manga panel style, exact same beard, action manga vibes.",
  mugshot:
    "Police mugshot of this man holding a height-marker board labeled 'NIV', front view, harsh fluorescent lighting, washed out skin tone, deadpan stare, exact same beard.",
};

// Models to try in order if the previous is rejected.
const MODEL_FALLBACKS = [
  "gemini-2.5-flash-image-preview",
  "gemini-2.5-flash-image",
  "gemini-2.0-flash-exp-image-generation",
];

// Cap to control cost.
const MAX_ASSETS = 10;

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

interface GenPart {
  inlineData?: { mimeType?: string; data?: string };
  text?: string;
}

function findImagePart(resp: unknown): GenPart | null {
  // Be very defensive — the SDK shape can vary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = resp as any;
  const candidates = r?.candidates ?? r?.response?.candidates;
  if (!Array.isArray(candidates)) return null;
  for (const c of candidates) {
    const parts: GenPart[] | undefined = c?.content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (part.inlineData?.data) return part;
    }
  }
  return null;
}

async function generateOne(
  ai: GoogleGenAI,
  base64Source: string,
  prompt: string
): Promise<{ data: Buffer; model: string } | null> {
  let lastErr: unknown = null;
  for (const model of MODEL_FALLBACKS) {
    try {
      const result = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: { mimeType: "image/webp", data: base64Source },
              },
              { text: prompt },
            ],
          },
        ],
      });
      const part = findImagePart(result);
      if (!part || !part.inlineData?.data) {
        // No image came back — likely safety/refusal. Don't retry on
        // another model; report and move on.
        console.warn(
          `  no image in response (model=${model}); response had no inlineData part`
        );
        return null;
      }
      const buf = Buffer.from(part.inlineData.data, "base64");
      return { data: buf, model };
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      // If the model name was rejected, try the next one. Otherwise bail.
      if (
        /not found|not supported|unknown model|invalid model|404/i.test(msg)
      ) {
        console.warn(`  model ${model} unavailable, trying next...`);
        continue;
      }
      console.warn(`  generation error (model=${model}): ${msg}`);
      return null;
    }
  }
  console.warn(`  all models exhausted: ${String(lastErr)}`);
  return null;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY env var is required");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  const platinum: NivAsset[] = NIV_MANIFEST.assets
    .filter((a) => a.tier === "platinum")
    .slice(0, MAX_ASSETS);

  console.log(
    `Found ${NIV_MANIFEST.assets.filter((a) => a.tier === "platinum").length} platinum assets; processing first ${platinum.length}.`
  );

  const styles = Object.keys(STYLE_PROMPTS);
  const startedAt = Date.now();
  const stats = {
    generated: 0,
    skipped: 0,
    failed: 0,
    perAsset: new Map<string, number>(),
  };

  for (const asset of platinum) {
    const slugDir = path.join(PUBLIC_DIR, "niv", asset.slug);
    const sourcePath = path.join(slugDir, "avatar-256.webp");

    let base64Source: string;
    try {
      const buf = await fs.readFile(sourcePath);
      base64Source = buf.toString("base64");
    } catch (err) {
      console.warn(
        `[${asset.slug}] cannot read source ${sourcePath}: ${String(err)}`
      );
      stats.failed += styles.length;
      continue;
    }

    console.log(`\n[${asset.slug}] ${asset.caption}`);

    let assetCount = 0;
    for (const style of styles) {
      const outPath = path.join(slugDir, `stylized-${style}.webp`);
      if (await fileExists(outPath)) {
        console.log(`  ${style}: cached, skipping`);
        stats.skipped += 1;
        assetCount += 1;
        continue;
      }
      console.log(`  ${style}: generating...`);
      const prompt = STYLE_PROMPTS[style];
      const result = await generateOne(ai, base64Source, prompt);
      if (!result) {
        console.warn(`  ${style}: failed`);
        stats.failed += 1;
        continue;
      }
      try {
        // Re-encode whatever the model returned (likely PNG/JPEG) to webp.
        const webp = await sharp(result.data).webp({ quality: 88 }).toBuffer();
        await fs.writeFile(outPath, webp);
        console.log(
          `  ${style}: wrote ${path.relative(ROOT, outPath)} (${webp.length} bytes, model=${result.model})`
        );
        stats.generated += 1;
        assetCount += 1;
      } catch (err) {
        console.warn(`  ${style}: encode/write failed: ${String(err)}`);
        stats.failed += 1;
      }
    }
    stats.perAsset.set(asset.slug, assetCount);
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\nDone in ${elapsedSec}s — generated=${stats.generated}, skipped=${stats.skipped}, failed=${stats.failed}`
  );
  for (const [slug, n] of stats.perAsset) {
    console.log(`  ${slug}: ${n}/${styles.length} variants present`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
