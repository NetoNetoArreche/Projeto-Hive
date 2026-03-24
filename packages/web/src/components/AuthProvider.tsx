'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { api, setToken, getToken } from '../lib/api';
import { Zap, Loader2 } from 'lucide-react';

const PUBLIC_PATHS = ['/invite'];

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getToken();
    if (t) {
      // Try to restore user info from localStorage
      const savedUser = localStorage.getItem('user');
      api.listPosts({ limit: '1' })
        .then(() => setUser(savedUser ? JSON.parse(savedUser) : { loggedIn: true }))
        .catch(() => {
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password);
    setToken(result.token);
    setUser(result.user);
    localStorage.setItem('user', JSON.stringify(result.user));
  };

  const register = async (email: string, password: string, name: string) => {
    const result = await api.register(email, password, name);
    setToken(result.token);
    setUser(result.user);
    localStorage.setItem('user', JSON.stringify(result.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('user');
  };

  if (loading && !isPublicPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main">
        <div className="flex flex-col items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-accent-pink animate-pulse">
            <Zap className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <p className="text-text-muted text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user && !isPublicPath) {
    return <LoginScreen onLogin={login} onRegister={register} />;
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function LoginScreen({
  onLogin,
  onRegister,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name: string) => Promise<void>;
}) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isRegister) {
        await onRegister(email, password, name);
      } else {
        await onLogin(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-main relative">
      {/* Decorative gradient orbs */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-accent-pink/10 rounded-full blur-[100px]" />

      <div className="relative w-full max-w-md mx-4 animate-slide-up">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary to-accent-pink shadow-cta">
            <Zap className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              Insta<span className="bg-gradient-to-r from-primary to-accent-pink bg-clip-text text-transparent">Post</span>
            </h1>
            <span className="text-xs font-semibold text-text-muted uppercase tracking-[0.1em]">AI Platform</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-card p-8 shadow-lg border border-border">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-text-primary">
              {isRegister ? 'Criar conta' : 'Bem-vindo de volta'}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {isRegister ? 'Preencha os dados para comecar' : 'Entre com suas credenciais'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="Seu nome"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-input bg-red-50 border border-red-100">
                <p className="text-status-failed text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={submitting} className="w-full btn-cta justify-center py-3">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Aguarde...
                </span>
              ) : isRegister ? 'Criar conta' : 'Entrar'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-text-muted">ou</span>
            </div>
          </div>

          <p className="text-center text-sm text-text-secondary">
            {isRegister ? 'Ja tem uma conta?' : 'Ainda nao tem conta?'}{' '}
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-primary hover:text-primary-dark font-semibold transition-colors"
            >
              {isRegister ? 'Fazer login' : 'Criar conta'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
