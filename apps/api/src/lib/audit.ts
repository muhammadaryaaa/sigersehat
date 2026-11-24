import { newId, sha256Hex } from "./crypto";
// Audit log insert-only dengan rantai hash (Tahap 2 REC-07): setiap baris mengikat hash baris sebelumnya.
export async function logAudit(db: D1Database, entry: {
  actorUserId: string | null; actorRole: string; action: string; objectType: string; objectId?: string | null;
  profileId?: string | null; ip?: string | null; userAgent?: string | null;
}): Promise<void> {
  const last = await db.prepare("SELECT entry_hash FROM audit_logs ORDER BY created_at DESC, rowid DESC LIMIT 1").first<{ entry_hash: string }>();
  const prevHash = last?.entry_hash ?? "GENESIS";
  const id = newId("aud");
  const createdAt = new Date().toISOString();
  const content = [id, entry.actorUserId ?? "", entry.action, entry.objectType, entry.objectId ?? "", createdAt].join("|");
  const entryHash = await sha256Hex(prevHash + "|" + content);
  await db.prepare(
    "INSERT INTO audit_logs (id, actor_user_id, actor_role, action, object_type, object_id, profile_id, ip_address, user_agent, prev_hash, entry_hash, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
  ).bind(id, entry.actorUserId, entry.actorRole, entry.action, entry.objectType, entry.objectId ?? null, entry.profileId ?? null, entry.ip ?? null, entry.userAgent ?? null, prevHash, entryHash, createdAt).run();
}
