'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusSquare, FileText, Calendar, CheckSquare, FolderKanban, Settings, LogOut, Hexagon, Users, GitBranch, Film, Palette, Video } from 'lucide-react';
import { useAuth } from './AuthProvider';

const links = [
  { href: '/', label: 'Dashboard', icon: Home, page: 'dashboard' },
  { href: '/posts/new', label: 'Novo Post', icon: PlusSquare, page: 'posts' },
  { href: '/posts/videos', label: 'Reels / Videos', icon: Video, page: 'posts' },
  { href: '/posts', label: 'Posts', icon: FileText, page: 'posts' },
  { href: '/calendar', label: 'Calendario', icon: Calendar, page: 'calendar' },
  { href: '/tasks', label: 'Tarefas', icon: CheckSquare, page: 'tasks' },
  { href: '/projects', label: 'Projetos', icon: FolderKanban, page: 'projects' },
  { href: '/funnels', label: 'Funis', icon: GitBranch, page: 'funnels' },
  { href: '/brands', label: 'Brands', icon: Palette, page: 'brands' },
  { href: '/team', label: 'Equipe', icon: Users, page: 'team' },
  { href: '/settings', label: 'Configuracoes', icon: Settings, page: 'settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isOwner = user?.role === 'OWNER' || !user?.role;
  const allowedPages: string[] = user?.allowedPages || [];

  const visibleLinks = links.filter((link) => {
    // Owner sees everything
    if (isOwner) return true;
    // Settings is always visible
    if (link.page === 'settings') return true;
    // Team is only for OWNER/ADMIN
    if (link.page === 'team') return user?.role === 'ADMIN';
    // Filter by allowedPages
    if (allowedPages.length === 0) return true;
    return allowedPages.includes(link.page);
  });

  const navLinks = visibleLinks.filter((l) => l.page !== 'settings');
  const settingsLink = visibleLinks.find((l) => l.page === 'settings');

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-white border-r border-border flex flex-col z-20">
      {/* Logo Area */}
      <div className="p-6 flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary via-accent-pink to-accent-orange flex items-center justify-center text-white shadow-sm">
            <Hexagon className="w-5 h-5" strokeWidth={2.5} fill="currentColor" />
          </div>
          <span className="font-bold text-[20px] tracking-tight bg-gradient-to-r from-primary to-accent-pink bg-clip-text text-transparent">
            OpenHive
          </span>
        </div>
        <span className="text-[10px] font-bold tracking-[1px] text-text-muted ml-10">AI PLATFORM</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 flex flex-col gap-1">
        <span className="text-[11px] font-bold text-text-muted px-4 mb-2 mt-2 tracking-wider uppercase">Menu</span>

        {navLinks.map((link) => {
          const active = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200 relative ${
                active
                  ? 'text-primary bg-primary/[0.08]'
                  : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
              }`}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/4 rounded-r-full bg-gradient-to-b from-primary to-accent-pink" />
              )}
              <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.5} />
              {link.label}
            </Link>
          );
        })}

        {/* Settings pushed to bottom */}
        {settingsLink && (
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200 relative mt-auto mb-4 ${
              pathname === '/settings'
                ? 'text-primary bg-primary/[0.08]'
                : 'text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
            }`}
          >
            {pathname === '/settings' && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/4 rounded-r-full bg-gradient-to-b from-primary to-accent-pink" />
            )}
            <Settings className="w-5 h-5" strokeWidth={pathname === '/settings' ? 2 : 1.5} />
            Configuracoes
          </Link>
        )}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5 border-t border-border pt-3">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-[14px] font-medium text-text-muted hover:text-status-failed hover:bg-red-50 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" strokeWidth={1.5} />
          Sair
        </button>
      </div>
    </aside>
  );
}
