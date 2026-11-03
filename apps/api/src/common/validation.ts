import { BadRequestException, ValidationError } from '@nestjs/common';

/** Traduz as mensagens padrão (em inglês) do class-validator para português, no padrão do sistema. */
export function traduz(msg: string): string {
  const m = (re: RegExp) => msg.match(re);
  if (/must be an email/i.test(msg)) return 'Digite um e-mail válido.';
  if (/should not be empty/i.test(msg)) return 'Preencha este campo.';
  const min = m(/longer than or equal to (\d+) characters/i);
  if (min) return `Use pelo menos ${min[1]} caracteres.`;
  const max = m(/shorter than or equal to (\d+) characters/i);
  if (max) return `Use no máximo ${max[1]} caracteres.`;
  if (/must be a string/i.test(msg)) return 'Valor inválido.';
  if (/must be a number|must be an integer/i.test(msg)) return 'Informe um número válido.';
  if (/must not be greater than|must not be less than/i.test(msg)) return 'Valor fora do intervalo permitido.';
  if (/must be one of the following values/i.test(msg)) return 'Opção inválida.';
  if (/should not exist/i.test(msg)) return 'Campo não permitido.';
  return msg;
}

export const exceptionFactory = (erros: ValidationError[]) =>
  new BadRequestException(erros.flatMap((e) => Object.values(e.constraints ?? {})).map(traduz));
