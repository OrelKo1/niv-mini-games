"use client";
import Image from "next/image";
import type { Board as BoardT, Cell } from "./types";

interface BoardProps {
  board: BoardT;
  onCellClick: (idx: number) => void;
  disabled: boolean;
  nivAvatarSrc: string;
  winningLine: readonly number[] | null;
}

export function Board({
  board,
  onCellClick,
  disabled,
  nivAvatarSrc,
  winningLine,
}: BoardProps) {
  return (
    <div
      className="grid grid-cols-3 grid-rows-3 gap-2 select-none"
      style={{ width: "min(80vw, 360px)", height: "min(80vw, 360px)" }}
    >
      {board.map((cell, idx) => {
        const isWin = winningLine?.includes(idx) ?? false;
        return (
          <BoardCell
            key={idx}
            value={cell}
            onClick={() => onCellClick(idx)}
            disabled={disabled || cell !== null}
            nivAvatarSrc={nivAvatarSrc}
            highlighted={isWin}
          />
        );
      })}
    </div>
  );
}

function BoardCell({
  value,
  onClick,
  disabled,
  nivAvatarSrc,
  highlighted,
}: {
  value: Cell;
  onClick: () => void;
  disabled: boolean;
  nivAvatarSrc: string;
  highlighted: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={value ?? "empty cell"}
      className={`relative flex items-center justify-center border-2 transition-colors ${
        highlighted
          ? "border-arcade-yellow bg-arcade-yellow/15 animate-flash"
          : "border-arcade-fg/40 bg-arcade-black/40"
      } ${
        disabled && value === null
          ? "opacity-60"
          : "hover:bg-arcade-fg/10 active:bg-arcade-fg/20"
      }`}
      style={{ minWidth: 56, minHeight: 56 }}
    >
      {value === "X" && (
        <div className="flex flex-col items-center justify-center gap-1">
          <Image
            src={nivAvatarSrc}
            alt="Niv X"
            width={64}
            height={64}
            className="image-pixelated"
            unoptimized
          />
          <span className="text-[8px] text-arcade-yellow">X</span>
        </div>
      )}
      {value === "O" && (
        <div className="flex flex-col items-center justify-center gap-1">
          <span className="text-3xl leading-none" aria-hidden>
            🚬
          </span>
          <span className="text-[8px] text-arcade-pink">O</span>
        </div>
      )}
    </button>
  );
}
