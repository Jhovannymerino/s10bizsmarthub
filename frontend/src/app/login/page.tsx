'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3202';

function validateEmail(value: string): string {
  if (!value.trim()) return 'Ingresa tu email o usuario';
  if (value.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Email inválido';
  return '';
}

function validatePassword(value: string): string {
  if (!value) return 'Ingresa tu contraseña';
  if (value.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  return '';
}

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [loginErr, setLoginErr]     = useState('');
  const [passwordErr, setPasswordErr] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const le = validateEmail(login);
    const pe = validatePassword(password);
    setLoginErr(le);
    setPasswordErr(pe);
    if (le || pe) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      if (!res.ok) throw new Error('Credenciales inválidas');
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('userInfo', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const fieldErr: React.CSSProperties = {
    fontSize: '0.75rem', color: '#EF4444', marginTop: '0.25rem',
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#050a12' } as React.CSSProperties}>

      {/* Top dark hero */}
      <div style={{
        background: 'linear-gradient(180deg, #050a12 0%, #0a1628 60%, #0e1d35 100%)',
        padding: '3.5rem 1rem 6rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 500, height: 300, background: 'radial-gradient(circle, rgba(32,126,131,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #207E83, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 900, color: '#fff', boxShadow: '0 0 0 3px rgba(255,255,255,0.08), 0 8px 24px rgba(32,126,131,0.4)' }}>
              S
            </div>
          </div>

          <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2BB4BB', marginBottom: '0.5rem', fontFamily: "'Inter', sans-serif" }}>
            S10 Intelligence Hub
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '2.5rem', fontWeight: 900, color: '#F8FAFC', margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>
            Portal de Acceso
          </h1>
        </div>
      </div>

      {/* Card centrada */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-3rem', padding: '0 1rem 3rem', position: 'relative', zIndex: 10 }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '1.5rem',
          padding: '2.5rem',
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(32,126,131,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#207E83' }}>
              <Lock size={22} aria-hidden="true" />
            </div>
          </div>

          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.6rem', fontWeight: 800, color: '#0D1525', textAlign: 'center', margin: '0 0 0.35rem 0' }}>
            Bienvenido
          </h2>
          <p style={{ textAlign: 'center', color: '#8B97A8', fontSize: '0.85rem', margin: '0 0 2rem 0', fontFamily: "'Inter', sans-serif" }}>
            Ingresa tus credenciales para acceder
          </p>

          <form onSubmit={handleLogin} noValidate>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--form-label-color)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', fontFamily: "'Inter', sans-serif" }}>
                Email o usuario
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} aria-hidden="true" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: loginErr ? '#EF4444' : '#9CA3AF' }} />
                <input
                  type="text" value={login} onChange={e => setLogin(e.target.value)} required
                  placeholder="usuario o nombre@empresa.com"
                  aria-invalid={!!loginErr}
                  aria-describedby={loginErr ? 'login-err' : undefined}
                  style={{ width: '100%', padding: '0.75rem 0.875rem 0.75rem 2.5rem', border: `1.5px solid ${loginErr ? '#EF4444' : 'var(--form-input-border)'}`, borderRadius: '0.75rem', fontSize: '0.9rem', color: 'var(--form-input-text)', background: 'var(--form-input-bg)', boxSizing: 'border-box', outline: 'none', fontFamily: "'Inter', sans-serif", transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = loginErr ? '#EF4444' : '#207E83')}
                  onBlur={e => { const err = validateEmail(e.target.value); setLoginErr(err); e.target.style.borderColor = err ? '#EF4444' : '#E5E7EB'; }}
                />
              </div>
              {loginErr && <p id="login-err" style={fieldErr}>{loginErr}</p>}
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: 'var(--form-label-color)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Inter', sans-serif" }}>
                  Contraseña
                </label>
                <Link href="/login/forgot-password" style={{ fontSize: '0.72rem', color: '#207E83', textDecoration: 'none', fontFamily: "'Inter', sans-serif" }}>
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} aria-hidden="true" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: passwordErr ? '#EF4444' : '#9CA3AF' }} />
                <input
                  type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  aria-invalid={!!passwordErr}
                  aria-describedby={passwordErr ? 'pwd-err' : undefined}
                  style={{ width: '100%', padding: '0.75rem 2.75rem 0.75rem 2.5rem', border: `1.5px solid ${passwordErr ? '#EF4444' : 'var(--form-input-border)'}`, borderRadius: '0.75rem', fontSize: '0.9rem', color: 'var(--form-input-text)', background: 'var(--form-input-bg)', boxSizing: 'border-box', outline: 'none', fontFamily: "'Inter', sans-serif", transition: 'border-color 0.15s' }}
                  onFocus={e => (e.target.style.borderColor = passwordErr ? '#EF4444' : '#207E83')}
                  onBlur={e => { const err = validatePassword(e.target.value); setPasswordErr(err); e.target.style.borderColor = err ? '#EF4444' : '#E5E7EB'; }}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0, display: 'flex' }}>
                  {showPwd ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
              {passwordErr && <p id="pwd-err" style={fieldErr}>{passwordErr}</p>}
            </div>

            {error && (
              <div role="alert" style={{ padding: '0.625rem 0.875rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.75rem', color: '#EF4444', fontSize: '0.82rem', marginBottom: '1.25rem', textAlign: 'center', fontFamily: "'Inter', sans-serif" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '0.9rem', background: loading ? '#9CA3AF' : '#207E83', color: 'white', border: 'none', borderRadius: '0.875rem', fontSize: '0.85rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'Inter', sans-serif", transition: 'background 0.15s', boxShadow: loading ? 'none' : '0 4px 20px rgba(32,126,131,0.4)' }}>
              {loading ? 'Autenticando...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '0 1rem 2rem', fontSize: '0.65rem', color: '#374151', fontFamily: "'Inter', sans-serif" }}>
        © 2026 Bizware Consultoría. Todos los derechos reservados.
      </div>
    </div>
  );
}
