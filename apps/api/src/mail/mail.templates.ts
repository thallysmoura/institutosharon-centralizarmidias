/** Template do e-mail de PIN: tabelas + CSS inline (Gmail/Outlook/Apple Mail), fluido até 600 px, responsivo por media query,
 *  com a identidade do Instituto (cabeçalho escuro com fita dourada, foto de perfil do usuário, caixas de código e rodapé escuro). */
const GOLD = '#a67c26';
const GOLD_L = '#d9b655';
const INK = '#171512';
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "'Segoe UI',Arial,Helvetica,sans-serif";

const linha = `<td width="20%" style="border-bottom:1px solid ${GOLD_L};height:1px;line-height:1px;font-size:1px">&nbsp;</td>`;

export function emailPin(o: { nome: string; pin: string; appUrl?: string; ano: number; validadeMin: number; tipo?: 'email' | 'senha' | 'cadastro' }) {
  const T = {
    email: { rotulo: 'Confirmação de e-mail', corpo: 'Recebemos um pedido para alterar o e-mail da sua conta no <strong>sistema de fotos clínicas do Instituto Sharon</strong>. Para concluir, digite o código abaixo na tela de confirmação.', rodape: 'Não fez esse pedido? Ignore este e-mail: nenhuma alteração será feita na sua conta.' },
    senha: { rotulo: 'Recuperação de acesso', corpo: 'Recebemos um pedido para <strong>redefinir a senha</strong> da sua conta no <strong>sistema de fotos clínicas do Instituto Sharon</strong>. Para continuar, digite o código abaixo na tela de recuperação.', rodape: 'Não fez esse pedido? Ignore este e-mail: sua senha continua a mesma e nenhuma alteração será feita.' },
    cadastro: { rotulo: 'Verificação de e-mail', corpo: 'Recebemos um pedido de <strong>cadastro</strong> no <strong>sistema de fotos clínicas do Instituto Sharon</strong>. Para verificar este e-mail, digite o código abaixo na tela de cadastro.', rodape: 'Não fez esse pedido? Ignore este e-mail: nenhum cadastro será criado.' },
  }[o.tipo ?? 'email'];
  const primeiro = o.nome.replace(/ \(.*\)$/, '').split(' ')[0].replace(/[<>&"]/g, '');
  const copiar = o.appUrl ? `${o.appUrl.replace(/\/$/, '')}/copiar?c=${o.pin}` : null;
  const digitos = o.pin
    .split('')
    .map((d) => `<td class="dg" width="25%" align="center" style="padding:0 4px"><div style="background:#fbf3df;background-image:linear-gradient(180deg,#fffaf0,#f6e8c4);border:1px solid #e6cc7a;border-radius:14px;box-shadow:0 3px 7px rgba(166,124,38,.20);padding:14px 0;font-family:'Times New Roman',Times,serif;font-size:40px;line-height:40px;font-weight:700;color:#7d5f12">${d}</div></td>`)
    .join('');

  const botao = copiar
    ? `<td class="btn-cell" width="176" align="right" valign="middle" style="padding-left:14px">
         <a href="${copiar}" target="_blank" style="display:block;background:${GOLD};background-image:linear-gradient(180deg,#c9a24a,#9a7220);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:20px;text-align:center;padding:16px 10px;border-radius:999px;box-shadow:0 5px 12px rgba(125,95,18,.35);font-family:${SANS}">Copiar código</a>
       </td>`
    : '';

  return `<!doctype html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>Código de confirmação - Instituto Sharon</title>
<style>
  body{margin:0!important;padding:0!important;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}
  img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
  .code{-webkit-user-select:all;user-select:all}
  @media only screen and (max-width:520px){
    .px{padding-left:20px!important;padding-right:20px!important}
    .code-row .code-cell,.code-row .btn-cell{display:block!important;width:100%!important}
    .code-row .code-cell{padding:0!important}
    .code-row .btn-cell{padding:16px 0 0!important}
    .dg div{font-size:30px!important;padding:12px 0!important}
    h1{font-size:28px!important}
    .avatar{width:64px!important;height:64px!important}
  }
</style></head>
<body style="margin:0;padding:0;background:#f1ede5;font-family:${SANS};color:${INK}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">Seu código de confirmação é ${o.pin}. Válido por ${o.validadeMin} minutos.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1ede5"><tr><td align="center" style="padding:28px 12px">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 18px 40px rgba(23,21,18,.16)">
    <!-- Cabeçalho -->
    <tr><td style="font-size:0;line-height:0;background:${INK}"><img src="cid:header-sharon" width="600" alt="Instituto Sharon - Educação e Saúde" style="display:block;width:100%;height:auto"></td></tr>

    <!-- Rótulo -->
    <tr><td class="px" style="padding:30px 40px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        ${linha}
        <td align="center" style="padding:0 14px;white-space:nowrap;font-size:13px;letter-spacing:.28em;text-transform:uppercase;color:${GOLD};font-weight:700">${T.rotulo}</td>
        ${linha}
      </tr></table>
    </td></tr>

    <!-- Saudação + foto de perfil -->
    <tr><td class="px" style="padding:24px 40px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle">
          <h1 style="margin:0;font-family:${SERIF};font-size:36px;line-height:1.12;font-weight:700;color:${INK}">Olá, ${primeiro}!</h1>
          <div style="width:56px;height:3px;line-height:3px;font-size:0;background:${GOLD};margin-top:12px">&nbsp;</div>
        </td>
        <td width="92" align="right" valign="middle"><img class="avatar" src="cid:foto-perfil" width="84" height="84" alt="Foto de perfil de ${primeiro}" style="display:block;width:84px;height:84px;border-radius:50%"></td>
      </tr></table>
    </td></tr>
    <tr><td class="px" style="padding:18px 40px 0;font-size:16px;line-height:1.65;color:#3c372c">
      ${T.corpo}
    </td></tr>

    <!-- Código + botão -->
    <tr><td class="px" style="padding:26px 40px 0">
      <p style="margin:0 0 12px;font-size:13px;letter-spacing:.24em;text-transform:uppercase;color:${INK};font-weight:800">Seu código</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="code-row"><tr>
        <td class="code-cell" valign="middle">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="code"><tr>${digitos}</tr></table>
        </td>
        ${botao}
      </tr></table>
    </td></tr>

    <!-- Aviso de validade -->
    <tr><td class="px" style="padding:26px 40px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf4e3;border:1px solid #efe1b6;border-radius:14px"><tr>
        <td width="72" align="center" valign="middle" style="padding:14px 0 14px 14px"><img src="cid:icone-relogio" width="44" height="44" alt="" style="display:block;width:44px;height:44px"></td>
        <td width="1" style="padding:14px 0"><div style="width:1px;height:44px;background:#e3d29a;line-height:44px;font-size:0">&nbsp;</div></td>
        <td valign="middle" style="padding:14px 18px;font-size:14px;line-height:1.6;color:#4a4331"><strong style="color:#7d5f12">Válido por ${o.validadeMin} minutos.</strong> Por segurança, não compartilhe este código com ninguém: a equipe do Instituto nunca pedirá esse número.</td>
      </tr></table>
    </td></tr>
    <tr><td class="px" align="center" style="padding:18px 40px 32px;font-size:13.5px;line-height:1.6;color:#5f594a">${T.rodape}</td></tr>

    <!-- Rodapé -->
    <tr><td style="background:${INK};background-image:linear-gradient(180deg,#1d1912,#12100b);padding:30px 24px 26px;text-align:center">
      <p style="margin:0 0 8px;font-family:${SERIF};font-size:20px;letter-spacing:.34em;color:#ffffff">INSTITUTO SHARON</p>
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 16px"><tr>
        <td width="46" style="border-bottom:1px solid ${GOLD_L};height:1px;line-height:1px;font-size:1px">&nbsp;</td>
        <td style="padding:0 12px;font-size:12px;letter-spacing:.3em;color:${GOLD_L};font-weight:700">EDUCAÇÃO E SAÚDE</td>
        <td width="46" style="border-bottom:1px solid ${GOLD_L};height:1px;line-height:1px;font-size:1px">&nbsp;</td>
      </tr></table>
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 18px"><tr>
        <td valign="middle" style="padding-right:8px"><img src="cid:icone-pino" width="22" height="22" alt="" style="display:block;width:22px;height:22px"></td>
        <td valign="middle" style="font-size:13px;line-height:1.5;color:#e6e0cf">Manaus &nbsp;&bull;&nbsp; Fortaleza &nbsp;&bull;&nbsp; Porto Velho &nbsp;&bull;&nbsp; São Paulo</td>
      </tr></table>
      <div style="height:1px;line-height:1px;font-size:1px;background:#4b3d1c;margin:0 30px 16px">&nbsp;</div>
      <p style="margin:0;font-size:12px;line-height:1.7;color:#a39d8a">Mensagem automática, por favor não responda a este e-mail.<br>&copy; ${o.ano} Instituto Sharon. Todos os direitos reservados.</p>
    </td></tr>
  </table>

</td></tr></table>
</body></html>`;
}
