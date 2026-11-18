"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Columns2 } from "lucide-react";
import { toast } from "sonner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from "@/src/components/ui/Resizable";

type Side = "left" | "right";
type Gesture =
  | { phase: "pending" | "holding" | "armed"; x: number; y: number; startX: number; side: Side | null }
  | null;

const SHOW_DELAY_MS = 200;
const HOLD_MS = 1000;
const MOVE_TOLERANCE = 6;
const DRAG_THRESHOLD = 80;
const RING_RADIUS = 14;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const EXIT_MESSAGE = "split-screen:exit";
const MODAL_SELECTOR = '[role="dialog"],[role="alertdialog"],[aria-modal="true"]';
const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "label",
  "option",
  "video",
  "audio",
  "iframe",
  "canvas",
  "svg",
  "img",
  '[contenteditable]:not([contenteditable="false"])',
  '[draggable="true"]',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="slider"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="menuitem"]',
  '[role="option"]',
  ".fc",
  "[data-no-split]"
].join(",");

function isOverText(x: number, y: number) {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null;
  };
  const node = doc.caretPositionFromPoint
    ? doc.caretPositionFromPoint(x, y)?.offsetNode
    : document.caretRangeFromPoint?.(x, y)?.startContainer;
  if (!node || node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) return false;
  const range = document.createRange();
  range.selectNodeContents(node);
  return Array.from(range.getClientRects()).some(
    (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  );
}

function isEmptySpace(e: PointerEvent) {
  const target = e.target;
  if (!(target instanceof Element) || target.closest(INTERACTIVE_SELECTOR)) return false;
  if (!["auto", "default"].includes(getComputedStyle(target).cursor)) return false;
  return !isOverText(e.clientX, e.clientY);
}

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function canExitOnEscape(e: KeyboardEvent) {
  return (
    e.key === "Escape" &&
    !e.defaultPrevented &&
    !isEditable(e.target) &&
    !document.querySelector(MODAL_SELECTOR)
  );
}

