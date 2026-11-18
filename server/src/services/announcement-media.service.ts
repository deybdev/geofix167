import type { AppEnv } from "../types/env";

type Database = AppEnv["Bindings"]["geofix167_db"];
export type AnnouncementMedia = {
  media_id: string;
  announcement_id: string;
  storage_key: string;
  media_type: "PHOTO" | "VIDEO";
  content_type: string;
  byte_size: number;
  original_filename: string;
  created_at: string;
};

export const MAX_ANNOUNCEMENT_MEDIA = 5;

export function publicMediaUrl(announcementId: string, mediaId: string) {
  return `/api/announcements/${encodeURIComponent(announcementId)}/media/${encodeURIComponent(mediaId)}`;
}

export function adminMediaUrl(announcementId: string, mediaId: string) {
  return `/api/admin/announcements/${encodeURIComponent(announcementId)}/media/${encodeURIComponent(mediaId)}`;
}

export function mediaPayload(row: AnnouncementMedia, publicFeed: boolean) {
  return {
    id: row.media_id,
    media_type: row.media_type,
    content_type: row.content_type,
    byte_size: row.byte_size,
    original_filename: row.original_filename,
    created_at: row.created_at,
    url: publicFeed ? publicMediaUrl(row.announcement_id, row.media_id) : adminMediaUrl(row.announcement_id, row.media_id),
  };
}

export async function attachAnnouncementMedia<T extends { id: string }>(db: Database, announcements: T[], publicFeed: boolean) {
  if (!announcements.length) return announcements.map((item) => ({ ...item, media: [] }));
  const ids = announcements.map((item) => item.id);
  const placeholders = ids.map(() => "?").join(", ");
  const result = await db.prepare(`SELECT media_id, announcement_id, storage_key, media_type, content_type, byte_size, original_filename, created_at
    FROM announcement_media WHERE announcement_id IN (${placeholders}) ORDER BY created_at, media_id`)
    .bind(...ids).all<AnnouncementMedia>();
  const grouped = new Map<string, ReturnType<typeof mediaPayload>[]>();
  for (const row of result.results ?? []) {
    const media = grouped.get(row.announcement_id) ?? [];
    media.push(mediaPayload(row, publicFeed));
    grouped.set(row.announcement_id, media);
  }
  return announcements.map((item) => ({ ...item, media: grouped.get(item.id) ?? [] }));
}
