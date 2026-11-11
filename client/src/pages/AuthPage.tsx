import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Eye, EyeOff, FileText, Moon, Sun } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, cfg: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function AuthPage() {
  const { login, register, loginWithGoogle, user } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const googleBtn = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) navigate(user.role === 'admin' ? '/admin/dashboard' : '/app/profile', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtn.current) return;

    const scriptId = 'google-gsi';
    const init = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          try {
            setBusy(true);
            setError('');
            await loginWithGoogle(response.credential);
            // RootEntry / effect will send by role
            navigate('/', { replace: true });
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Google sign-in failed');
          } finally {
            setBusy(false);
          }
        },
      });
      if (googleBtn.current) {
        googleBtn.current.innerHTML = '';
        window.google?.accounts.id.renderButton(googleBtn.current, {
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      }
    };

    if (document.getElementById(scriptId)) {
      init();
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = init;
    document.body.appendChild(script);
  }, [loginWithGoogle, navigate, theme]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <section className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'linear-gradient(145deg, #1a3d32 0%, #2f6b55 45%, #1e4a3a 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.2), transparent 40%), radial-gradient(circle at 80% 70%, rgba(196,92,38,0.35), transparent 35%)',
          }}
        />
        <div className="relative z-10 text-white">
          <div className="flex items-center gap-3 mb-16">
            <div className="h-11 w-11 rounded-2xl bg-white/15 grid place-items-center backdrop-blur">
              <FileText size={22} />
            </div>
            <span className="font-display text-2xl">ResumeForge</span>
          </div>
          <h1 className="font-display text-5xl leading-tight max-w-md">
            Tailored resumes, ready for every role.
          </h1>
          <p className="mt-5 text-white/75 max-w-sm text-lg">
            Build profiles once, match job links, and export polished PDF & DOC packages with JD
            archives.
          </p>
        </div>
        <p className="relative z-10 text-white/50 text-sm">Modern workflow for serious applicants.</p>
      </section>

      <section className="flex flex-col justify-center px-4 sm:px-6 py-10 sm:py-12 relative">
        <button
          type="button"
          className="absolute top-4 right-4 sm:top-6 sm:right-6 btn-ghost"
          onClick={toggle}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="mx-auto w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-xl bg-sage text-white grid place-items-center">
              <FileText size={18} />
            </div>
            <span className="font-display text-xl">ResumeForge</span>
          </div>

          <h2 className="font-display text-2xl sm:text-3xl mb-2">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </h2>
          <p className="text-muted text-sm mb-8">
            {mode === 'login'
              ? 'Welcome back — sign in with your email and password.'
              : 'New here? Register to save your credentials and open the dashboard.'}
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="field">
                <label className="label">Full name</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="field">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost !px-2 !py-1.5 text-muted"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-ember bg-ember/10 rounded-xl px-3 py-2">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
            </button>
          </form>

          {GOOGLE_CLIENT_ID && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-muted">
                <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                OR
                <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
              </div>
              <div ref={googleBtn} className="flex justify-center" />
            </>
          )}

          <p className="mt-8 text-sm text-muted text-center">
            {mode === 'login' ? (
              <>
                New user?{' '}
                <button
                  type="button"
                  className="text-sage font-medium hover:underline"
                  onClick={() => setMode('register')}
                >
                  Create account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  className="text-sage font-medium hover:underline"
                  onClick={() => setMode('login')}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </section>
    </div>
  );
}
