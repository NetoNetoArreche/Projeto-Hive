'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  Plus,
  FileText,
  Edit3,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Settings,
  Instagram,
  Heart,
  MessageCircle,
  Users,
  UserPlus,
  ExternalLink,
  Image as ImageIcon,
  TrendingUp,
  CheckSquare,
  FolderKanban,
  Facebook,
  Linkedin,
  Twitter,
  Globe,
} from 'lucide-react';

interface Stats {
  total: number;
  draft: number;
  scheduled: number;
  published: number;
  failed: number;
}

interface IGProfile {
  id: string;
  username: string;
  name: string;
  biography: string;
  profile_picture_url: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  website: string;
}

interface IGMedia {
  id: string;
  caption: string;
  media_type: string;
  media_url: string | null;
  permalink: string;
  timestamp: string;
  like_count: number;
  comments_count: number;
}

function formatNumber(n?: number): string {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, draft: 0, scheduled: 0, published: 0, failed: 0 });
  const [upcomingPosts, setUpcomingPosts] = useState<any[]>([]);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [igProfile, setIgProfile] = useState<IGProfile | null>(null);
  const [igMedia, setIgMedia] = useState<IGMedia[]>([]);
  const [igAccounts, setIgAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [socialAccounts, setSocialAccounts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [fbAccounts, setFbAccounts] = useState<any[]>([]);
  const [liProfile, setLiProfile] = useState<any>(null);
  const [liPosts, setLiPosts] = useState<any[]>([]);
  const [xProfile, setXProfile] = useState<any>(null);
  const [xPosts, setXPosts] = useState<any[]>([]);

  const loadIgProfile = useCallback(async (accountId?: string) => {
    try {
      const ig = await api.instagramProfile(accountId);
      setIgProfile(ig.profile);
      setIgMedia(ig.recentMedia);
    } catch {
      setIgProfile(null);
      setIgMedia([]);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [all, drafts, scheduled, published, failed] = await Promise.all([
          api.listPosts({ limit: '1' }),
          api.listPosts({ status: 'DRAFT', limit: '1' }),
          api.listPosts({ status: 'SCHEDULED', limit: '5' }),
          api.listPosts({ status: 'PUBLISHED', limit: '5' }),
          api.listPosts({ status: 'FAILED', limit: '1' }),
        ]);
        setStats({
          total: all.total,
          draft: drafts.total,
          scheduled: scheduled.total,
          published: published.total,
          failed: failed.total,
        });
        setUpcomingPosts(scheduled.items);
        setRecentPosts(published.items);
      } catch { /* API down or not logged in */ }

      // Load Instagram accounts
      try {
        const res: any = await api.listInstagramAccounts();
        const accounts = Array.isArray(res) ? res : res?.data || [];
        setIgAccounts(accounts);
        const defaultAcc = accounts.find((a: any) => a.isDefault) || accounts[0];
        if (defaultAcc) {
          setSelectedAccount(defaultAcc.id);
          await loadIgProfile(defaultAcc.id);
        } else {
          await loadIgProfile();
        }
      } catch {
        await loadIgProfile();
      }

      // Load social accounts (all platforms)
      try {
        const res: any = await api.listSocialAccounts();
        setSocialAccounts(Array.isArray(res) ? res : res?.data || []);
      } catch {}

      // Load brands
      try {
        const res: any = await api.listBrands();
        setBrands(res?.items || []);
      } catch {}

      try {
        const fbRes: any = await api.facebookProfiles();
        if (fbRes?.length) { setFbAccounts(fbRes); }
      } catch {}

      try {
        const li: any = await api.linkedinProfile();
        if (li?.profile) { setLiProfile(li.profile); setLiPosts(li.recentPosts || []); }
      } catch {}

      try {
        const x: any = await api.xProfile();
        if (x?.profile) { setXProfile(x.profile); setXPosts(x.recentPosts || []); }
      } catch {}
    }
    load();
  }, [loadIgProfile]);

  const totalLikes = igMedia.reduce((sum, m) => sum + (m.like_count ?? 0), 0);
  const totalComments = igMedia.reduce((sum, m) => sum + (m.comments_count ?? 0), 0);
  const avgEngagement = igMedia.length > 0 ? Math.round((totalLikes + totalComments) / igMedia.length) : 0;

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-page-title text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-1">Visao geral dos seus posts</p>
        </div>
        <Link href="/posts/new" className="btn-cta">
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Novo Post
        </Link>
      </div>

      {/* Metric Cards - Post stats only */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[
          { key: 'total', label: 'TOTAL POSTS', icon: FileText, accent: 'from-primary to-accent-pink', iconBg: 'bg-primary/10', iconColor: 'text-primary' },
          { key: 'draft', label: 'RASCUNHOS', icon: Edit3, accent: 'from-status-draft to-status-draft', iconBg: 'bg-bg-card-hover', iconColor: 'text-status-draft' },
          { key: 'scheduled', label: 'AGENDADOS', icon: Clock, accent: 'from-status-scheduled to-status-scheduled', iconBg: 'bg-blue-500/10', iconColor: 'text-status-scheduled' },
          { key: 'published', label: 'PUBLICADOS', icon: CheckCircle, accent: 'from-status-published to-status-published', iconBg: 'bg-emerald-500/10', iconColor: 'text-status-published' },
          { key: 'failed', label: 'FALHAS', icon: AlertCircle, accent: 'from-status-failed to-status-failed', iconBg: 'bg-red-500/10', iconColor: 'text-status-failed' },
        ].map((card) => {
          const Icon = card.icon;
          const value = stats[card.key as keyof Stats];
          return (
            <div key={card.key} className="card p-5 relative overflow-hidden group hover:-translate-y-0.5">
              <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${card.accent}`} />
              <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} strokeWidth={1.5} />
              </div>
              <p className="text-card-number text-text-primary">{value}</p>
              <p className="text-card-label text-text-secondary uppercase tracking-wider mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Upcoming Scheduled */}
        <div className="lg:col-span-3 card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-status-scheduled" strokeWidth={1.5} />
              </div>
              <h2 className="text-section-title text-text-primary">Proximos Agendados</h2>
            </div>
            <Link href="/calendar" className="text-[13px] text-primary hover:text-primary-dark font-medium hover:underline transition-colors">
              Ver calendario
            </Link>
          </div>
          {upcomingPosts.length === 0 ? (
            <div className="text-center py-10">
              <Clock className="w-12 h-12 text-text-muted mx-auto mb-3" strokeWidth={1} />
              <p className="text-sm text-text-muted">Nenhum post agendado</p>
              <Link href="/posts/new" className="text-xs text-primary hover:underline mt-2 inline-block font-medium">
                Agendar um post
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {upcomingPosts.map((post) => (
                <div key={post.id} className="flex items-center gap-3 py-3 px-1 hover:bg-bg-card-hover rounded-lg transition-colors -mx-1">
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt="" className="w-12 h-12 rounded-thumb object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-thumb bg-bg-main flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-text-muted" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{post.caption || 'Sem legenda'}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString('pt-BR') : 'Sem data'}
                    </p>
                  </div>
                  <span className="badge badge-scheduled">SCHEDULED</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Published */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-status-published" strokeWidth={1.5} />
              </div>
              <h2 className="text-section-title text-text-primary">Publicados Recentes</h2>
            </div>
            <Link href="/posts" className="text-[13px] text-primary hover:text-primary-dark font-medium hover:underline transition-colors">
              Ver todos
            </Link>
          </div>
          {recentPosts.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle className="w-12 h-12 text-text-muted mx-auto mb-3" strokeWidth={1} />
              <p className="text-sm text-text-muted">Nenhum post publicado ainda</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentPosts.map((post) => (
                <div key={post.id} className="flex items-center gap-3 py-3 px-1 hover:bg-bg-card-hover rounded-lg transition-colors -mx-1">
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt="" className="w-12 h-12 rounded-thumb object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-thumb bg-bg-main flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-text-muted" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{post.caption || 'Sem legenda'}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {new Date(post.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className="badge badge-published">PUBLISHED</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instagram Profile + Recent Media */}
      {(igProfile || igAccounts.length > 0) && (
        <div className="card p-6 mb-6">
          {/* Account Selector */}
          {igAccounts.length > 1 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-semibold text-text-muted">Conta:</span>
              <div className="flex gap-1.5">
                {igAccounts.map((acc: any) => (
                  <button
                    type="button"
                    key={acc.id}
                    onClick={() => { setSelectedAccount(acc.id); loadIgProfile(acc.id); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      selectedAccount === acc.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-bg-main text-text-secondary hover:bg-bg-card-hover'
                    }`}
                  >
                    @{acc.username || acc.instagramUserId?.slice(-6)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Profile Row */}
          {igProfile && <div className="flex items-center gap-4 mb-5">
            {igProfile.profile_picture_url ? (
              <img src={igProfile.profile_picture_url} alt={igProfile.username} className="w-14 h-14 rounded-full object-cover border-2 border-primary/20" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-accent-pink/20 flex items-center justify-center">
                <Instagram className="w-7 h-7 text-primary" strokeWidth={1.5} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-section-title text-text-primary">@{igProfile.username}</h2>
                {igProfile.website && (
                  <a href={igProfile.website} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-primary transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </a>
                )}
              </div>
              {igProfile.name && <p className="text-xs text-text-secondary truncate">{igProfile.name}</p>}
            </div>
            <div className="hidden sm:flex items-center gap-5 text-center">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-text-muted" strokeWidth={1.5} />
                <span className="text-sm font-bold text-text-primary">{formatNumber(igProfile.followers_count)}</span>
                <span className="text-[11px] text-text-secondary">Seguidores</span>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-text-muted" strokeWidth={1.5} />
                <span className="text-sm font-bold text-text-primary">{formatNumber(igProfile.follows_count)}</span>
                <span className="text-[11px] text-text-secondary">Seguindo</span>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-text-muted" strokeWidth={1.5} />
                <span className="text-sm font-bold text-text-primary">{formatNumber(igProfile.media_count)}</span>
                <span className="text-[11px] text-text-secondary">Posts</span>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-pink-500" strokeWidth={1.5} />
                <span className="text-sm font-bold text-pink-600">{formatNumber(totalLikes)}</span>
                <span className="text-[11px] text-text-secondary">Curtidas</span>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-purple-500" strokeWidth={1.5} />
                <span className="text-sm font-bold text-purple-600">{formatNumber(totalComments)}</span>
                <span className="text-[11px] text-text-secondary">Comentarios</span>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-text-muted" strokeWidth={1.5} />
                <span className="text-sm font-bold text-text-primary">{formatNumber(avgEngagement)}</span>
                <span className="text-[11px] text-text-secondary">Eng. Medio</span>
              </div>
            </div>
          </div>}

          {/* Media Grid */}
          {igMedia.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {igMedia.slice(0, 6).map((media) => (
                <a key={media.id} href={media.permalink} target="_blank" rel="noopener noreferrer" className="group relative aspect-square rounded-lg overflow-hidden bg-bg-main">
                  {media.media_url ? (
                    <img src={media.media_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-bg-card-hover">
                      <ImageIcon className="w-6 h-6 text-text-muted" strokeWidth={1} />
                    </div>
                  )}
                  {(media.media_type === 'VIDEO' || media.media_type === 'REEL') && (
                    <div className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor" aria-label="Video"><title>Video</title><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="flex items-center gap-3 text-white text-xs font-medium">
                      <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{media.like_count ?? 0}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{media.comments_count ?? 0}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Multi-Platform Feeds */}
      {(fbAccounts.length > 0 || liProfile || xProfile) && (
        <div className="card p-6 mb-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-indigo-500" strokeWidth={1.5} />
            </div>
            <h2 className="text-section-title text-text-primary">Outras Plataformas</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            {fbAccounts.map((fb: any) => (
              <div key={fb.accountId}>
                <div className="flex items-center gap-3 mb-4">
                  {fb.profile?.picture ? (
                    <img src={fb.profile.picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <Facebook className="w-5 h-5 text-white" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-text-primary truncate">{fb.profile?.name || 'Facebook'}</p>
                    <p className="text-xs text-text-secondary">{formatNumber(fb.profile?.fanCount || 0)} seguidores</p>
                  </div>
                </div>
                {fb.recentPosts?.length > 0 ? (
                  <div className="space-y-2.5">
                    {fb.recentPosts.slice(0, 4).map((post: any) => (
                      <a key={post.id} href={post.permalink} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-xl bg-bg-main hover:bg-bg-card-hover transition-colors group">
                        <p className="text-xs text-text-primary line-clamp-2 group-hover:text-primary transition-colors">{post.message || 'Sem texto'}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-text-muted">{new Date(post.createdAt).toLocaleDateString('pt-BR')}</span>
                          <span className="flex items-center gap-0.5 text-[10px] text-pink-500"><Heart className="w-3 h-3" />{post.likes}</span>
                          <span className="flex items-center gap-0.5 text-[10px] text-blue-500"><MessageCircle className="w-3 h-3" />{post.comments}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">Nenhum post recente</p>
                )}
              </div>
            ))}

            {/* LinkedIn Feed */}
            {liProfile && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  {liProfile.picture ? (
                    <img src={liProfile.picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-sky-700 flex items-center justify-center">
                      <Linkedin className="w-5 h-5 text-white" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-text-primary truncate">{liProfile.name}</p>
                    <p className="text-xs text-text-secondary">LinkedIn</p>
                  </div>
                </div>
                {liPosts.length > 0 ? (
                  <div className="space-y-2.5">
                    {liPosts.slice(0, 4).map((post: any) => (
                      <a key={post.id} href={post.permalink} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-xl bg-bg-main hover:bg-bg-card-hover transition-colors group">
                        <p className="text-xs text-text-primary line-clamp-2 group-hover:text-sky-600 transition-colors">{post.message || 'Sem texto'}</p>
                        <span className="text-[10px] text-text-muted mt-1 block">{new Date(post.createdAt).toLocaleDateString('pt-BR')}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">Nenhum post recente</p>
                )}
              </div>
            )}

            {/* X Feed */}
            {xProfile && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  {xProfile.picture ? (
                    <img src={xProfile.picture} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center">
                      <Twitter className="w-5 h-5 text-white" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-text-primary truncate">{xProfile.name}</p>
                    <p className="text-xs text-text-secondary">@{xProfile.username} · {formatNumber(xProfile.metrics?.followers_count)} seguidores</p>
                  </div>
                </div>
                {xPosts.length > 0 ? (
                  <div className="space-y-2.5">
                    {xPosts.slice(0, 4).map((post: any) => (
                      <a key={post.id} href={post.permalink} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-xl bg-bg-main hover:bg-bg-card-hover transition-colors group">
                        <p className="text-xs text-text-primary line-clamp-2 group-hover:text-neutral-700 transition-colors">{post.message}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-text-muted">{new Date(post.createdAt).toLocaleDateString('pt-BR')}</span>
                          <span className="flex items-center gap-0.5 text-[10px] text-pink-500"><Heart className="w-3 h-3" />{post.likes}</span>
                          <span className="flex items-center gap-0.5 text-[10px] text-text-muted"><TrendingUp className="w-3 h-3" />{post.retweets}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">Nenhum tweet recente</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Link href="/posts/new" className="card p-5 border border-border hover:border-primary hover:-translate-y-0.5 group cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent-pink/10 group-hover:from-primary/20 group-hover:to-accent-pink/20 transition-colors">
              <Plus className="w-5 h-5 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-text-primary">Criar Post</p>
              <p className="text-[13px] text-text-secondary">IA gera imagem</p>
            </div>
          </div>
        </Link>
        <Link href="/calendar" className="card p-5 border border-border hover:border-primary hover:-translate-y-0.5 group cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
              <Calendar className="w-5 h-5 text-status-scheduled" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-text-primary">Calendario</p>
              <p className="text-[13px] text-text-secondary">Publicacoes</p>
            </div>
          </div>
        </Link>
        <Link href="/tasks" className="card p-5 border border-border hover:border-primary hover:-translate-y-0.5 group cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
              <CheckSquare className="w-5 h-5 text-amber-600" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-text-primary">Tarefas</p>
              <p className="text-[13px] text-text-secondary">Gravacoes</p>
            </div>
          </div>
        </Link>
        <Link href="/projects" className="card p-5 border border-border hover:border-primary hover:-translate-y-0.5 group cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
              <FolderKanban className="w-5 h-5 text-purple-600" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-text-primary">Projetos</p>
              <p className="text-[13px] text-text-secondary">Cursos</p>
            </div>
          </div>
        </Link>
        <Link href="/settings" className="card p-5 border border-border hover:border-primary hover:-translate-y-0.5 group cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-bg-card-hover group-hover:bg-bg-main transition-colors">
              <Settings className="w-5 h-5 text-text-secondary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-text-primary">Config</p>
              <p className="text-[13px] text-text-secondary">Instagram, Bot</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
