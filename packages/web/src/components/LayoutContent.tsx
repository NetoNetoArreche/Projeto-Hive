'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

const PUBLIC_PATHS = ['/invite'];
const FULL_WIDTH_PATHS = ['/posts/visual-editor'];

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isFullWidth = FULL_WIDTH_PATHS.some((p) => pathname.startsWith(p));

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className={`flex-1 ml-60 ${isFullWidth ? 'px-4 py-3' : 'px-6 py-12'}`}>
        {!isFullWidth && (
          <div className="h-1 bg-gradient-to-r from-primary via-accent-pink to-accent-orange rounded-full mb-6 opacity-80" />
        )}
        {children}
      </main>
    </div>
  );
}
