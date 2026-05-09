"use client";
import { useEffect, useRef } from "react";
import type { RunNivState, Obstacle } from "./types";
import { PLAYER_LANE, NIV_LANE } from "./engine";

const FIELD_W = 720; // logical render width
const FIELD_H = 480; // logical render height
const GROUND_NIV_Y = 200; // top track (Niv)
const GROUND_PLAYER_Y = 360; // bottom track (player)
const RUNNER_W = 84;
const RUNNER_H = 96;
const VIEW_AHEAD_M = 220; // meters of visible track ahead of camera
const VIEW_BEHIND_M = 20;

const OBSTACLE_LABEL: Record<Obstacle["type"], string> = {
  cone: "🚧",
  rock: "🪨",
  joint: "🚬",
  bottle: "🍾",
  pin: "🎳",
  trash: "🗑",
};

export interface RendererProps {
  stateRef: React.RefObject<RunNivState | null>;
  nivFaceUrl: string;
  playerFaceUrl?: string;
}

export function Renderer({ stateRef, nivFaceUrl, playerFaceUrl }: RendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  // preload images
  const nivImgRef = useRef<HTMLImageElement | null>(null);
  const playerImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = nivFaceUrl;
    img.onload = () => {
      nivImgRef.current = img;
    };
  }, [nivFaceUrl]);

  useEffect(() => {
    if (!playerFaceUrl) return;
    const img = new Image();
    img.src = playerFaceUrl;
    img.onload = () => {
      playerImgRef.current = img;
    };
  }, [playerFaceUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const s = stateRef.current;
      if (!s) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Camera follows the leader so the action stays visible
      const camera = Math.max(s.player.distance, s.niv.distance);

      const meterToX = (m: number) =>
        ((m - camera + VIEW_BEHIND_M) / (VIEW_AHEAD_M + VIEW_BEHIND_M)) *
        FIELD_W;

      // Background
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);

      // Sky gradient (dawn arcade)
      const sky = ctx.createLinearGradient(0, 0, 0, FIELD_H);
      sky.addColorStop(0, "#1d0f33");
      sky.addColorStop(1, "#3a0e12");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);

      // Distance grid (parallax stripes that scroll)
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      const stripeStep = 60;
      const off = (camera * 2) % stripeStep;
      for (let x = -off; x < FIELD_W; x += stripeStep) {
        ctx.fillRect(x, 0, 1, FIELD_H);
      }

      // Tracks
      const drawTrack = (y: number, label: string, color: string) => {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0, y + 38, FIELD_W, 4);
        ctx.fillStyle = color;
        ctx.font = "10px 'Press Start 2P', monospace";
        ctx.textAlign = "left";
        ctx.fillText(label, 10, y + 36);
      };
      drawTrack(GROUND_NIV_Y, "NIV", "#ff5d8f");
      drawTrack(GROUND_PLAYER_Y, "YOU", "#ffd166");

      // Obstacles
      ctx.font = "32px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const o of s.obstacles) {
        const x = meterToX(o.pos);
        if (x < -40 || x > FIELD_W + 40) continue;
        const y = o.lane === PLAYER_LANE ? GROUND_PLAYER_Y + 20 : GROUND_NIV_Y + 20;
        ctx.fillText(OBSTACLE_LABEL[o.type], x, y);
      }

      // Player runner (bottom track)
      const playerX = meterToX(s.player.distance);
      drawRunner(
        ctx,
        playerX,
        GROUND_PLAYER_Y,
        s.player.jumpUntil > s.now,
        s.player.stumbleUntil > s.now,
        false,
        playerImgRef.current,
        "#ffd166",
        s.now
      );

      // Niv runner (top track)
      const nivX = meterToX(s.niv.distance);
      drawRunner(
        ctx,
        nivX,
        GROUND_NIV_Y,
        false,
        false,
        s.niv.tripUntil > s.now,
        nivImgRef.current,
        "#ff5d8f",
        s.now
      );

      // Niv thought bubble while tripping
      if (s.niv.thoughtBubble && s.niv.thoughtBubble.until > s.now) {
        const bx = nivX + 30;
        const by = GROUND_NIV_Y - 30;
        const txt = s.niv.thoughtBubble.text;
        ctx.font = "10px 'Press Start 2P', monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const w = Math.max(60, ctx.measureText(txt).width + 16);
        ctx.fillStyle = "#fff";
        ctx.fillRect(bx, by, w, 22);
        ctx.fillStyle = "#0a0a0a";
        ctx.fillText(txt, bx + 8, by + 11);
      }

      // HUD: timer + distances
      const elapsed = s.startedAt > 0 ? Math.max(0, s.now - s.startedAt) : 0;
      const remaining = Math.max(0, 60 - Math.floor(elapsed / 1000));
      ctx.font = "16px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = remaining <= 5 ? "#e63946" : "#ffd166";
      ctx.fillText(`${remaining}s`, FIELD_W / 2, 12);
      ctx.font = "11px 'Press Start 2P', monospace";
      ctx.fillStyle = "#ff5d8f";
      ctx.textAlign = "right";
      ctx.fillText(
        `NIV ${Math.floor(s.niv.distance)}m`,
        FIELD_W - 14,
        14
      );
      ctx.fillStyle = "#ffd166";
      ctx.textAlign = "left";
      ctx.fillText(
        `YOU ${Math.floor(s.player.distance)}m`,
        14,
        14
      );

      // Trip count
      ctx.fillStyle = "#ff5d8f";
      ctx.font = "9px 'Press Start 2P', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`TRIPS ${s.niv.trips}`, FIELD_W - 14, 36);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [stateRef]);

  return (
    <canvas
      ref={canvasRef}
      width={FIELD_W}
      height={FIELD_H}
      className="w-full h-full image-pixelated"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

function drawRunner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  airborne: boolean,
  stumbling: boolean,
  tripping: boolean,
  img: HTMLImageElement | null,
  fallbackColor: string,
  now: number
) {
  const headW = 72;
  const headH = 72;

  if (tripping) {
    // Face-down on the ground, face rotated, "X" eyes via the head image lying flat
    const cx = x;
    const cy = y + 36;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 2);
    if (img) {
      ctx.drawImage(img, -headW / 2, -headH / 2, headW, headH);
    } else {
      ctx.fillStyle = fallbackColor;
      ctx.fillRect(-headW / 2, -headH / 2, headW, headH);
    }
    ctx.restore();
    // Stars
    ctx.fillStyle = "#ffd166";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("✦ ✦ ✦", x, y - 4);
    return;
  }

  // Bobbing
  const bob = airborne ? -28 - Math.abs(Math.sin(now / 80)) * 6 : -Math.sin(now / 90) * 4;
  const headY = y - headH + bob;

  // Legs
  ctx.strokeStyle = fallbackColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 12, headY + headH);
  ctx.lineTo(x - 16, y + 24 + (airborne ? -8 : 0));
  ctx.moveTo(x + 12, headY + headH);
  ctx.lineTo(x + 18, y + 24 + (airborne ? 6 : Math.sin(now / 60) * 4));
  ctx.stroke();

  // Head (avatar)
  if (img) {
    ctx.drawImage(img, x - headW / 2, headY, headW, headH);
  } else {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(x - headW / 2, headY, headW, headH);
  }

  if (stumbling) {
    ctx.strokeStyle = "#e63946";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - headW / 2 - 2, headY - 2, headW + 4, headH + 4);
  }
}
