import { getApps, initializeApp } from 'firebase/app';
import { getAuth, getRedirectResult, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';

const app = getApps()[0] ?? initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

/** Abre o popup do Google e devolve o ID token do Firebase (validado depois pela API). */
export async function entrarComGoogle(): Promise<string> {
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  const token = await cred.user.getIdToken();
  await signOut(auth); // a sessão do sistema é a da API (cookie); não mantém login no Firebase
  return token;
}

/** Segunda instância do Firebase cujo domínio de autenticação é o próprio site (o /__/auth é encaminhado ao Firebase). Evita o bloqueio de armazenamento de terceiros dos navegadores. */
function authRedirect() {
  const nome = 'redirect';
  const existente = getApps().find((a) => a.name === nome);
  const a = existente ?? initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: window.location.host,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }, nome);
  return getAuth(a);
}

/** O redirecionamento só funciona depois que o endereço do site é liberado no Google Cloud; o servidor confere isso. */
export async function redirecionamentoPronto(): Promise<boolean> {
  try { return !!(await (await fetch('/api/google-redirect', { cache: 'no-store' })).json()).ok; } catch { return false; }
}

/** Sai para o login do Google e volta para o app; o resultado é lido por `tokenDoRedirecionamento`. */
export async function iniciarGoogleRedirecionamento(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithRedirect(authRedirect(), provider);
}

/** Ao voltar do Google: devolve o ID token (ou null se não houver login pendente). */
export async function tokenDoRedirecionamento(): Promise<string | null> {
  const auth = authRedirect();
  const r = await getRedirectResult(auth);
  if (!r) return null;
  const token = await r.user.getIdToken();
  await signOut(auth);
  return token;
}
