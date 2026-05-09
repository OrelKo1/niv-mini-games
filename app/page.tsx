import Link from "next/link";
import Image from "next/image";
import { NIV_MANIFEST } from "@/lib/niv-manifest";
import { AttractMode } from "@/components/arcade/AttractMode";
import { LobbyMascot } from "@/components/arcade/LobbyMascot";

const GAMES: Array<{
  id: string;
  title: string;
  href: string;
  tagline: string;
  accent: string;
}> = [
  { id: "pac-niv", title: "PAC-NIV", href: "/pac-niv", tagline: "Eat joints. Dodge ex.", accent: "text-arcade-yellow" },
  { id: "snake-niv", title: "SNAKE-NIV", href: "/snake-niv", tagline: "Grow a Niv.", accent: "text-arcade-green" },
  { id: "niv-memory", title: "NIV-MEMORY", href: "/niv-memory", tagline: "Match the bald.", accent: "text-arcade-pink" },
  { id: "niv-tac-toe", title: "NIV-TAC-TOE", href: "/niv-tac-toe", tagline: "X = Niv. O = joint.", accent: "text-arcade-blue" },
  { id: "brick-niv", title: "BRICK-NIV", href: "/brick-niv", tagline: "Smash adulting.", accent: "text-arcade-red" },
  { id: "whack-a-niv", title: "WHACK-A-NIV", href: "/whack-a-niv", tagline: "Tap the bald.", accent: "text-arcade-purple" },
];

export default function Home() {
  // Pick a small rotation of mascot avatars (server-side stable per request)
  const mascots = NIV_MANIFEST.assets
    .filter((_, i) => i % 7 === 0)
    .slice(0, 6)
    .map((a) => a.paths.avatar128);

  return (
    <div className="min-h-dvh flex flex-col items-center px-4 py-5">
      <LobbyMascot avatars={mascots} />

      <div className="mt-3 flex flex-col items-center">
        <h1 className="text-arcade-red text-2xl sm:text-3xl tracking-[0.2em] drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)]">
          NIVTENDO
        </h1>
        <p className="text-[8px] text-arcade-fg/60 mt-2">© NIV ENTERTAINMENT SYSTEM</p>
        <p className="text-[10px] text-arcade-yellow mt-3 animate-flash">PRESS START</p>
      </div>

      <ul className="mt-6 w-full max-w-md grid grid-cols-2 gap-3">
        {GAMES.map((g) => (
          <li key={g.id}>
            <Link
              href={g.href}
              className="block border-2 border-arcade-fg/40 hover:border-arcade-yellow active:border-arcade-yellow active:bg-arcade-yellow/10 p-3 transition-colors h-full"
            >
              <div className={`text-[11px] ${g.accent}`}>{g.title}</div>
              <div className="text-[9px] text-arcade-fg/70 mt-1 leading-snug">{g.tagline}</div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col items-center gap-3">
        <Link href="/trophies" className="text-[10px] text-arcade-purple hover:text-arcade-yellow">
          ► TROPHY ROOM
        </Link>
        <Link href="/settings" className="text-[9px] text-arcade-fg/40 hover:text-arcade-fg">
          settings
        </Link>
      </div>

      <div className="mt-auto pt-8 flex flex-col items-center gap-1">
        {(() => {
          const fortune = ROTATING_FOOTER[
            Math.floor((Date.now() / (1000 * 60 * 5)) % ROTATING_FOOTER.length)
          ];
          return (
            <p className="text-[8px] text-arcade-fg/40 max-w-xs text-center leading-snug">
              {fortune}
            </p>
          );
        })()}
        <p className="text-[7px] text-arcade-fg/20 mt-2">
          NO NIV WAS HARMED. ACCORDING TO NIV.
        </p>
      </div>

      <AttractMode />
    </div>
  );
}

const ROTATING_FOOTER = [
  "today's lucky number is whatever Niv decides.",
  "Niv is sponsored by his own self-image.",
  "this site has been independently certified by Niv.",
  "the music in your head is also Niv.",
  "if you see a bug, that's Niv saying hi.",
  "Niv is taking the day off. The site is running on hope.",
  "100% organic Niv. No artificial Niv.",
  "every pixel was reviewed by Niv. He approved 60% of them.",
];
