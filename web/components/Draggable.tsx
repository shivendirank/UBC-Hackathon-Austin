"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

type Point = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function readStored(key: string | undefined, fallback: Point): Point {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Point;
    if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) return parsed;
  } catch {
    /* ignore */
  }
  return fallback;
}

/**
 * Fixed shell you can drag. Pass dragAnywhere, or put data-drag-handle on a grip.
 * After a real drag, the following click is suppressed so toggles don’t fire.
 */
export function Draggable({
  children,
  className = "",
  style,
  initial = { x: 24, y: 120 },
  storageKey,
  dragAnywhere = false,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  initial?: Point;
  storageKey?: string;
  dragAnywhere?: boolean;
}) {
  const [pos, setPos] = useState<Point>(() => readStored(storageKey, initial));
  const nodeRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  const persist = useCallback(
    (next: Point) => {
      if (!storageKey) return;
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const bound = useCallback((raw: Point): Point => {
    const el = nodeRef.current;
    const w = el?.offsetWidth ?? 80;
    const h = el?.offsetHeight ?? 80;
    const maxX = Math.max(8, window.innerWidth - w - 8);
    const maxY = Math.max(8, window.innerHeight - h - 8);
    return { x: clamp(raw.x, 8, maxX), y: clamp(raw.y, 8, maxY) };
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => bound(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bound]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const onHandle = Boolean(target.closest("[data-drag-handle]"));
    if (!dragAnywhere && !onHandle) return;
    if (target.closest("input, textarea, select, a, button") && !onHandle) return;

    const el = nodeRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && dx * dx + dy * dy < 36) return;
    d.moved = true;
    setPos(bound({ x: d.originX + dx, y: d.originY + dy }));
  };

  const endDrag = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    try {
      nodeRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (d.moved) {
      suppressClick.current = true;
      setPos((p) => {
        const next = bound(p);
        persist(next);
        return next;
      });
    }
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      ref={nodeRef}
      className={className}
      style={{
        ...style,
        position: "fixed",
        left: pos.x,
        top: pos.y,
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={onClickCapture}
      aria-hidden={style?.visibility === "hidden" ? true : undefined}
    >
      {children}
    </div>
  );
}

export function DragHandle({
  children,
  className = "",
  title = "Drag to move",
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div data-drag-handle title={title} className={`cursor-grab active:cursor-grabbing ${className}`}>
      {children}
    </div>
  );
}
