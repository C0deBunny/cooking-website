"use client";

// import lib
import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

// import components
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

// import types
import type { CropRect } from "./upload";

/**
 * The 1:1 crop picker. Drag or arrow-key to position, wheel or slider to zoom, confirm to get a
 * source rectangle back.
 *
 * **Cropping here is what makes every surface downstream simple.** Because the stored file is
 * already the final framing, nothing crops it again — which deletes the aspect check, the "this
 * photo will be cropped" warning, and the whole question of which surface frames a photo how. The
 * wizard's thumbnail *is* the published image (decision 13).
 *
 * Square rather than a wider frame because these photos come off a phone: a 3:4 portrait loses 58%
 * of its height to 16:9 and 25% to a square, and a square is the only ratio that behaves
 * identically in a card grid and in a 19rem preview rail (decision 14).
 *
 * **The bitmap arrives already decoded, and this paints from it rather than from the `File`.**
 * That is the EXIF ordering rule: an `<img>` applies a phone photo's rotation metadata
 * automatically and `createImageBitmap` does not, so measuring the rectangle against one and
 * drawing it against the other produces output that is rotated *and* offset. One decode used for
 * both removes the mismatch — see `decodeImage` in upload.ts.
 *
 * Cancel keeps nothing. Retaining the `File` for a cheaper retry would mean a field state holding
 * something `toPayload()` cannot resolve into a path, which is the shape the draft's union has no
 * `status` for (decision 29).
 *
 * The maths is the prototype's, unchanged: docs/plans/recipe-images/assets/crop-prototype.html.
 */

/** How far past "just covering the square" the user may zoom in. */
const MAX_ZOOM = 4;

/**
 * Keyboard pan distance in viewport pixels per key press, and the Shift-held version.
 *
 * Viewport pixels rather than source pixels, so a nudge moves the photo by what the user sees
 * regardless of zoom — the same units a drag works in, since both add to `view.current.x/y`.
 */
const PAN_STEP = 10;
const PAN_STEP_COARSE = 50;

/**
 * How long the rule-of-thirds guides linger after an arrow-key nudge.
 *
 * A drag has a pointerup to hide on; a key press is discrete and has nothing equivalent, so a nudge
 * schedules its own fade. Long enough to survive the gap between two deliberate presses, so holding
 * a direction does not strobe the grid.
 */
const GUIDE_LINGER_MS = 700;

type Props = {
  bitmap: ImageBitmap | null;
  onConfirm: (rect: CropRect) => void;
  onCancel: () => void;
};

