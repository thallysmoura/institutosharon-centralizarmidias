import type { Metadata, Viewport } from 'next';
import { Figtree, Poppins, Roboto } from 'next/font/google';
import './globals.css';
import PwaRegister from '@/components/PwaRegister';

const display = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
const sans = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-sans', display: 'swap' });
const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-roboto', display: 'swap' });

export const metadata: Metadata = {
  title: 'Instituto Sharon - Fotos Clínicas',
  description: 'Centralização das fotografias dos atendimentos realizados pelos alunos do Instituto Sharon.',
  robots: { index: false, follow: false },
  applicationName: 'Sharon Fotos',
  appleWebApp: { capable: true, title: 'Sharon Fotos', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  // iOS: "Adicionar à Tela de Início" abre em tela cheia, como app instalado (sem barra do Safari).
  other: { 'apple-mobile-web-app-capable': 'yes', 'mobile-web-app-capable': 'yes' },
};
export const viewport: Viewport = { themeColor: '#171512', width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable} ${roboto.variable}`}>
      <body className="min-h-dvh">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
