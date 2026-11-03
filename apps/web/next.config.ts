import { execSync } from 'node:child_process';
import type { NextConfig } from 'next';

/** Nome do repositório (git remote origin) — identifica o projeto no selo de verificação do gestão-td.
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

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,

  env: {
    NEXT_PUBLIC_HAM_REPO: repoName(),
  },
};

export default nextConfig;