export function SplitScreen({ children, topOnly }: { children: ReactNode; topOnly?: ReactNode }) {
  const router = useRouter();
  const t = useTranslations("Split");
  const [embedded, setEmbedded] = useState<boolean | null>(null);
  const [split, setSplit] = useState<{ src: string; newSide: Side } | null>(null);
  const [gesture, setGesture] = useState<Gesture>(null);
  const frames = useRef<Record<Side, HTMLIFrameElement | null>>({ left: null, right: null });
  const activeSide = useRef<Side | null>(null);

  useEffect(() => setEmbedded(window.self !== window.top), []);

  useEffect(() => {
    if (!embedded) return;
    const onKey = (e: KeyboardEvent) => {
      if (canExitOnEscape(e)) window.parent.postMessage({ type: EXIT_MESSAGE }, location.origin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embedded]);

  const exitSplit = useCallback(
    (keep: Side) => {
      const href = frames.current[keep]?.contentWindow?.location.href;
      setSplit(null);
      if (!href) return;
      const url = new URL(href);
      router.push(url.pathname + url.search + url.hash);
    },
    [router]
  );

  useEffect(() => {
    if (!split) return;
    const sideOf = (win: MessageEventSource | null) =>
      (Object.keys(frames.current) as Side[]).find((s) => frames.current[s]?.contentWindow === win);
    const original: Side = split.newSide === "left" ? "right" : "left";
    const onMessage = (e: MessageEvent) => {
      const side = sideOf(e.source);
      if (e.origin === location.origin && e.data?.type === EXIT_MESSAGE && side) exitSplit(side);
    };
    const onKey = (e: KeyboardEvent) => {
      if (canExitOnEscape(e)) exitSplit(activeSide.current ?? original);
    };
    const onBlur = () =>
      setTimeout(() => {
        activeSide.current = sideOf((document.activeElement as HTMLIFrameElement)?.contentWindow) ?? activeSide.current;
      });
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
      activeSide.current = null;
    };
  }, [split, exitSplit]);

  useEffect(() => {
    if (embedded !== false || split) return;
    let state: Gesture = null;
    const timers: number[] = [];
    const update = (next: Gesture) => {
      state = next;
      setGesture(next);
    };
    const reset = () => {
      timers.splice(0).forEach(clearTimeout);
      document.body.style.userSelect = "";
      update(null);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (!matchMedia("(min-width: 768px)").matches || !isEmptySpace(e)) return;
      update({ phase: "pending", x: e.clientX, y: e.clientY, startX: e.clientX, side: null });
      timers.push(
        window.setTimeout(() => state && update({ ...state, phase: "holding" }), SHOW_DELAY_MS),
        window.setTimeout(() => {
          if (!state) return;
          document.body.style.userSelect = "none";
          window.getSelection()?.removeAllRanges();
          update({ ...state, phase: "armed" });
        }, HOLD_MS)
      );
    };
    const onMove = (e: PointerEvent) => {
      if (!state) return;
      const dx = e.clientX - state.startX;
      if (state.phase !== "armed") {
        if (Math.hypot(dx, e.clientY - state.y) > MOVE_TOLERANCE) reset();
        return;
      }
      const side = Math.abs(dx) < DRAG_THRESHOLD ? null : dx < 0 ? "left" : "right";
      update({ ...state, x: e.clientX, y: e.clientY, side });
    };
    const onUp = () => {
      const side = state?.phase === "armed" ? state.side : null;
      reset();
      if (!side) return;
      setSplit({ src: location.pathname + location.search + location.hash, newSide: side });
      toast(t("exitHint"));
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && state && reset();
    const onDragStart = (e: DragEvent) => state?.phase === "armed" && e.preventDefault();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("keydown", onKey);
    window.addEventListener("dragstart", onDragStart);
    return () => {
      reset();
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", reset);
      window.removeEventListener("blur", reset);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dragstart", onDragStart);
    };
  }, [embedded, split, t]);

  const pane = (side: Side) => (
    <ResizablePanel defaultSize={50} minSize={20}>
      <iframe
        ref={(el) => {
          frames.current[side] = el;
        }}
        src={split!.src}
        className="block h-full w-full border-0"
      />
    </ResizablePanel>
  );

  return (
    <>
      {split ? (
        <div className="fixed inset-0 z-40 bg-background">
          <ResizablePanelGroup direction="horizontal">
            {pane("left")}
            <ResizableHandle withHandle />
            {pane("right")}
          </ResizablePanelGroup>
        </div>
      ) : (
        children
      )}
      {gesture?.phase === "armed" && gesture.side && (
        <div
          className={`pointer-events-none fixed inset-y-0 z-[100] w-1/2 border-2 border-dashed border-primary bg-primary/10 ${
            gesture.side === "left" ? "left-0" : "right-0"
          }`}
        />
      )}
      {gesture && gesture.phase !== "pending" && (
        <div
          className="pointer-events-none fixed z-[101] flex items-center gap-2"
          style={{ left: gesture.x + 14, top: gesture.y + 14 }}
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-background/90 shadow-md">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r={RING_RADIUS} fill="none" strokeWidth="3" className="stroke-muted" />
              <circle
                cx="18"
                cy="18"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={gesture.phase === "armed" ? 0 : RING_LENGTH}
                className="stroke-primary"
              >
                {gesture.phase === "holding" && (
                  <animate
                    attributeName="stroke-dashoffset"
                    from={RING_LENGTH}
                    to="0"
                    dur={`${HOLD_MS - SHOW_DELAY_MS}ms`}
                    fill="freeze"
                  />
                )}
              </circle>
            </svg>
            <Columns2 className={`h-4 w-4 ${gesture.phase === "armed" ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          {gesture.phase === "armed" && (
            <span className="whitespace-nowrap rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground shadow-md">
              {t("dragHint")}
            </span>
          )}
        </div>
      )}
      {embedded === false && topOnly}
    </>
  );
}
