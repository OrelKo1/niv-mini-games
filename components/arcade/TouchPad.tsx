"use client";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export type Dir = "up" | "down" | "left" | "right";

export function TouchPad({
  onSwipe,
  onTap,
  onPan,
  className,
  children,
}: {
  onSwipe?: (d: Dir) => void;
  onTap?: (x: number, y: number) => void;
  onPan?: (x: number, y: number, rect: DOMRect) => void;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let sx = 0,
      sy = 0,
      t = 0,
      pointing = false;

    const onStart = (e: PointerEvent) => {
      pointing = true;
      sx = e.clientX;
      sy = e.clientY;
      t = e.timeStamp;
      el.setPointerCapture(e.pointerId);
      onPan?.(e.clientX, e.clientY, el.getBoundingClientRect());
    };
    const onMove = (e: PointerEvent) => {
      if (!pointing) return;
      onPan?.(e.clientX, e.clientY, el.getBoundingClientRect());
    };
    const onEnd = (e: PointerEvent) => {
      if (!pointing) return;
      pointing = false;
      const dx = e.clientX - sx,
        dy = e.clientY - sy;
      const dist = Math.hypot(dx, dy);
      const dt = e.timeStamp - t;
      if (dist < 14 && dt < 400) {
        onTap?.(e.clientX, e.clientY);
        return;
      }
      if (dist < 24) return;
      if (Math.abs(dx) > Math.abs(dy))
        onSwipe?.(dx > 0 ? "right" : "left");
      else onSwipe?.(dy > 0 ? "down" : "up");
    };

    el.addEventListener("pointerdown", onStart);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onEnd);
    el.addEventListener("pointercancel", onEnd);
    return () => {
      el.removeEventListener("pointerdown", onStart);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onEnd);
      el.removeEventListener("pointercancel", onEnd);
    };
  }, [onSwipe, onTap, onPan]);

  return (
    <div
      ref={ref}
      className={
        className ?? "absolute inset-0 touch-none select-none"
      }
    >
      {children}
    </div>
  );
}
