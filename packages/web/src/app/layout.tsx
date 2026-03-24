import './globals.css';
import { LayoutContent } from '../components/LayoutContent';
import { AuthProvider } from '../components/AuthProvider';

export const metadata = {
  title: 'InstaPost AI',
  description: 'Plataforma de criacao e agendamento de posts para Instagram',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-bg-main text-text-primary min-h-screen">
        <AuthProvider>
          <LayoutContent>{children}</LayoutContent>
        </AuthProvider>
      </body>
    </html>
  );
}