export default function CropDialog({ bitmap, onConfirm, onCancel }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLCanvasElement>(null);

  /**
   * The whole of the widget: how far the image is scaled, the scale at which it exactly covers the
   * square, and where its top-left corner sits inside that square. Everything else — the source
   * rectangle, the clamping, the slider position — is derived from these four numbers.
   *
   * A ref written straight to the canvas's `style.transform`, rather than state, because a
   * pointermove fires at the display's refresh rate: routing a drag through setState re-renders
   * the dialog on every frame to move one element. The prototype this is ported from does the
   * same. `zoom` below is the one piece React needs, because the slider is a controlled input.
   */
  const view = useRef({ scale: 1, min: 1, x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  /**
   * The rule-of-thirds guides, shown only while the photo is actually moving — the trick every
   * camera app uses, and the prototype's behaviour: composition help exactly when you are composing,
   * and four lines out of the way the rest of the time.
   *
   * Toggled by writing `data-moving` on the stage rather than by holding it in state, for the same
   * reason `apply()` writes the transform imperatively: this is set from `onPointerDown`/`Up`, which
   * bracket a handler firing at the display's refresh rate. The fade itself is CSS.
   */
  const guideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showGuides = useCallback((moving: boolean, linger = 0) => {
    clearTimeout(guideTimer.current);

    const write = () => stageRef.current?.setAttribute("data-moving", String(moving));

    if (linger) guideTimer.current = setTimeout(write, linger);
    else write();
  }, []);

  const apply = useCallback(() => {
    const canvas = imageRef.current;
    if (!canvas) return;

    canvas.style.transform = `translate(${view.current.x}px, ${view.current.y}px) scale(${view.current.scale})`;
  }, []);

  /** Never let the image stop covering the square. That is the only rule. */
  const clamp = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !bitmap) return;

    const viewport = stage.clientWidth;

    view.current.x = Math.min(0, Math.max(viewport - bitmap.width * view.current.scale, view.current.x));
    view.current.y = Math.min(0, Math.max(viewport - bitmap.height * view.current.scale, view.current.y));
  }, [bitmap]);

  /**
   * Zoom anchored on a point, so whatever is under the cursor stays under it.
   *
   * Declared up here, and memoised, because the setup effect below attaches the wheel listener and
   * therefore depends on this. An identity that changed every render would re-run that effect every
   * render — re-fitting the photo and resetting the zoom to 1 while the user is still working.
   */
  const zoomTo = useCallback(
    (next: number, cx: number, cy: number) => {
      const { min, scale } = view.current;
      const bounded = Math.max(min, Math.min(min * MAX_ZOOM, next));
      const ratio = bounded / scale;

      view.current.x = cx - (cx - view.current.x) * ratio;
      view.current.y = cy - (cy - view.current.y) * ratio;
      view.current.scale = bounded;

      clamp();
      apply();
      setZoom(bounded / min);
    },
    [clamp, apply]
  );

  /**
   * Paint, fit, and attach the wheel listener — everything that needs the stage node to exist. Keyed
   * on the bitmap rather than on mount, because the dialog is handed a new photo each time it opens.
   *
   * The bitmap goes onto a canvas rather than into an `<img>`, because an `ImageBitmap` has no URL
   * and making one with `createObjectURL` would reintroduce the raw-file path this component
   * exists to avoid. Drawn at natural size and positioned by transform, so the browser scales it.
   */
  useEffect(() => {
    if (!bitmap) return;

    let frame = 0;
    let detachWheel: (() => void) | undefined;

    /**
     * ⚠ Retried on the next frame until **both** the nodes and a non-zero width exist, and the
     * ref check has to be inside this loop rather than an early return above it.
     *
     * `Dialog` renders its content into a portal, so on the commit where `open` flips true these
     * refs can still be null — and this effect's only dependency is the bitmap, which does not
     * change again. An early `if (!stage || !canvas) return` therefore does not defer the setup,
     * it *cancels* it: the canvas keeps its default 300×150 and is never painted, `view` keeps its
     * initial `{scale: 1, min: 1, x: 0, y: 0}`, and the dialog opens showing an empty square.
     *
     * That fails quietly rather than loudly, which is why it is worth this comment. `sourceRect()`
     * still returns a valid rectangle from those initial numbers — `sx: 0, sy: 0, size: viewport`
     * — so Confirm uploads a real photo: the top-left corner of the source at whatever the
     * viewport happens to be, roughly a third of the intended resolution, with no framing the user
     * chose. Everything downstream looks like it worked.
     *
     * The zero-width half of the condition is the same class of problem one step later: the dialog
     * animates in, so the first frame after mount can measure zero and `min` would come out 0.
     *
     * The wheel listener is attached down at the bottom of this same function for the same reason —
     * see the comment there. Anything that needs the stage *node* has to wait here.
     */
    function setup() {
      const stage = stageRef.current;
      const canvas = imageRef.current;
      const viewport = stage?.clientWidth ?? 0;

      if (!stage || !canvas || !viewport) {
        frame = requestAnimationFrame(setup);
        return;
      }

      // Setting `width` also clears the canvas, so this has to precede the draw.
      canvas.width = bitmap!.width;
      canvas.height = bitmap!.height;
      canvas.getContext("2d")?.drawImage(bitmap!, 0, 0);

      // "Cover, not contain" — the larger of the two ratios is the scale at which neither axis
      // leaves a gap. Then centre.
      const min = Math.max(viewport / bitmap!.width, viewport / bitmap!.height);

      view.current = { scale: min, min, x: (viewport - bitmap!.width * min) / 2, y: (viewport - bitmap!.height * min) / 2 };
      setZoom(1);
      apply();

      /**
       * ⚠ Wheel zoom is attached **here**, inside the retry loop, and not from an effect of its own.
       * That is not tidiness — an effect of its own is how this was written and it never ran.
       *
       * It read `stageRef.current`, found the portal's null on the commit where `open` flips true
       * (the hazard above), and attached nothing. With no dependency array it would re-attach on any
       * later render — but the only state write left after that point is this function's
       * `setZoom(1)`, and `zoom` is already 1, so React bails out eagerly, schedules no render, and
       * fires no effect. Scroll-to-zoom silently did nothing until the slider had been dragged once,
       * while `DialogDescription` promised it worked.
       *
       * Native and non-passive, because React's `onWheel` is passive: `preventDefault()` in it is
       * ignored, so the page scrolls behind the dialog while you zoom.
       */
      function onWheel(event: WheelEvent) {
        event.preventDefault();

        // `stage!` in the spirit of `bitmap!` above: the guard narrowed it, but this is a hoisted
        // function *declaration*, so TypeScript will not carry that narrowing in — the `() =>`
        // detach below keeps it. The handler cannot fire before the guard passed either way.
        const box = stage!.getBoundingClientRect();
        zoomTo(view.current.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX - box.left, event.clientY - box.top);
      }

      stage.addEventListener("wheel", onWheel, { passive: false });
      detachWheel = () => stage.removeEventListener("wheel", onWheel);
    }

    setup();

    // Closing sets `bitmap` to null, which re-runs this effect and so runs this: the pending frame is
    // cancelled in case the dialog closed while still retrying, and the listener is detached from the
    // node it was attached to — which the portal is about to discard anyway, but the pair stays
    // symmetrical rather than relying on that.
    return () => {
      cancelAnimationFrame(frame);
      detachWheel?.();
      clearTimeout(guideTimer.current);
    };
  }, [bitmap, apply, zoomTo]);

  /** Viewport geometry → source-pixel rectangle. The whole point of the widget. */
  function sourceRect(): CropRect {
    const viewport = stageRef.current?.clientWidth ?? 0;

    return {
      sx: Math.round(-view.current.x / view.current.scale),
      sy: Math.round(-view.current.y / view.current.scale),
      size: Math.round(viewport / view.current.scale),
    };
  }

  // Pointer events rather than mouse events. /admin is desktop-only by route (decision 28), but
  // that is a layout decision — hard-coding it into the event names would make it a code one too,
  // and a trackpad, a pen and a touchscreen all speak this API.
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  function onPointerDown(event: React.PointerEvent) {
    dragging.current = true;
    last.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    showGuides(true);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!dragging.current) return;

    view.current.x += event.clientX - last.current.x;
    view.current.y += event.clientY - last.current.y;
    last.current = { x: event.clientX, y: event.clientY };

    clamp();
    apply();
  }

  function onPointerUp(event: React.PointerEvent) {
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    showGuides(false);
  }

  /**
   * Arrow keys pan, Shift pans further. Without this there is **no keyboard route to a framing at
   * all**: the `Slider` gives keyboard zoom, but zoom is anchored on the viewport centre, so a
   * keyboard-only user can only ever confirm whatever the initial centred "cover" fit happened to
   * catch — an off-centre subject is unreachable.
   *
   * It ends exactly as `onPointerMove` does — add to `view.current`, then `clamp()` and `apply()`.
   * Sharing that one clamp is what makes it impossible for a key press to push the image off the
   * square; a bounds check written again here would be a second thing to keep in step with the
   * first. Writing to the ref rather than to state keeps the paint imperative, as everywhere else.
   *
   * The arrows move the *photo*, so a press does what dragging that direction does rather than the
   * inverse. `preventDefault()` on the four handled keys only: arrows scroll the dialog otherwise,
   * so the photo would move and the page would slide out from under it. Tab and Escape are
   * untouched, which is what keeps the dialog escapable.
   */
  function onKeyDown(event: React.KeyboardEvent) {
    const step = event.shiftKey ? PAN_STEP_COARSE : PAN_STEP;
    const pan: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };

    const delta = pan[event.key];
    if (!delta) return;

    event.preventDefault();

    view.current.x += delta[0];
    view.current.y += delta[1];

    clamp();
    apply();

    // Same grid a drag gets, on its own timer — see GUIDE_LINGER_MS. Without this the keyboard route
    // to a framing would be the one route with no composition help, which is the gap this handler
    // exists to close in the first place.
    showGuides(true);
    showGuides(false, GUIDE_LINGER_MS);
  }

  return (
    <Dialog open={bitmap !== null} onOpenChange={(open) => (open ? null : onCancel())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Frame the photo</DialogTitle>
          {/* Names the arrow keys, because a control nobody can see is a control nobody uses — and
              because the wheel and the keys are the two things here that are not self-evident from
              the photo sitting under a grab cursor. */}
          <DialogDescription>Drag or use the arrow keys to move — hold Shift for bigger steps. Scroll or use the slider to zoom. What you see is exactly what gets saved.</DialogDescription>
        </DialogHeader>

        {/* Focusable, with a role and a name, so the arrow-key pan is reachable: a bare `div` is
            `role="generic"`, on which `aria-label` is not exposed, so `tabIndex` alone would give a
            keyboard user a focus stop that announces nothing. */}
        <div
          ref={stageRef}
          role="group"
          aria-label="Photo framing — arrow keys move the photo, Shift for bigger steps"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragging.current = false;
            showGuides(false);
          }}
          onKeyDown={onKeyDown}
          className="group relative aspect-square w-full cursor-grab overflow-hidden rounded-xl bg-foreground/5 ring-ring/50 select-none focus-visible:ring-3 focus-visible:outline-hidden active:cursor-grabbing"
        >
          {/* No `transform` in this style object on purpose — it is written imperatively by
              `apply()` above, which is what keeps a drag from re-rendering the dialog per frame. */}
          <canvas ref={imageRef} style={{ transformOrigin: "top left" }} className="pointer-events-none absolute top-0 left-0 max-w-none" />

          {/* The rule-of-thirds grid, after the canvas so it paints over it. White rather than a
              semantic token, and this is the one place that is right: it sits on a photograph, not
              on the page, so it has to read against whatever the user uploaded rather than against
              the theme.

              The drop shadow is what makes that true rather than nearly true. White alone is what
              the prototype used, against a dark stage — over a bright photo, which half of these
              are, it disappears exactly where the subject is. A 1px dark shadow under each line
              gives every one of them something to sit against, at both ends of the range, without
              the lines needing to be opaque enough to fence in the photo they are helping frame.

              `aria-hidden` because it says nothing a screen reader can act on; the framing itself is
              announced by the group. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 drop-shadow-[0_0_1px_rgb(0_0_0/0.7)] transition-opacity duration-150 group-data-[moving=true]:opacity-100">
            <span className="absolute inset-y-0 left-1/3 w-px bg-white/70" />
            <span className="absolute inset-y-0 left-2/3 w-px bg-white/70" />
            <span className="absolute inset-x-0 top-1/3 h-px bg-white/70" />
            <span className="absolute inset-x-0 top-2/3 h-px bg-white/70" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ZoomOut className="size-4 shrink-0 text-muted-foreground" />
          <Slider
            aria-label="Zoom"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={[zoom]}
            onValueChange={([value]) => {
              // Anchored on the centre of the viewport, since a slider has no cursor position to
              // zoom toward.
              const half = (stageRef.current?.clientWidth ?? 0) / 2;
              zoomTo(view.current.min * value, half, half);
            }}
          />
          <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onConfirm(sourceRect())}>
            Use this crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
