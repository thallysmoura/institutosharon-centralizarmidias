/** Domínios de e-mail descartável (temporário): não servem para verificar identidade. */
const DESCARTAVEIS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com',
  'trashmail.com', 'getnada.com', 'sharklasers.com', 'throwawaymail.com', 'maildrop.cc', 'dispostable.com', 'fakeinbox.com', 'mintemail.com',
  'mohmal.com', 'emailondeck.com', 'tempail.com', 'burnermail.io', 'spam4.me', 'grr.la', 'mailnesia.com',
]);

export const dominioDescartavel = (email: string) => DESCARTAVEIS.has(email.split('@')[1]?.toLowerCase() ?? '');

const COMUNS = ['12345678', '123456789', '1234567890', 'password', 'password1', 'senha123', 'senha1234', 'qwerty123', 'abc12345', 'abcd1234', 'a1234567', 'admin123', 'iloveyou1', 'mudar123', 'senha@123'];

/** Motivo de a senha ser fraca (comum ou derivada dos dados da pessoa), ou null se aceitável. */
export function senhaFraca(senha: string, email: string, nome: string): string | null {
  const s = senha.toLowerCase();
  if (COMUNS.includes(s)) return 'Esta senha é muito comum. Escolha outra mais difícil de adivinhar.';
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (local.length >= 4 && s.includes(local)) return 'A senha não pode conter o seu e-mail.';
  for (const p of nome.toLowerCase().split(/\s+/)) if (p.length >= 4 && s.includes(p)) return 'A senha não pode conter o seu nome.';
  if (/^(.)\1+$/.test(s)) return 'Evite repetir o mesmo caractere.';
  return null;
}

/** Limitador simples em memória: no máximo `max` eventos por chave a cada `janelaMs`. */
const eventos = new Map<string, number[]>();
export function excedeu(chave: string, max: number, janelaMs: number): boolean {
  const agora = Date.now();
  const lista = (eventos.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  if (lista.length >= max) {
    eventos.set(chave, lista);
    return true;
  }
  lista.push(agora);
  eventos.set(chave, lista);
  return false;
}
