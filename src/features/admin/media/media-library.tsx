"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminI18n } from "@/features/admin/i18n/client";
import { ActionMessage, idle, SubmitButton, type ActionResult } from "@/features/admin/ui/form";
import { adminButton, Badge, EmptyState, Field, Select, TextInput } from "@/features/admin/ui/primitives";
import { deleteMedia, prepareUpload, registerUpload, updateAlt } from "./actions";
import { imageTypes, MAX_UPLOAD_BYTES, mediaFolders } from "./validation";

export type LibraryAsset = {
  id: string;
  url: string;
  bucket: string;
  path: string;
  altAr: string;
  altEn: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  usage: string[];
};

const accept = Object.keys(imageTypes).join(",");

// Uploads one file: signed URL from the server → direct upload → server
// verification and registration.
async function uploadOne(file: File, folder: string, locale: string, replaceId?: string): Promise<ActionResult> {
  const prepared = await prepareUpload({ locale, folder, type: file.type, size: file.size });
  if (prepared.status === "error") return { status: "error", message: prepared.message };
  const supabase = createClient();
  const { error } = await supabase.storage.from("media").uploadToSignedUrl(prepared.path, prepared.token, file, {
    contentType: file.type,
  });
  if (error) return { status: "error", message: error.message };
  const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 200);
  return registerUpload({ locale, path: prepared.path, altAr: "", altEn: name, replaceId });
}

function Uploader() {
  const { locale, t } = useAdminI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<string>("library");
  const [messages, setMessages] = useState<ActionResult[]>([]);
  const [pending, startTransition] = useTransition();

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    startTransition(async () => {
      const results: ActionResult[] = [];
      for (const file of list) {
        if (!(file.type in imageTypes)) results.push({ status: "error", message: `${file.name}: ${t.media.badType}` });
        else if (file.size > MAX_UPLOAD_BYTES) results.push({ status: "error", message: `${file.name}: ${t.media.tooLarge}` });
        else {
          const result = await uploadOne(file, folder, locale);
          results.push({ ...result, message: `${file.name}: ${result.message ?? ""}` });
        }
      }
      setMessages(results);
      if (input.current) input.current.value = "";
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-dashed border-gold/50 bg-canvas p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Field label={t.media.folder} htmlFor="media-folder" className="sm:w-48">
          <Select id="media-folder" value={folder} onChange={(e) => setFolder(e.target.value)}>
            {mediaFolders.map((f) => (
              <option key={f} value={f}>
                {t.media.folders[f]}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <input
            ref={input}
            id="media-upload"
            type="file"
            accept={accept}
            multiple
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
            disabled={pending}
          />
          <label htmlFor="media-upload" className={adminButton("primary") + (pending ? " pointer-events-none opacity-60" : " cursor-pointer")}>
            {pending ? t.media.uploading : t.media.upload}
          </label>
        </div>
        <p className="text-[0.78rem] text-ink-soft sm:ms-auto sm:max-w-xs">{t.media.body}</p>
      </div>
      {messages.length ? (
        <ul className="mt-4 space-y-2" aria-live="polite">
          {messages.map((m, i) => (
            <li key={i}>
              <ActionMessage state={m} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AssetCard({ asset, usageLabels }: { asset: LibraryAsset; usageLabels: Record<string, string> }) {
  const { locale, t } = useAdminI18n();
  const router = useRouter();
  const [altState, altAction] = useActionState<ActionResult, FormData>(updateAlt, idle);
  const [deleteState, deleteAction] = useActionState<ActionResult, FormData>(deleteMedia, idle);
  const [replaceState, setReplaceState] = useState<ActionResult>(idle);
  const [replacing, startReplace] = useTransition();
  const isStatic = asset.bucket === "static";

  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-ink/10 bg-canvas">
      <div className="relative bg-beige">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.url} alt={(locale === "ar" ? asset.altAr : asset.altEn) || ""} className="aspect-square w-full object-contain" />
        <div className="absolute start-2 top-2 flex flex-wrap gap-1">
          {isStatic ? <Badge tone="gold">{t.media.siteAsset}</Badge> : null}
          <Badge tone={asset.usage.length ? "success" : "neutral"}>{asset.usage.length ? t.media.inUse : t.media.unused}</Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <p className="text-[0.72rem] text-ink-soft" dir="ltr">
          {asset.width && asset.height ? `${asset.width}×${asset.height}` : ""}
          {asset.sizeBytes ? ` · ${Math.round(asset.sizeBytes / 1024)} KB` : ""}
        </p>
        {asset.usage.length ? (
          <p className="text-[0.75rem] text-ink-soft">{asset.usage.map((u) => usageLabels[u] ?? u).join(" · ")}</p>
        ) : null}
        <form action={altAction} className="space-y-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="entity_id" value={asset.id} />
          <Field label={t.media.altAr} htmlFor={`alt-ar-${asset.id}`}>
            <TextInput id={`alt-ar-${asset.id}`} name="alt_ar" dir="rtl" lang="ar" defaultValue={asset.altAr} maxLength={200} />
          </Field>
          <Field label={t.media.altEn} htmlFor={`alt-en-${asset.id}`}>
            <TextInput id={`alt-en-${asset.id}`} name="alt_en" dir="ltr" lang="en" defaultValue={asset.altEn} maxLength={200} />
          </Field>
          <SubmitButton size="sm" tone="outline">
            {t.common.save}
          </SubmitButton>
          <ActionMessage state={altState} />
        </form>
        {isStatic ? (
          <p className="mt-auto text-[0.72rem] text-ink-soft">{t.media.siteAssetHint}</p>
        ) : (
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-ink/8 pt-3">
            <label className={adminButton("ghost", "sm") + " cursor-pointer"}>
              {replacing ? t.media.uploading : t.media.replace}
              <input
                type="file"
                accept={accept}
                className="sr-only"
                disabled={replacing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  startReplace(async () => {
                    const folder = asset.path.split("/")[0];
                    setReplaceState(await uploadOne(file, folder, locale, asset.id));
                    router.refresh();
                  });
                }}
              />
            </label>
            {asset.usage.length === 0 ? (
              <form
                action={deleteAction}
                onSubmit={(event) => {
                  if (!window.confirm(t.media.deleteConfirm)) event.preventDefault();
                }}
              >
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="entity_id" value={asset.id} />
                <SubmitButton size="sm" tone="danger">
                  {t.common.delete}
                </SubmitButton>
              </form>
            ) : null}
            <ActionMessage state={deleteState.status !== "idle" ? deleteState : replaceState} />
          </div>
        )}
      </div>
    </li>
  );
}

export function MediaLibrary({ assets, usageLabels }: { assets: LibraryAsset[]; usageLabels: Record<string, string> }) {
  const { t } = useAdminI18n();
  return (
    <div className="space-y-6">
      <Uploader />
      {assets.length === 0 ? (
        <EmptyState title={t.media.emptyTitle} body={t.media.emptyBody} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} usageLabels={usageLabels} />
          ))}
        </ul>
      )}
    </div>
  );
}
