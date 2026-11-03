/* Copia as fotos do bucket antigo (teclive-avatars/InstitutoSharon/) para o bucket do Instituto, sem prefixo.
   Origem via variáveis OLD_* (S3_ENDPOINT, S3_BUCKET, S3_PREFIX, S3_ACCESS_KEY, S3_SECRET_KEY antigas); destino = .env atual.
   Uso: OLD_ENDPOINT=... OLD_BUCKET=... OLD_PREFIX=InstitutoSharon/ OLD_ACCESS_KEY=... OLD_SECRET_KEY=... node migrar-bucket.js */
const fs = require('node:fs');
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const cli = (endpoint, ak, sk) => new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId: ak, secretAccessKey: sk } });
const origem = cli(process.env.OLD_ENDPOINT, process.env.OLD_ACCESS_KEY, process.env.OLD_SECRET_KEY);
const destino = cli(env.S3_ENDPOINT, env.S3_ACCESS_KEY, env.S3_SECRET_KEY);
const OLD_BUCKET = process.env.OLD_BUCKET;
const OLD_PREFIX = process.env.OLD_PREFIX || '';

(async () => {
  let token, copiados = 0;
  do {
    const l = await origem.send(new ListObjectsV2Command({ Bucket: OLD_BUCKET, Prefix: OLD_PREFIX, ContinuationToken: token }));
    for (const o of l.Contents || []) {
      if (o.Key.endsWith('/')) continue; // marcador de pasta criado pelo painel
      const g = await origem.send(new GetObjectCommand({ Bucket: OLD_BUCKET, Key: o.Key }));
      const body = Buffer.from(await g.Body.transformToByteArray());
      const novaChave = (env.S3_PREFIX || '') + o.Key.slice(OLD_PREFIX.length);
      await destino.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: novaChave, Body: body, ContentType: g.ContentType || 'image/webp', CacheControl: 'private, max-age=31536000, immutable' }));
      copiados++;
    }
    token = l.IsTruncated ? l.NextContinuationToken : undefined;
  } while (token);
  console.log(`copiados ${copiados} objetos para ${env.S3_BUCKET}/${env.S3_PREFIX || ''}`);
})().catch((e) => { console.error('ERRO', e.name, e.message); process.exit(1); });
