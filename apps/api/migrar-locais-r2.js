/* Migra fotos gravadas no disco local (antes do R2) para o Cloudflare R2, gerando miniatura e métricas. Uso: node migrar-locais-r2.js */
require('dotenv').config?.();
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const s3 = new S3Client({ region: 'auto', endpoint: env.S3_ENDPOINT, credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } });
const pool = new Pool({ connectionString: env.DATABASE_URL, options: '-c search_path=sistema,public' });
const put = (Key, Body) => s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: env.S3_PREFIX + Key, Body, ContentType: 'image/webp', CacheControl: 'private, max-age=31536000, immutable' }));

(async () => {
  const { rows } = await pool.query('SELECT id, storage_key FROM sistema.fotos ORDER BY id');
  let ops = 0;
  for (const f of rows) {
    const arq = path.resolve(env.STORAGE_LOCAL_DIR || './storage', f.storage_key);
    if (!fs.existsSync(arq)) { console.log('sem arquivo local, ignorado:', f.id); continue; }
    const buf = fs.readFileSync(arq);
    const img = sharp(buf).rotate();
    const meta = await img.clone().metadata();
    const thumb = await img.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
    const tk = f.storage_key.replace(/\.webp$/, '-t.webp');
    await put(f.storage_key, buf);
    await put(tk, thumb);
    await pool.query('UPDATE sistema.fotos SET thumb_key=$2, bytes=$3, thumb_bytes=$4, width=$5, height=$6 WHERE id=$1', [f.id, tk, buf.length, thumb.length, meta.width, meta.height]);
    ops += 2;
    console.log('migrada foto', f.id);
  }
  if (ops) await pool.query("INSERT INTO sistema.r2_uso (mes, classe_a) VALUES (to_char(now(),'YYYY-MM'), $1) ON CONFLICT (mes) DO UPDATE SET classe_a = sistema.r2_uso.classe_a + $1", [ops]);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
