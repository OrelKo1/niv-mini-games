"use client";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  BALL_R,
  FIELD_H,
  FIELD_W,
  PADDLE_H,
  POWERUP_SIZE,
  type BrickState,
  type PowerUpKind,
} from "./types";

const PU_LETTER: Record<PowerUpKind, string> = {
  "multi-ball": "M",
  "wide-paddle": "W",
  "slow-ball": "S",
  joint: "J",
};

const PU_COLOR: Record<PowerUpKind, string> = {
  "multi-ball": "#ff5d8f",
  "wide-paddle": "#06d6a0",
  "slow-ball": "#118ab2",
  joint: "#ffd166",
};

function brickColor(brick: { hp: number; maxHp: number }): string {
  const palette = ["#e63946", "#ff5d8f", "#ffd166", "#06d6a0", "#8338ec"];
  // map hp/maxHp to color
  const idx = Math.max(
    0,
    Math.min(palette.length - 1, brick.maxHp - brick.hp + (brick.maxHp - 1))
  );
  return palette[idx % palette.length];
}

type RendererProps = {
  stateRef: { current: BrickState };
  canvasRef: RefObject<HTMLCanvasElement | null>;
  faceUrl: string;
};

export function Renderer({ stateRef, canvasRef, faceUrl }: RendererProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const faceImgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number>(0);

  // Load Niv face when faceUrl changes
  useEffect(() => {
    if (!faceUrl) return;
    const img = new Image();
    img.src = faceUrl;
    img.onload = () => {
      faceImgRef.current = img;
    };
    return () => {
      faceImgRef.current = null;
    };
  }, [faceUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    function resize() {
      if (!canvas || !wrap || !ctx) return;
      const rect = wrap.getBoundingClientRect();
      const fieldAspect = FIELD_W / FIELD_H;
      let w = rect.width;
      let h = w / fieldAspect;
      if (h > rect.height) {
        h = rect.height;
        w = h * fieldAspect;
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const draw = () => {
      const s = stateRef.current;
      if (!ctx || !canvas) return;
      const sx = canvas.width / FIELD_W;
      const sy = canvas.height / FIELD_H;

      // bg
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // border
      ctx.strokeStyle = "rgba(244,244,244,0.1)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

      // bricks
      for (const b of s.bricks) {
        ctx.fillStyle = brickColor(b);
        ctx.fillRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
        // label
        const labelFont = Math.max(11, Math.floor(b.w * 0.18 * sx));
        ctx.font = `${labelFont}px "Press Start 2P", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.fillText(
          b.label,
          (b.x + b.w / 2) * sx,
          (b.y + b.h / 2) * sy,
          (b.w - 2) * sx
        );
      }

      // power-ups
      for (const pu of s.powerUps) {
        ctx.fillStyle = PU_COLOR[pu.kind];
        ctx.fillRect(
          (pu.x - POWERUP_SIZE / 2) * sx,
          (pu.y - POWERUP_SIZE / 2) * sy,
          POWERUP_SIZE * sx,
          POWERUP_SIZE * sy
        );
        ctx.fillStyle = "#0a0a0a";
        const fontPx = Math.max(7, Math.floor(8 * sy));
        ctx.font = `bold ${fontPx}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(PU_LETTER[pu.kind], pu.x * sx, pu.y * sy);
      }

      // paddle
      const p = s.paddle;
      const px = (p.x - p.width / 2) * sx;
      const py = p.y * sy;
      const pw = p.width * sx;
      const ph = PADDLE_H * sy;
      // base bg
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(px, py, pw, ph);
      // niv face stretched
      if (faceImgRef.current) {
        ctx.drawImage(faceImgRef.current, px, py, pw, ph);
      }
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, pw, ph);

      // balls
      ctx.fillStyle = "#f4f4f4";
      for (const b of s.balls) {
        ctx.beginPath();
        ctx.arc(b.x * sx, b.y * sy, BALL_R * Math.min(sx, sy), 0, Math.PI * 2);
        ctx.fill();
      }

      // status overlays handled in page; only HUD here
      // lives indicator
      ctx.fillStyle = "#ff5d8f";
      const hudFont = Math.max(8, Math.floor(9 * sy));
      ctx.font = `${hudFont}px ui-monospace, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`♥ ${s.lives}`, 4 * sx, 4 * sy);
      ctx.fillStyle = "#ffd166";
      ctx.textAlign = "right";
      ctx.fillText(`L${s.level}`, (FIELD_W - 4) * sx, 4 * sy);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [stateRef, canvasRef]);

  return (
    <div
      ref={wrapRef}
      className="w-full h-full flex items-center justify-center"
    >
      <canvas ref={canvasRef} className="image-pixelated" />
    </div>
  );
}
