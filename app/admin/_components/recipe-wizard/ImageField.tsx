"use client";

// import lib
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, RotateCw, TriangleAlert, X } from "lucide-react";
import { publicImageUrl } from "@/lib/supabase/storage";
import { decodeImage, removeImage, uploadCrop } from "./upload";

// import components
import CropDialog from "./CropDialog";
import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle, AttachmentTrigger } from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// import types
import type { CropRect } from "./upload";
import type { StepImage } from "./draft";

/**
 * One photo field, used in both placements — the recipe cover on Details and a step photo on
 * Method. Every difference between them is presentational, so two components would be a drift
 * hazard for no gain (decision 9).
 *
 * A thin wrapper over `components/ui/attachment.tsx`, which already carries the state machine an
 * upload needs. `busy` maps to its `uploading` with one label: it also has a `processing` state,
 * but the two render identically — the same shimmer on the title and nothing else — so telling the
 * canvas work apart from the byte transfer is a distinction the UI never draws (decision 47).
 *
 * **No state about the photo lives here.** The union in the draft is the whole of it, so a failure
 * that lands after this panel has unmounted still has somewhere to go, and a deleted step takes
 * its photo's state with it. What is local is the pending bitmap between picking a file and
 * confirming a crop, which is genuinely transient — Cancel discards it (decision 29).
 */

type Props = {
  value: StepImage;
  onChange: (next: StepImage) => void;

  /** `cover` shows the dashed bar when empty; `step` collapses to a quiet ＋ photo button. */
  variant: "cover" | "step";

  /** What the attachment calls the photo once there is one. Also the file input's accessible name. */
  label: string;
};

/**
 * Answers a second photo offered to a field that is still uploading its first. One string, because
 * both gates below refuse with the same sentence and a refused gesture must not be worded two ways.
 */
const STILL_UPLOADING = "That photo is still uploading. Wait for it to finish, then replace it.";

