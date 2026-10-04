"use client";

import { useLayoutEffect, useRef } from "react";

type Props = { activeKey: string | number; selector?: string };
type Box = { x: number; y: number; width: number; height: number };

/** One continuous glass lens follows the selected item without moving its text. */
export default function LiquidIndicator({
  activeKey,
  selector = '[data-state="active"]',
}: Props) {
  const lens = useRef<HTMLSpanElement>(null);
  const previous = useRef<Box | null>(null);
  const lastKey = useRef(activeKey);

  useLayoutEffect(() => {
    const element = lens.current;
    const group = element?.parentElement;
    if (!element || !group) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let live = true;
    const measure = (animate = false) => {
      const target = group.querySelector<HTMLElement>(selector);
      if (!target || !group.offsetWidth || !target.offsetWidth) {
        element.dataset.visible = "false";
        return;
      }
      const outer = group.getBoundingClientRect();
      const inner = target.getBoundingClientRect();
      const scaleX = outer.width / group.offsetWidth;
      const scaleY = outer.height / group.offsetHeight;
      const next: Box = {
        x:
          (inner.left - outer.left) / scaleX +
          group.scrollLeft -
          group.clientLeft,
        y: (inner.top - outer.top) / scaleY + group.scrollTop - group.clientTop,
        width: inner.width / scaleX,
        height: inner.height / scaleY,
      };
      const before = previous.current;
      // ResizeObserver also fires after subscribing. It must not cancel a move
      // that is already heading to this exact box.
      if (
        !animate &&
        before &&
        element.dataset.visible === "true" &&
        (Object.keys(next) as (keyof Box)[]).every(
          (key) => Math.abs(next[key] - before[key]) < 0.25,
        )
      )
        return;
      const shouldMove = animate && before && !reduced.matches;
      element.style.transitionDuration = shouldMove ? "460ms" : "0ms";
      element.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
      element.style.width = `${next.width}px`;
      element.style.height = `${next.height}px`;
      element.dataset.visible = "true";
      group.dataset.liquidReady = "true";
      const glass = element.firstElementChild as HTMLElement;
      glass.getAnimations().forEach((animation) => animation.cancel());
      if (shouldMove) {
        const horizontal =
          Math.abs(next.x - before.x) > Math.abs(next.y - before.y);
        const stretch = horizontal ? "scale(1.16, .92)" : "scale(.93, 1.13)";
        glass.animate(
          [
            { transform: "scale(1)", filter: "blur(0px)" },
            { transform: stretch, filter: "blur(1px)", offset: 0.38 },
            {
              transform: "scale(.985, 1.025)",
              filter: "blur(0px)",
              offset: 0.76,
            },
            { transform: "scale(1)", filter: "blur(0px)" },
          ],
          { duration: 520, easing: "cubic-bezier(.2,.75,.2,1)" },
        );
        glass.querySelector("i")?.animate(
          [
            { transform: "scale(.45)", opacity: 0.8 },
            { transform: "scale(1.65)", opacity: 0 },
          ],
          { duration: 540, easing: "ease-out" },
        );
      }
      previous.current = next;
    };
    measure(lastKey.current !== activeKey);
    lastKey.current = activeKey;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measure());
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(group);
    group
      .querySelectorAll("button,label")
      .forEach((item) => resize.observe(item));
    group.addEventListener("scroll", schedule, { passive: true });
    const onMotionChange = () => {
      if (reduced.matches) {
        element.style.transitionDuration = "0ms";
        glassAnimations(element).forEach((animation) => animation.cancel());
      }
      schedule();
    };
    reduced.addEventListener("change", onMotionChange);
    void document.fonts.ready.then(() => {
      if (live) schedule();
    });
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      resize.disconnect();
      group.removeEventListener("scroll", schedule);
      reduced.removeEventListener("change", onMotionChange);
      glassAnimations(element).forEach((animation) => animation.cancel());
    };
  }, [activeKey, selector]);

  return (
    <span ref={lens} className="liquid-indicator" aria-hidden="true">
      <span className="liquid-lens">
        <i />
      </span>
    </span>
  );
}

function glassAnimations(element: HTMLElement) {
  return element.getAnimations({ subtree: true });
}
