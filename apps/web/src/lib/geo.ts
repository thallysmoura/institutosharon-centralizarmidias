import { api, Cidade } from './api';

export const CHAVE_CIDADE = 'sharon_cidade_id';
export const RAIO_KM = 150;

/** Distância em km entre dois pontos [lat, lng] (haversine). */
export const km = (a: [number, number], b: [number, number]) => {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** Cidade cadastrada mais próxima da posição, se estiver dentro do raio. */
export function maisProxima(lista: Cidade[], pos: [number, number]): Cidade | null {
  const p = lista
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => ({ c, d: km(pos, [c.lat as number, c.lng as number]) }))
    .sort((x, y) => x.d - y.d)[0];
  return p && p.d <= RAIO_KM ? p.c : null;
}

/** Pede a localização nativa do navegador (abre o aviso de permissão). */
export const pedirLocalizacao = () =>
  new Promise<[number, number]>((ok, erro) => {
    if (!('geolocation' in navigator)) return erro(new Error('indisponível'));
    navigator.geolocation.getCurrentPosition((p) => ok([p.coords.latitude, p.coords.longitude]), erro, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });

/** Mensagem para o usuário conforme o motivo de a localização não ter sido obtida. */
export function msgLocalizacao(e: unknown) {
  const code = (e as { code?: number }).code;
  if (code === 1)
    return 'A permissão de localização é obrigatória para entrar. Permita o acesso à localização nas configurações do navegador (ícone de cadeado ao lado do endereço) e tente novamente.';
  return 'Não foi possível obter a sua localização. Verifique se o GPS e a conexão estão ativos e tente novamente.';
}
