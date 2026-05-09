"use client";
import Link from "next/link";
import { useNivStore } from "@/lib/store/use-niv-store";

export default function Settings() {
  const settings = useNivStore((s) => s.settings);
  const toggleSetting = useNivStore((s) => s.toggleSetting);
  const reset = useNivStore((s) => s.reset);
  const unlocks = useNivStore((s) => s.unlocks);
  const highScores = useNivStore((s) => s.highScores);

  const totalScore = Object.values(highScores).reduce<number>(
    (a, b) => a + (b ?? 0),
    0
  );

  const onReset = () => {
    if (
      typeof window !== "undefined" &&
      window.confirm(
        "Reset all unlocks, high scores, and settings? Niv will be informed."
      )
    ) {
      reset();
    }
  };

  return (
    <div className="min-h-dvh px-4 py-5">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-arcade-yellow text-[10px] hover:text-arcade-pink">
          ◄ HOME
        </Link>
        <h1 className="text-[12px] tracking-widest">SETTINGS</h1>
        <span className="w-12" />
      </div>

      <ul className="mt-8 max-w-md mx-auto flex flex-col gap-3">
        <Toggle
          label="SOUND"
          on={settings.sound}
          onChange={() => toggleSetting("sound")}
        />
        <Toggle
          label="HAPTICS"
          on={settings.haptics}
          onChange={() => toggleSetting("haptics")}
        />
        <Toggle
          label="CRT OVERLAY"
          on={settings.crt}
          onChange={() => toggleSetting("crt")}
        />
      </ul>

      <div className="mt-10 max-w-md mx-auto border-2 border-arcade-fg/20 p-3">
        <h2 className="text-[10px] text-arcade-fg/70">STATS</h2>
        <ul className="mt-2 text-[9px] space-y-1 tabular-nums">
          <li>UNLOCKS: <span className="text-arcade-yellow">{unlocks.length}</span></li>
          <li>TOTAL HIGH-SCORE SUM: <span className="text-arcade-yellow">{totalScore}</span></li>
        </ul>
      </div>

      <div className="mt-8 max-w-md mx-auto">
        <button
          onClick={onReset}
          className="w-full border-2 border-arcade-red text-arcade-red text-[10px] py-3 hover:bg-arcade-red hover:text-arcade-black"
        >
          ⚠ RESET EVERYTHING
        </button>
      </div>

      <p className="mt-12 text-[8px] text-arcade-fg/30 text-center max-w-md mx-auto leading-snug">
        all data is stored on your device. nivtendo does not collect anything.
        niv is a real person and consented to this. probably.
      </p>
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: () => void;
}) {
  return (
    <li>
      <button
        onClick={onChange}
        className="w-full flex items-center justify-between border-2 border-arcade-fg/30 px-3 py-3 hover:border-arcade-yellow"
      >
        <span className="text-[10px]">{label}</span>
        <span
          className={`text-[10px] ${
            on ? "text-arcade-green" : "text-arcade-fg/40"
          }`}
        >
          {on ? "● ON" : "○ OFF"}
        </span>
      </button>
    </li>
  );
}
