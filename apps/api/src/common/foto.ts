import { DbService } from '../db/db.service';
import { StorageService } from '../storage/storage.service';

/** Foto de perfil do usuário (enviada por ele ou do Google) para ilustrar e-mails; nulo se não houver ou se falhar. */
export async function fotoDoUsuario(db: DbService, storage: StorageService, id: number): Promise<Buffer | null> {
  try {
    const r = (await db.query('SELECT foto_key, foto_url FROM sistema.users WHERE id=$1', [id])).rows[0];
    if (r?.foto_key) return await storage.get(r.foto_key);
    if (r?.foto_url) {
      const res = await fetch(String(r.foto_url).replace(/=s\d+-c/, '=s400-c'), { signal: AbortSignal.timeout(4000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    }
  } catch {
    /* segue com a inicial do nome */
  }
  return null;
}
