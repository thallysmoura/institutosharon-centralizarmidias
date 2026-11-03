import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { DbService } from '../db/db.service';

/**
 * Armazenamento privado das fotos: `local` (dev, pasta fora do webroot) ou `s3` (Cloudflare R2).
 * No R2 as chaves ficam sob o prefixo (ex.: InstitutoSharon/) e a leitura é feita por URL assinada de curta duração,
 * gerada só depois de a API checar a permissão — o tráfego das imagens não passa pelo servidor (saída do R2 é gratuita).
 * Cada operação no R2 é contabilizada (Classe A = escrita, Classe B = leitura) para a gestão de limite gratuito.
 */
@Injectable()
export class StorageService {
  readonly driver: 'local' | 's3';
  readonly bucket: string;
  readonly prefix: string;
  private readonly dir: string;
  private s3?: S3Client;

  constructor(cfg: ConfigService, private readonly db: DbService) {
    this.driver = cfg.get('STORAGE_DRIVER', 'local') === 's3' ? 's3' : 'local';
    this.dir = resolve(cfg.get('STORAGE_LOCAL_DIR', './storage'));
    this.bucket = cfg.get('S3_BUCKET', '');
    const p = cfg.get<string>('S3_PREFIX', '');
    this.prefix = p && !p.endsWith('/') ? `${p}/` : p;
    if (this.driver === 's3')
      this.s3 = new S3Client({
        region: cfg.get('S3_REGION', 'auto'),
        endpoint: cfg.getOrThrow('S3_ENDPOINT'),
        credentials: { accessKeyId: cfg.getOrThrow('S3_ACCESS_KEY'), secretAccessKey: cfg.getOrThrow('S3_SECRET_KEY') },
      });
  }

  private path(key: string) {
    const p = resolve(join(this.dir, key));
    if (!p.startsWith(this.dir)) throw new Error('key inválida');
    return p;
  }

  /** Soma operações do mês corrente (somente quando o destino é o R2). */
  private async contar(classe: 'a' | 'b', n = 1) {
    if (!this.s3) return;
    const col = classe === 'a' ? 'classe_a' : 'classe_b';
    await this.db.query(
      `INSERT INTO sistema.r2_uso (mes, ${col}) VALUES (to_char(now(),'YYYY-MM'), $1) ON CONFLICT (mes) DO UPDATE SET ${col} = sistema.r2_uso.${col} + $1`,
      [n],
    ).catch(() => null);
  }

  async put(key: string, body: Buffer, contentType: string) {
    if (this.s3) {
      await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.prefix + key, Body: body, ContentType: contentType, CacheControl: 'private, max-age=31536000, immutable' }));
      await this.contar('a');
      return;
    }
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  }

  /** Remove um único arquivo (best effort: falha de limpeza não quebra a operação). */
  async remove(key: string) {
    try {
      if (this.s3) await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.prefix + key }));
      else await unlink(this.path(key));
    } catch {
      /* já removido ou indisponível */
    }
  }

  async get(key: string): Promise<Buffer> {
    if (this.s3) {
      const r = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.prefix + key }));
      await this.contar('b');
      return Buffer.from(await r.Body!.transformToByteArray());
    }
    return readFile(this.path(key));
  }

  /** URL assinada (5 min) para o navegador buscar direto no R2; `null` no armazenamento local. */
  async urlAssinada(key: string, nomeDownload?: string): Promise<string | null> {
    if (!this.s3) return null;
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: this.prefix + key, ...(nomeDownload ? { ResponseContentDisposition: `attachment; filename="${nomeDownload}"` } : {}) }),
      { expiresIn: 300 },
    );
    await this.contar('b');
    return url;
  }
}
