// import types
import type { PointerEvent } from "react";

/**
 * Click ripple, shared by the /admin and /dev rails. Ripples are appended to a dedicated empty
 * layer rather than to the link itself, so React never has to reconcile around DOM it did not
 * create.
 *
 * The radius reaches the farthest corner from the click point, which keeps the circle covering
 * the row wherever it lands. Each ripple removes itself on animationend, so nothing accumulates.
 * Styling and the reduced-motion opt-out live in app/globals.css.
 *
 * Deliberately a plain function and not a hook: there is no state, ref or effect here, so a
 * useRipple() would only wrap this in a useCallback that buys nothing a module-level function
 * does not already give you.
 *
 * The call site must render a `[data-ripple-layer]` element inside the handler's target — see
 * either rail for the span. Without one this is a no-op rather than an error, so a row that
 * forgets it simply does not ripple.
 */
export function spawnRipple(event: PointerEvent<HTMLElement>) {
  const layer = event.currentTarget.querySelector<HTMLElement>("[data-ripple-layer]");
  if (!layer) return;

  const rect = layer.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));

  const ripple = document.createElement("span");
  ripple.className = "sidebar-ripple";
  ripple.style.width = `${radius * 2}px`;
  ripple.style.height = `${radius * 2}px`;
  ripple.style.left = `${x - radius}px`;
  ripple.style.top = `${y - radius}px`;
  ripple.addEventListener("animationend", () => ripple.remove());

  layer.appendChild(ripple);
}
