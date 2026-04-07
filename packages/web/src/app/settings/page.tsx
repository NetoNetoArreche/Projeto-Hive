'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../components/AuthProvider';
import {
  Camera, Zap, Send, Monitor, LogOut, CheckCircle, XCircle, Plus, Trash2,
  Loader2, Eye, EyeOff, Save, Copy, Check, ExternalLink, Hexagon,
} from 'lucide-react';

interface SettingField {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
}

interface ServiceConfig {
  name: string;
  description: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  fields: SettingField[];
}

const SERVICES: ServiceConfig[] = [
  {
    name: 'Facebook App (para token Instagram)',
    description: 'Necessario para trocar token short-lived por long-lived (60 dias)',
    icon: Camera,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    fields: [
      { key: 'FACEBOOK_APP_ID', label: 'App ID', placeholder: '953530xxxxxxx (topo do Facebook Developer)' },
      { key: 'FACEBOOK_APP_SECRET', label: 'App Secret', placeholder: 'Chave secreta do app do Instagram' },
    ],
  },
  {
    name: 'Geracao de Imagens (Gemini)',
    description: 'Geracao de imagens e legendas com IA via Google Gemini',
    icon: Zap,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    fields: [
      { key: 'NANO_BANANA_API_KEY', label: 'Google Gemini API Key', placeholder: 'AIzaSyxxxxxxxxx...' },
    ],
  },
  {
    name: 'Telegram Bot',
    description: 'Criacao e gerenciamento de posts via Telegram',
    icon: Send,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    fields: [
      { key: 'TELEGRAM_BOT_TOKEN', label: 'Bot Token', placeholder: '123456:ABCxxxxxxx...' },
      { key: 'TELEGRAM_ALLOWED_CHAT_IDS', label: 'Chat IDs (separados por virgula)', placeholder: '123456789,987654321' },
    ],
  },
];

