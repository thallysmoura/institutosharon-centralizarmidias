import { BadRequestException, Body, ConflictException, HttpCode, HttpException, Controller, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { memoryStorage } from 'multer';
import sharp from 'sharp';
import { DbService } from '../db/db.service';
import { StorageService } from '../storage/storage.service';
import { AllowPendente, AuthGuard, Me, SessionUser } from '../common/auth';
import { fotoDoUsuario } from '../common/foto';

class MatriculaDto {
  @IsString() @MinLength(3) @MaxLength(30) @Matches(/^[A-Za-z0-9._\-/]+$/, { message: 'Use apenas letras, números e - . _ /' }) matricula!: string;
}

class EmailDto {
  @IsEmail() @MaxLength(160) email!: string;
}

class PinDto {
  @IsString() @Matches(/^\d{4}$/, { message: 'O código tem 4 números.' }) pin!: string;
}

const MAX_FOTO = 5 * 1024 * 1024;
const PIN_VALIDADE_MIN = 10;
const PIN_TENTATIVAS = 5;
const PIN_INTERVALO_S = 60;

function imagemValida(b: Buffer) {
  if (b.length < 12) return false;
  return (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) || (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP');
}

/** Perfil do próprio usuário: matrícula (obrigatória no primeiro acesso do aluno) e foto de perfil. */
@Controller()
@UseGuards(AuthGuard)
export class PerfilController {
  constructor(private readonly db: DbService, private readonly storage: StorageService, private readonly mail: MailService, private readonly cfg: ConfigService) {}

  private hashPin(userId: number, pin: string) {
    return createHmac('sha256', this.cfg.getOrThrow<string>('JWT_SECRET')).update(`${userId}:${pin}`).digest('hex');
  }

  /** Passo 1 da troca de e-mail: envia um PIN de 4 dígitos para o NOVO endereço (prova de que a pessoa tem acesso a ele). */
  @Post('perfil/email/solicitar')
  @AllowPendente()
  @HttpCode(200)
  async solicitarEmail(@Me() u: SessionUser, @Body() dto: EmailDto) {
    const novo = dto.email.trim().toLowerCase();
    if (novo === u.email.toLowerCase()) throw new BadRequestException('Este já é o seu e-mail atual.');
    if ((await this.db.query('SELECT 1 FROM sistema.users WHERE lower(email)=$1 AND id<>$2', [novo, u.id])).rowCount) throw new ConflictException('Este e-mail já está em uso por outra conta.');
    const ult = (await this.db.query('SELECT EXTRACT(EPOCH FROM (now()-enviado_em))::int AS seg FROM sistema.pin_email WHERE user_id=$1', [u.id])).rows[0];
    if (ult && ult.seg < PIN_INTERVALO_S) throw new HttpException(`Aguarde ${PIN_INTERVALO_S - ult.seg}s para pedir um novo código.`, 429);
    const pin = String(randomInt(0, 10000)).padStart(4, '0');
    await this.db.query(
      `INSERT INTO sistema.pin_email (user_id, novo_email, pin_hash, expira, tentativas, enviado_em) VALUES ($1,$2,$3, now() + interval '${PIN_VALIDADE_MIN} minutes', 0, now())
       ON CONFLICT (user_id) DO UPDATE SET novo_email=EXCLUDED.novo_email, pin_hash=EXCLUDED.pin_hash, expira=EXCLUDED.expira, tentativas=0, enviado_em=now()`,
      [u.id, novo, this.hashPin(u.id, pin)],
    );
    await this.mail.enviarPin(novo, u.nome, pin, await fotoDoUsuario(this.db, this.storage, u.id));
    return { ok: true, email: novo, validadeMin: PIN_VALIDADE_MIN };
  }

  /** Passo 2: confere o PIN (máx. 5 tentativas, válido por 10 min) e só então troca o e-mail. */
  @Post('perfil/email/confirmar')
  @AllowPendente()
  @HttpCode(200)
  async confirmarEmail(@Me() u: SessionUser, @Body() dto: PinDto) {
    const r = (await this.db.query('SELECT novo_email, pin_hash, tentativas, (expira < now()) AS vencido FROM sistema.pin_email WHERE user_id=$1', [u.id])).rows[0];
    if (!r) throw new BadRequestException('Peça um novo código para alterar o e-mail.');
    if (r.vencido || r.tentativas >= PIN_TENTATIVAS) {
      await this.db.query('DELETE FROM sistema.pin_email WHERE user_id=$1', [u.id]);
      throw new BadRequestException('O código expirou ou excedeu as tentativas. Peça um novo código.');
    }
    if (this.hashPin(u.id, dto.pin) !== r.pin_hash) {
      await this.db.query('UPDATE sistema.pin_email SET tentativas = tentativas + 1 WHERE user_id=$1', [u.id]);
      throw new BadRequestException(`Código incorreto. Restam ${PIN_TENTATIVAS - r.tentativas - 1} tentativa(s).`);
    }
    try {
      await this.db.query('UPDATE sistema.users SET email=$2 WHERE id=$1', [u.id, r.novo_email]);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ConflictException('Este e-mail já está em uso por outra conta.');
      throw e;
    }
    await this.db.query('DELETE FROM sistema.pin_email WHERE user_id=$1', [u.id]);
    return { ok: true, email: r.novo_email };
  }

  @Patch('perfil')
  @AllowPendente()
  async matricula(@Me() u: SessionUser, @Body() dto: MatriculaDto) {
    if (u.role !== 'ALUNO') throw new ForbiddenException();
    try {
      await this.db.query('UPDATE sistema.users SET matricula=$2 WHERE id=$1', [u.id, dto.matricula.trim()]);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ConflictException('Esta matrícula já está em uso por outro aluno.');
      throw e;
    }
    return { ok: true };
  }

  @Post('perfil/foto')
  @AllowPendente()
  @UseInterceptors(FileInterceptor('foto', { storage: memoryStorage(), limits: { fileSize: MAX_FOTO, files: 1 } }))
  async foto(@Me() u: SessionUser, @UploadedFile() f?: Express.Multer.File) {
    if (!f) throw new BadRequestException('Envie uma imagem.');
    if (!imagemValida(f.buffer)) throw new BadRequestException('Formato inválido. Use JPEG, PNG ou WebP.');
    const out = await sharp(f.buffer, { failOn: 'none' }).rotate().resize(512, 512, { fit: 'cover', position: 'attention' }).webp({ quality: 86 }).toBuffer();
    const key = `perfil/${u.id}-${randomUUID()}.webp`;
    await this.storage.put(key, out, 'image/webp');
    await this.db.query('UPDATE sistema.users SET foto_key=$2, foto_v=foto_v+1 WHERE id=$1', [u.id, key]);
    return { ok: true };
  }

  /** A própria foto ou, para o administrador, a foto de qualquer usuário. */
  @Get('users/:id/foto')
  @AllowPendente()
  async ver(@Me() u: SessionUser, @Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    if (u.role !== 'ADMIN' && u.id !== id) throw new NotFoundException();
    const r = (await this.db.query('SELECT foto_key, foto_url FROM sistema.users WHERE id=$1', [id])).rows[0];
    if (!r || (!r.foto_key && !r.foto_url)) throw new NotFoundException();
    res.set({ 'Cache-Control': 'private, max-age=240' });
    if (r.foto_key) {
      const url = await this.storage.urlAssinada(r.foto_key);
      if (url) return res.redirect(302, url);
      res.set({ 'Content-Type': 'image/webp' });
      return res.send(await this.storage.get(r.foto_key));
    }
    return res.redirect(302, r.foto_url);
  }
}
