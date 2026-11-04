import { execSync } from 'node:child_process';
import type { NextConfig } from 'next';

/** Nome do repositório (git remote origin) - identifica o projeto no selo de verificação do gestão-td.
 * Sem .git (build Docker), cai no `name` do package.json raiz. */
function repoName(): string {
  try {
    const url = execSync('git config --get remote.origin.url', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const nome = url.replace(/\.git$/, '').split(/[/:]/).pop();
    if (nome) return nome;
  } catch {
    // sem git/remote: usa o fallback abaixo
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('../../package.json') as { name?: string }).name ?? '';
  } catch {
    return '';
  }
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const API_CSP = API.startsWith('/') ? '' : API; // via proxy (/backend) a API já é 'self'
const dev = process.env.NODE_ENV !== 'production';

/** Cabeçalhos de segurança (anti-XSS, clickjacking, sniffing). O CSP libera só o necessário: API própria, Firebase/Google (login) e imagens assinadas do R2. */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://apis.google.com${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${API_CSP} https://*.googleusercontent.com https://*.r2.cloudflarestorage.com https://*.r2.dev`,
  `media-src 'self' blob: ${API_CSP} https://*.r2.cloudflarestorage.com https://*.r2.dev`,
  "font-src 'self' data:",
  `connect-src 'self' ${API_CSP} https://*.googleapis.com https://*.firebaseapp.com https://*.r2.cloudflarestorage.com${dev ? ' ws://localhost:* http://localhost:*' : ''}`,
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const seguranca = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self), microphone=(self), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' }, // permite o popup do login com Google
  { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // Sem cache: páginas e service worker sempre revalidados (os arquivos /_next/static têm hash no nome e seguem imutáveis).
    const semCache = [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' }];
    return [
      { source: '/((?!__/).*)', headers: seguranca },
      // páginas do Firebase servidas pelo próprio domínio (/__/auth): sem o CSP do app e podendo ser embutidas só por ele mesmo
      { source: '/__/:path*', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }, { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' }] },
      { source: '/((?!_next/static|_next/image).*)', headers: semCache },
    ];
  },
  output: 'standalone',
  reactStrictMode: true,
  // Túnel/preview: com NEXT_PUBLIC_API_URL=/backend a API passa pela mesma origem do site.
  async rewrites() {
    const firebase = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    return [
      ...(API.startsWith('/') ? [{ source: '/backend/:path*', destination: `${process.env.API_PROXY_TARGET ?? 'http://localhost:3001'}/:path*` }] : []),
      ...(firebase ? [{ source: '/__/auth/:path*', destination: `https://${firebase}/__/auth/:path*` }, { source: '/__/firebase/:path*', destination: `https://${firebase}/__/firebase/:path*` }] : []),
    ];
  },

  env: {
    NEXT_PUBLIC_HAM_REPO: repoName(),
  },
};

export default nextConfig;
