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
 * The 1:1 crop picker. Drag to position, wheel or slider to zoom, confirm to get a source
 * rectangle back.
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
   * Paint and fit, on the bitmap rather than on mount — the dialog is handed a new photo each time
   * it opens.
   *
   * The bitmap goes onto a canvas rather than into an `<img>`, because an `ImageBitmap` has no URL
   * and making one with `createObjectURL` would reintroduce the raw-file path this component
   * exists to avoid. Drawn at natural size and positioned by transform, so the browser scales it.
   */
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = imageRef.current;
    if (!stage || !canvas || !bitmap) return;

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);

    // The dialog animates in, so the first frame after mount can measure zero. Retrying on the
    // next frame is cheaper than a ResizeObserver for a box that is square by construction.
    let frame = 0;

    function fit() {
      const viewport = stage!.clientWidth;

      if (!viewport) {
        frame = requestAnimationFrame(fit);
        return;
      }

      // "Cover, not contain" — the larger of the two ratios is the scale at which neither axis
      // leaves a gap. Then centre.
      const min = Math.max(viewport / bitmap!.width, viewport / bitmap!.height);

      view.current = { scale: min, min, x: (viewport - bitmap!.width * min) / 2, y: (viewport - bitmap!.height * min) / 2 };
      setZoom(1);
      apply();
    }

    fit();

    return () => cancelAnimationFrame(frame);
  }, [bitmap, apply]);

  /** Viewport geometry → source-pixel rectangle. The whole point of the widget. */
  function sourceRect(): CropRect {
    const viewport = stageRef.current?.clientWidth ?? 0;

    return {
      sx: Math.round(-view.current.x / view.current.scale),
      sy: Math.round(-view.current.y / view.current.scale),
      size: Math.round(viewport / view.current.scale),
    };
  }

  /** Zoom anchored on a point, so whatever is under the cursor stays under it. */
  function zoomTo(next: number, cx: number, cy: number) {
    const { min, scale } = view.current;
    const bounded = Math.max(min, Math.min(min * MAX_ZOOM, next));
    const ratio = bounded / scale;

    view.current.x = cx - (cx - view.current.x) * ratio;
    view.current.y = cy - (cy - view.current.y) * ratio;
    view.current.scale = bounded;

    clamp();
    apply();
    setZoom(bounded / min);
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
  }

  // Attached as a native non-passive listener: React's onWheel is passive, so preventDefault() in
  // it is ignored and the page scrolls behind the dialog while you zoom.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();

      const box = stage!.getBoundingClientRect();
      zoomTo(view.current.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX - box.left, event.clientY - box.top);
    }

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  });

  return (
    <Dialog open={bitmap !== null} onOpenChange={(open) => (open ? null : onCancel())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Frame the photo</DialogTitle>
          <DialogDescription>Drag to move, scroll or use the slider to zoom. What you see is exactly what gets saved.</DialogDescription>
        </DialogHeader>

        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragging.current = false)}
          className="relative aspect-square w-full cursor-grab overflow-hidden rounded-xl bg-foreground/5 select-none active:cursor-grabbing"
        >
          {/* No `transform` in this style object on purpose — it is written imperatively by
              `apply()` above, which is what keeps a drag from re-rendering the dialog per frame. */}
          <canvas ref={imageRef} style={{ transformOrigin: "top left" }} className="pointer-events-none absolute top-0 left-0 max-w-none" />
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
