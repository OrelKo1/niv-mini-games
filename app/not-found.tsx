import Link from "next/link";
import Image from "next/image";
import { NIV_MANIFEST } from "@/lib/niv-manifest";

const QUIPS = [
  "Niv hid this page. He is like that.",
  "Page not found. Niv has no comment.",
  "Niv is currently elsewhere.",
  "Whatever you were looking for, Niv ate it.",
  "404: Niv is busy.",
];

export default function NotFound() {
  const i = Math.floor(Math.random() * NIV_MANIFEST.assets.length);
  const asset = NIV_MANIFEST.assets[i];
  const quip = QUIPS[Math.floor(Math.random() * QUIPS.length)];
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-10 gap-4 text-center">
      <h1 className="text-arcade-red text-3xl tracking-widest">404</h1>
      {asset && (
        <Image
          src={asset.paths.portrait720}
          alt=""
          width={320}
          height={320}
          className="border-4 border-arcade-red max-w-full h-auto"
        />
      )}
      <p className="text-[10px] text-arcade-fg/80 max-w-xs leading-snug">{quip}</p>
      <Link
        href="/"
        className="mt-4 border-2 border-arcade-yellow text-arcade-yellow text-[10px] px-4 py-2 hover:bg-arcade-yellow hover:text-arcade-black"
      >
        ◄ HOME
      </Link>
    </div>
  );
}
