"use client";

import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { removeAvatar, updateName, uploadAvatar } from "@/server/actions/profile";

const AVATAR_SIZE = 256;

// Crops to a centred square, scales to 256px and encodes as JPEG in the
// browser, so uploads stay small (typically 15–40 KB).
async function toAvatarJpeg(file: File) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

export function ProfileForm({
  initialName,
  image,
  email,
  welcome,
}: {
  initialName: string;
  image: string | null;
  email: string;
  welcome: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [preview, setPreview] = useState(image);
  const [busy, setBusy] = useState<"photo" | "save" | null>(null);

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error("Choose an image file.");
    setBusy("photo");
    startTransition(async () => {
      try {
        const data = await toAvatarJpeg(file);
        setPreview(`data:image/jpeg;base64,${data}`);
        const result = await uploadAvatar({ data, contentType: "image/jpeg" });
        if ("error" in result) toast.error(result.error);
        else toast.success("Profile picture updated.");
      } catch {
        toast.error("Couldn't use that image. Try a JPEG or PNG.");
      } finally {
        setBusy(null);
        if (fileInput.current) fileInput.current.value = "";
      }
    });
  }

  function dropPhoto() {
    setBusy("photo");
    startTransition(async () => {
      const result = await removeAvatar();
      if ("error" in result) toast.error(result.error);
      else setPreview(null);
      setBusy(null);
    });
  }

  function save() {
    setBusy("save");
    startTransition(async () => {
      const result = await updateName({ name });
      setBusy(null);
      if ("error" in result) return void toast.error(result.error);
      toast.success("Profile saved.");
      router.push("/");
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-5"
    >
      <div className="flex items-center gap-4">
        <span className="relative">
          <Avatar name={name || email} image={preview} className="size-20 text-xl ring-4 ring-primary/15" />
          {busy === "photo" && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40">
              <Loader2 className="size-5 animate-spin text-white" />
            </span>
          )}
        </span>
        <div className="flex flex-col items-start gap-1.5">
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          <Button type="button" size="sm" variant="secondary" onClick={() => fileInput.current?.click()} disabled={!!busy}>
            <Camera className="size-4" /> {preview ? "Change photo" : "Add a photo"}
          </Button>
          {preview && (
            <button type="button" onClick={dropPhoto} disabled={!!busy} className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger">
              <Trash2 className="size-3.5" /> Remove photo
            </button>
          )}
        </div>
      </div>

      <label className="block text-sm font-medium">
        Your name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="How should the team see you?"
          maxLength={80}
          autoComplete="name"
          className="mt-1.5 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </label>
      <p className="-mt-3 text-xs text-muted">Signed in as {email}</p>

      <div className="flex items-center justify-between gap-3 pt-1">
        {welcome ? (
          <button type="button" onClick={() => router.push("/")} className="text-sm text-muted hover:text-foreground">
            Skip for now
          </button>
        ) : (
          <button type="button" onClick={() => router.push("/")} className="text-sm text-muted hover:text-foreground">
            Back to the app
          </button>
        )}
        <Button type="submit" disabled={!!busy}>
          {busy === "save" && <Loader2 className="size-4 animate-spin" />} {welcome ? "Save and continue" : "Save"}
        </Button>
      </div>
    </form>
  );
}
