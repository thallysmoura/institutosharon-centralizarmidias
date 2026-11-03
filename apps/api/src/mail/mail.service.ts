import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import sharp from 'sharp';
import { HEADER_JPG_BASE64, ICONE_PINO_PNG_BASE64, ICONE_RELOGIO_PNG_BASE64 } from './assets';
import { emailPin } from './mail.templates';

/** Envio de e-mails por SMTP (Gmail com senha de app). `MAIL_MODE=log` apenas registra a mensagem no log (desenvolvimento/testes). */
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  private transport?: nodemailer.Transporter;

  constructor(private readonly cfg: ConfigService) {}

  private get from() {
    return this.cfg.get<string>('MAIL_FROM') ?? `Instituto Sharon <${this.cfg.get('SMTP_USER')}>`;
  }

  private tx() {
    if (!this.transport) {
      const user = this.cfg.get<string>('SMTP_USER');
      const pass = this.cfg.get<string>('SMTP_PASS');
      if (!user || !pass) throw new ServiceUnavailableException('O envio de e-mail não está configurado.');
      this.transport = nodemailer.createTransport({ host: this.cfg.get('SMTP_HOST', 'smtp.gmail.com'), port: Number(this.cfg.get('SMTP_PORT', 465)), secure: Number(this.cfg.get('SMTP_PORT', 465)) === 465, auth: { user, pass } });
    }
    return this.transport;
  }

  async enviar(para: string, assunto: string, html: string, texto: string, anexos: nodemailer.SendMailOptions['attachments'] = []) {
    if (this.cfg.get('MAIL_MODE') === 'log') {
      this.log.warn(`[MAIL_MODE=log] para=${para} | ${assunto} | ${texto}`);
      return;
    }
    try {
      await this.tx().sendMail({
        from: this.from, to: para, subject: assunto, html, text: texto,
        attachments: anexos,
      });
    } catch (e) {
      this.log.error(`Falha ao enviar e-mail: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Não foi possível enviar o e-mail agora. Tente novamente em instantes.');
    }
  }

  /** Foto de perfil em círculo com aro dourado (PNG). Sem foto, usa a inicial do nome. */
  private async avatar(foto: Buffer | null, nome: string) {
    const S = 200;
    const aro = 7;
    const I = S - aro * 2;
    const base = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6cc7a"/><stop offset="1" stop-color="#a67c26"/></linearGradient></defs><circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}" fill="url(#g)"/></svg>`);
    const inicial = (nome.trim()[0] ?? 'S').toUpperCase().replace(/[<>&]/g, '');
    let interno: Buffer;
    if (foto) {
      try {
        interno = await sharp(foto, { failOn: 'none' }).rotate().resize(I, I, { fit: 'cover', position: 'attention' }).png().toBuffer();
      } catch {
        foto = null;
        interno = Buffer.alloc(0);
      }
    } else interno = Buffer.alloc(0);
    if (!foto) interno = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${I}" height="${I}"><rect width="${I}" height="${I}" fill="#f6efe0"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-size="${I * 0.5}" font-weight="700" fill="#a67c26">${inicial}</text></svg>`)).png().toBuffer();
    const recorte = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${I}" height="${I}"><circle cx="${I / 2}" cy="${I / 2}" r="${I / 2}" fill="#fff"/></svg>`);
    const circulo = await sharp(interno).composite([{ input: recorte, blend: 'dest-in' }]).png().toBuffer();
    return sharp(base).composite([{ input: circulo, left: aro, top: aro }]).png().toBuffer();
  }

  /** E-mail com o PIN de 4 dígitos para confirmar a troca de e-mail, na identidade visual do Instituto e com a foto de perfil do usuário. */
  async enviarPin(para: string, nome: string, pin: string, foto: Buffer | null = null, tipo: 'email' | 'senha' | 'cadastro' = 'email') {
    const html = emailPin({ nome, pin, appUrl: this.cfg.get<string>('APP_URL'), ano: new Date().getFullYear(), validadeMin: 10, tipo });
    const inline = (filename: string, content: Buffer, cid: string) => ({ filename, content, cid, contentDisposition: 'inline' as const });
    const anexos = [
      inline('instituto-sharon.jpg', Buffer.from(HEADER_JPG_BASE64, 'base64'), 'header-sharon'),
      inline('foto-perfil.png', await this.avatar(foto, nome), 'foto-perfil'),
      inline('relogio.png', Buffer.from(ICONE_RELOGIO_PNG_BASE64, 'base64'), 'icone-relogio'),
      inline('local.png', Buffer.from(ICONE_PINO_PNG_BASE64, 'base64'), 'icone-pino'),
    ];
    const nomeCodigo = { email: 'código de confirmação', senha: 'código de recuperação de acesso', cadastro: 'código de verificação de e-mail' }[tipo];
    await this.enviar(para, `${pin} é o seu ${nomeCodigo} - Instituto Sharon`, html, `Instituto Sharon: seu ${nomeCodigo} é ${pin}. Vale por 10 minutos. Não compartilhe este código com ninguém.`, anexos);
  }
}