export default function SettingsPage() {
  const { logout } = useAuth();
  const [settings, setSettings] = useState<Record<string, { value: string; hasValue: boolean }>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [mcpCopied, setMcpCopied] = useState(false);
  const [cookieUploading, setCookieUploading] = useState(false);
  const [cookieSaved, setCookieSaved] = useState(false);

  // Instagram accounts
  const [igAccounts, setIgAccounts] = useState<any[]>([]);
  const [showAddIg, setShowAddIg] = useState(false);
  const [igToken, setIgToken] = useState('');
  const [igUserId, setIgUserId] = useState('');
  const [igAdding, setIgAdding] = useState(false);

  useEffect(() => {
    loadSettings();
    loadIgAccounts();
  }, []);

  async function loadIgAccounts() {
    try {
      const res: any = await api.listInstagramAccounts();
      setIgAccounts(Array.isArray(res) ? res : res?.data || []);
    } catch {}
  }

  async function handleAddIgAccount() {
    if (!igToken || !igUserId) return;
    setIgAdding(true);
    try {
      await api.addInstagramAccount({ accessToken: igToken, instagramUserId: igUserId });
      setIgToken(''); setIgUserId(''); setShowAddIg(false);
      await loadIgAccounts();
    } catch {}
    setIgAdding(false);
  }

  async function handleSetDefaultIg(id: string) {
    try {
      await api.setDefaultInstagramAccount(id);
      await loadIgAccounts();
    } catch {}
  }

  async function handleDeleteIg(id: string) {
    if (!confirm('Remover esta conta do Instagram?')) return;
    try {
      await api.deleteInstagramAccount(id);
      await loadIgAccounts();
    } catch {}
  }

  async function loadSettings() {
    try {
      const res: any = await api.getSettings();
      // res can be: array directly, or { data: array }, or { items: array }
      let items: any[] = [];
      if (Array.isArray(res)) items = res;
      else if (Array.isArray(res?.data)) items = res.data;
      else if (Array.isArray(res?.items)) items = res.items;

      const map: Record<string, { value: string; hasValue: boolean }> = {};
      items.forEach((s: any) => {
        map[s.key] = { value: s.value || '', hasValue: !!s.hasValue };
      });
      setSettings(map);
    } catch {}
    setLoading(false);
  }

  async function handleSave(key: string) {
    const value = editValues[key];
    if (value === undefined || value === '') return;

    setSaving((s) => ({ ...s, [key]: true }));
    try {
      await api.updateSetting(key, value);
      setEditValues((v) => ({ ...v, [key]: '' }));
      setSaved((s) => ({ ...s, [key]: true }));
      setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 2000);
      // Reload settings to get fresh state
      await loadSettings();
    } catch {}
    setSaving((s) => ({ ...s, [key]: false }));
  }

  const mcpUrl = settings['MCP_URL']?.hasValue ? '' : '';

  function getMcpUrl() {
    // Use saved URL if available, otherwise show placeholder
    const saved = editValues['MCP_URL'] || '';
    if (saved) return saved;
    // Check if we have a saved value in settings
    if (settings['MCP_URL']?.hasValue) return settings['MCP_URL'].value;
    return '';
  }

  function copyMcpUrl() {
    const url = getMcpUrl();
    if (url) {
      navigator.clipboard.writeText(url);
      setMcpCopied(true);
      setTimeout(() => setMcpCopied(false), 2000);
    }
  }

  async function handleSaveMcpUrl() {
    const url = editValues['MCP_URL'];
    if (!url) return;
    setSaving((s) => ({ ...s, MCP_URL: true }));
    try {
      await api.updateSetting('MCP_URL', url);
      setSettings((s) => ({ ...s, MCP_URL: { value: url, hasValue: true } }));
      setSaved((s) => ({ ...s, MCP_URL: true }));
      setTimeout(() => setSaved((s) => ({ ...s, MCP_URL: false })), 2000);
    } catch {}
    setSaving((s) => ({ ...s, MCP_URL: false }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-page-title text-text-primary">Configuracoes</h1>
        <p className="text-sm text-text-secondary mt-1">Gerencie integracoes e chaves de API</p>
      </div>

      {/* MCP Connection */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">Conexao MCP</p>
        <div className="card p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 flex items-center justify-center flex-shrink-0">
              <Hexagon className="w-6 h-6 text-amber-600" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-text-primary">MCP Server</h3>
                <span className="badge badge-completed flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" strokeWidth={2} />
                  Ativo
                </span>
              </div>
              <p className="text-xs text-text-secondary mb-3">
                Conecte ao Claude Desktop, Claude Code ou Cowork com a URL abaixo
              </p>
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-text-muted">URL do MCP Server</label>
                <div className="flex items-center gap-2">
                  <input
                    value={editValues['MCP_URL'] ?? (settings['MCP_URL']?.hasValue ? settings['MCP_URL'].value : '')}
                    onChange={(e) => setEditValues((v) => ({ ...v, MCP_URL: e.target.value }))}
                    className="input-field text-xs font-mono"
                    placeholder="https://seu-servidor.sslip.io/mcp"
                  />
                  <button
                    onClick={handleSaveMcpUrl}
                    disabled={!editValues['MCP_URL'] || saving['MCP_URL']}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    {saving['MCP_URL'] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved['MCP_URL'] ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  </button>
                  {settings['MCP_URL']?.hasValue && (
                    <button
                      onClick={copyMcpUrl}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                    >
                      {mcpCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {mcpCopied ? 'Copiado!' : 'Copiar'}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-text-muted mt-2">
                40 tools disponiveis: posts, brands, design systems (58 inspiracoes), carrossel misto, imagem composta (IA + HTML), tarefas, projetos, modulos, imagens, legendas, templates HTML, video clips
              </p>

              {/* MCP Token */}
              <div className="mt-3 space-y-2">
                <label className="block text-[11px] font-semibold text-text-muted">Token de Acesso (MCP)</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-bg-main rounded-lg px-3 py-2 text-xs font-mono text-text-primary truncate">
                    {settings['MCP_TOKEN']?.hasValue ? settings['MCP_TOKEN'].value : 'Nao configurado'}
                  </code>
                  {settings['MCP_TOKEN']?.hasValue && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(settings['MCP_TOKEN']?.value || '');
                        setMcpCopied(true);
                        setTimeout(() => setMcpCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                    >
                      {mcpCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {mcpCopied ? 'Copiado!' : 'Copiar'}
                    </button>
                  )}
                </div>
              </div>

              {/* MCP JSON Config - npx (IDEs: Claude Code, Cursor, VS Code, Gemini) */}
              {settings['MCP_TOKEN']?.hasValue && (
                <div className="mt-4 p-4 rounded-lg bg-bg-main">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-semibold text-text-muted">JSON de Configuracao (cole na IDE)</label>
                    <button
                      onClick={() => {
                        const mcpUrl = settings['MCP_URL']?.value || '';
                        const apiUrl = mcpUrl.replace(/\/mcp\/?$/, '').replace(/:\d+\/mcp\/?$/, '').replace(/mcp\./, 'api.');
                        const json = JSON.stringify({
                          mcpServers: {
                            openhive: {
                              command: 'npx',
                              args: ['-y', 'openhive-mcp-server@latest'],
                              env: {
                                OPENHIVE_API_URL: apiUrl || 'https://api.seu-servidor.com',
                                OPENHIVE_API_TOKEN: settings['MCP_TOKEN']?.value || 'seu-token-aqui',
                              },
                            },
                          },
                        }, null, 2);
                        navigator.clipboard.writeText(json);
                        setMcpCopied(true);
                        setTimeout(() => setMcpCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      {mcpCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {mcpCopied ? 'Copiado!' : 'Copiar JSON'}
                    </button>
                  </div>
                  <pre className="text-[11px] text-text-secondary font-mono whitespace-pre overflow-x-auto">
{(() => {
  const mcpUrl = settings['MCP_URL']?.value || '';
  const apiUrl = mcpUrl.replace(/\/mcp\/?$/, '').replace(/:\d+\/mcp\/?$/, '').replace(/mcp\./, 'api.');
  return JSON.stringify({
    mcpServers: {
      openhive: {
        command: 'npx',
        args: ['-y', 'openhive-mcp-server@latest'],
        env: {
          OPENHIVE_API_URL: apiUrl || 'https://api.seu-servidor.com',
          OPENHIVE_API_TOKEN: settings['MCP_TOKEN']?.value || 'seu-token-aqui',
        },
      },
    },
  }, null, 2);
})()}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* API Keys */}
      <div className="space-y-4 mb-8">
        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">Contas do Instagram</p>
        <div className="card p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center flex-shrink-0">
              <Camera className="w-6 h-6 text-pink-500" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Instagram</h3>
                  <p className="text-xs text-text-secondary">Gerencie contas para publicacao automatica</p>
                </div>
                <button
                  onClick={() => setShowAddIg(!showAddIg)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Conta
                </button>
              </div>

              {/* Add account form */}
              {showAddIg && (
                <div className="p-4 rounded-lg bg-bg-main space-y-3 mb-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-text-muted mb-1">Access Token</label>
                    <input
                      value={igToken}
                      onChange={(e) => setIgToken(e.target.value)}
                      className="input-field text-xs"
                      placeholder="IGAA... (gere no Facebook Developer)"
                      type="password"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-text-muted mb-1">Instagram User ID</label>
                    <input
                      value={igUserId}
                      onChange={(e) => setIgUserId(e.target.value)}
                      className="input-field text-xs"
                      placeholder="17841480xxxxxxxxx"
                    />
                  </div>
                  <p className="text-[10px] text-text-muted">
                    O token sera trocado automaticamente por um long-lived (60 dias) se voce configurou o Facebook App ID e Secret abaixo.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddIgAccount}
                      disabled={!igToken || !igUserId || igAdding}
                      className="btn-cta text-xs"
                    >
                      {igAdding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</> : 'Adicionar'}
                    </button>
                    <button onClick={() => { setShowAddIg(false); setIgToken(''); setIgUserId(''); }} className="btn-ghost text-xs">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Account list */}
              {igAccounts.length === 0 && !showAddIg && (
                <p className="text-xs text-text-muted">Nenhuma conta adicionada. Clique em "Adicionar Conta".</p>
              )}
              {igAccounts.map((acc) => (
                <div key={acc.id} className="flex items-center gap-3 p-3 rounded-lg bg-bg-main mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    {(acc.username || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">@{acc.username || acc.instagramUserId}</p>
                      {acc.isDefault && (
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[10px] font-bold text-primary">PADRAO</span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted">
                      Expira: {new Date(acc.expiresAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!acc.isDefault && (
                      <button
                        onClick={() => handleSetDefaultIg(acc.id)}
                        className="px-2 py-1 rounded text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors"
                      >
                        Tornar padrao
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteIg(acc.id)}
                      className="p-1.5 rounded text-text-muted hover:text-status-failed hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Chaves de API</p>

        {SERVICES.map((service) => {
          const Icon = service.icon;
          const allConnected = service.fields.every((f) => settings[f.key]?.hasValue);

          return (
            <div key={service.name} className="card p-5">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${service.iconBg}`}>
                  <Icon className={`w-6 h-6 ${service.iconColor}`} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-text-primary">{service.name}</h3>
                    {allConnected ? (
                      <span className="badge badge-completed flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" strokeWidth={2} />
                        Conectado
                      </span>
                    ) : (
                      <span className="badge badge-draft flex items-center gap-1">
                        <XCircle className="w-3 h-3" strokeWidth={2} />
                        Nao configurado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mb-3">{service.description}</p>

                  <div className="space-y-3">
                    {service.fields.map((field) => {
                      const setting = settings[field.key];
                      const isEditing = editValues[field.key] !== undefined && editValues[field.key] !== '';
                      const show = showValues[field.key];

                      return (
                        <div key={field.key}>
                          <label className="block text-[11px] font-semibold text-text-muted mb-1">{field.label}</label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type={show ? 'text' : 'password'}
                                value={editValues[field.key] ?? ''}
                                onChange={(e) => setEditValues((v) => ({ ...v, [field.key]: e.target.value }))}
                                className="input-field text-xs pr-8"
                                placeholder={setting?.hasValue ? setting.value : field.placeholder}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave(field.key)}
                              />
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowValues((v) => ({ ...v, [field.key]: !v[field.key] })); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-text-muted hover:text-text-primary z-10 cursor-pointer"
                              >
                                {showValues[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            <button
                              onClick={() => handleSave(field.key)}
                              disabled={!isEditing || saving[field.key]}
                              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 bg-primary/10 text-primary hover:bg-primary/20"
                            >
                              {saving[field.key] ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : saved[field.key] ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* YouTube Cookies */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">YouTube Clips</p>
        <div className="card p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2 31.5 31.5 0 000 12a31.5 31.5 0 00.5 5.8 3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1A31.5 31.5 0 0024 12a31.5 31.5 0 00-.5-5.8zM9.5 15.5v-7l6.3 3.5-6.3 3.5z"/></svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-text-primary">Cookies do YouTube</h3>
                {settings['YOUTUBE_COOKIES']?.hasValue ? (
                  <span className="badge badge-completed flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" strokeWidth={2} />
                    Configurado
                  </span>
                ) : (
                  <span className="badge badge-draft flex items-center gap-1">
                    Nao configurado
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary mb-3">
                Necessario para baixar videos do YouTube. Exporte os cookies do seu navegador usando uma extensao como "Get cookies.txt LOCALLY".
              </p>
              <div className="flex items-center gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept=".txt"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setCookieUploading(true);
                      try {
                        await api.uploadYoutubeCookies(file);
                        setCookieSaved(true);
                        setTimeout(() => setCookieSaved(false), 3000);
                        await loadSettings();
                      } catch {}
                      setCookieUploading(false);
                    }}
                  />
                  <span className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors cursor-pointer">
                    {cookieUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : cookieSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    {cookieUploading ? 'Enviando...' : cookieSaved ? 'Salvo!' : 'Enviar cookies.txt'}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="space-y-4">
        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Conta</p>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-status-failed" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-bold text-text-primary">Encerrar sessao</p>
                <p className="text-xs text-text-secondary">Sair da sua conta</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-btn text-xs font-semibold bg-red-50 text-status-failed hover:bg-red-100 border border-red-100 transition-all"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