export default function ImageField({ value, onChange, variant, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  // The decoded source, held only between the file picker closing and the crop being confirmed.
  const [pending, setPending] = useState<ImageBitmap | null>(null);

  // Captured at pick time so a confirmed crop knows what it is replacing. Read here rather than
  // from `value` at confirm time because the draft may have moved on.
  const replacing = useRef<string | undefined>(undefined);

  // Derived, not stored — the union in the draft is still the whole of this field's state.
  const busy = value?.status === "busy";

  async function pick(file: File) {
    // ⚠ **One upload in flight per field, and this is the line that holds it.** Every way of
    // attaching a photo funnels through here: the hidden input's change event and the drop handler
    // below. Two uploads on one field is not a cosmetic race — the field keeps whichever upload
    // *finishes* last, not the crop the user confirmed last. A big photo confirmed first can resolve
    // after a small one confirmed second, and its write-back overwrites it: the field ends up holding
    // the crop that was replaced, while the one the user meant to keep is orphaned in the bucket with
    // nothing reporting it. The step thumbnail is 64px, so nothing looks wrong. `replaceById` keeps a
    // finished path on the right *row*; nothing keeps it from being the wrong *photo*.
    //
    // Closing the entry point, rather than reconciling afterwards: picking a winner needs an upload
    // id per field and still has to delete bytes already paid for. Drop is the only gesture that
    // survives the busy state — ✕ and ↻ are unrendered and `AttachmentTrigger` only exists while
    // `value === null` — but the guard sits here rather than in the drop handler so the sr-only file
    // input, which stays focusable, is covered by the same check.
    if (busy) {
      toast.info(STILL_UPLOADING);
      return;
    }

    replacing.current = value?.status === "done" ? value.path : undefined;

    try {
      setPending(await decodeImage(file));
    } catch {
      // A toast, not the field's error state. The decode fails *before* anything is attached, so
      // an error state would describe a photo that was never accepted and would have to be
      // dismissed by a ✕ with no file behind it. `AttachmentDescription` is `truncate` besides,
      // which would cut the half of this message that says what to do (decision 30).
      toast.error("That photo could not be opened. iPhone HEIC files are not readable in the browser — save it as JPEG first, or share it from Photos rather than from Files.");
    }
  }

  async function confirm(rect: CropRect) {
    const bitmap = pending;
    if (!bitmap) return;

    // The same rule as `pick`, at the gate that actually starts an upload. Unreachable while `pick`
    // is the only way to open the cropper — confirming is what makes the field busy, and it clears
    // `pending` on the way, so busy and a pending bitmap cannot coexist — but a second route into
    // this handler must not be the thing that discovers that. Keeping both gates is what makes the
    // one-upload rule a property of the component rather than of its current call graph.
    if (busy) {
      bitmap.close();
      setPending(null);
      replacing.current = undefined;
      toast.info(STILL_UPLOADING);
      return;
    }

    setPending(null);
    onChange({ status: "busy" });

    try {
      // Uploads the new file before removing the old one — a failure here leaves the original
      // photo intact, where the intuitive order would have already deleted it (decision 24).
      const path = await uploadCrop(bitmap, rect, replacing.current);
      onChange({ status: "done", path });
    } catch (error) {
      // ⚠ Not `uploadErrorMessage(error)` — `uploadCrop` has already mapped it, and mapping twice
      // wraps the written sentence in the raw-message fallback: "The photo could not be uploaded:
      // Your sign-in expired while the photo was uploading…". `AttachmentDescription` is `truncate`,
      // so the useless prefix is what survives and the actionable half is what gets cut, which is
      // the failure decision 30 sent the decode error to a toast to avoid. The mapping lives in
      // exactly one place — `uploadCrop`'s catch — and this line passes its message through.
      onChange({ status: "failed", reason: error instanceof Error ? error.message : String(error) });
    } finally {
      bitmap.close();
      replacing.current = undefined;
    }
  }

  function clear() {
    // The field is cleared whether or not the file goes: an orphaned file is cheap, while a draft
    // still holding a path the user just deleted saves a recipe with an image they removed.
    // `removeImage` never throws, for the same reason.
    if (value?.status === "done") void removeImage(value.path);
    onChange(null);
  }

  const openPicker = () => inputRef.current?.click();

  return (
    <>
      {/* One hidden input serves the trigger, the replace control and the retry — there is no
          cheaper retry to offer, since Cancel and a failed upload both keep nothing. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];

          // Cleared immediately, or picking the *same* file again fires no change event at all —
          // which is exactly what a retry after a failed upload does.
          event.target.value = "";

          if (file) void pick(file);
        }}
      />

      {value === null && variant === "step" ? (
        // Collapsed until used. On a ten-step recipe the always-visible bar turns the Method panel
        // into mostly empty photo slots and the instructions stop being the obvious thing to fill
        // in; collapsed, a thumbnail means "this step has a photo" (decision 17).
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={openPicker}>
          <ImagePlus />
          Add photo
        </Button>
      ) : (
        <Attachment
          state={value === null ? "idle" : value.status === "busy" ? "uploading" : value.status === "failed" ? "error" : "done"}
          // Capped rather than full width: the wizard's panel column is roughly 700px, which would
          // be 94% chrome around the media. The vertical variant is worse — it jumps 96→120px the
          // moment an error message appears and shoves the row sideways (decision 16).
          className="w-full max-w-80"
          // `preventDefault` unconditionally, busy or not, and that is not the same thing as
          // accepting the drop: cancelling `dragover` is what makes this card a drop target at all,
          // and a card that is *not* one hands the file to the browser, which navigates to it and
          // takes the whole unsaved draft with it. A refusal has to happen with the drop still ours
          // to refuse. `dropEffect` is what makes the refusal visible — the cursor turns to "no"
          // over a busy card, so it stops advertising a gesture `pick` will decline.
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = busy ? "none" : "copy";
          }}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];

            // Not guarded here — `pick` refuses while busy, and with a toast, because a swallowed
            // gesture reads as a broken card. Browsers differ on whether `drop` even fires after a
            // `dropEffect` of "none", so this path has to be safe rather than merely unlikely.
            if (file) void pick(file);
          }}
        >
          {/* Bumped up from attachment.tsx's `w-10`, or the photo is not actually visible. */}
          <AttachmentMedia variant="image" className="w-16">
            {value?.status === "done" ? (
              // A plain <img>, and this is the one place in the app that renders a stored photo
              // without next/image. The optimizer earns its place on the article — a 1200px file
              // in a 300px slot, six times a page — but this thumbnail is ~64px, fetched seconds
              // after its own upload and looked at once (decision 48).
              //
              // The bytes come from the bucket rather than from the blob still in memory: it adds
              // no state, survives the panel unmounting for free, and Storage is read-after-write
              // consistent so the object is there the moment `.upload()` resolves (decision 39).
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publicImageUrl(value.path)} alt="" />
            ) : value?.status === "busy" ? (
              <Spinner />
            ) : value?.status === "failed" ? (
              <TriangleAlert />
            ) : (
              <ImagePlus />
            )}
          </AttachmentMedia>

          <AttachmentContent>
            <AttachmentTitle>{value === null ? label : value.status === "busy" ? "Uploading…" : value.status === "failed" ? "Upload failed" : label}</AttachmentTitle>
            <AttachmentDescription>
              {value === null ? "Click or drop a photo" : value.status === "failed" ? value.reason : value.status === "done" ? "Square, ready to publish" : "Cropping and uploading"}
            </AttachmentDescription>
          </AttachmentContent>

          {/* Covers the whole card when there is nothing to click past — defends its own type,
              unlike AttachmentAction below. */}
          {value === null ? <AttachmentTrigger aria-label={label} onClick={openPicker} /> : null}

          {value !== null && value.status !== "busy" ? (
            <AttachmentActions>
              {/* type="button" is not optional. AttachmentAction is a shadcn Button, which sets no
                  type and therefore defaults to submit inside a form. Neither placement sits on
                  the one panel that has a <form> today — but an image field reaching Review would
                  turn "remove this photo" into "publish this recipe". */}
              <AttachmentAction type="button" aria-label={value.status === "failed" ? "Try another photo" : "Replace this photo"} onClick={openPicker}>
                <RotateCw />
              </AttachmentAction>
              <AttachmentAction type="button" aria-label="Remove this photo" onClick={clear}>
                <X />
              </AttachmentAction>
            </AttachmentActions>
          ) : null}
        </Attachment>
      )}

      <CropDialog
        bitmap={pending}
        onConfirm={confirm}
        onCancel={() => {
          pending?.close();
          setPending(null);
          replacing.current = undefined;
        }}
      />
    </>
  );
}
