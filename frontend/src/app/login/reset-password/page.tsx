'use client';
import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3202';

function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const login = params.get('login') ?? '';
  const otp = params.get('otp') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/recovery/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, otp, newPassword: password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Error al actualizar la contraseña');
      }
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const strength = password.length === 0 ? 0
    : password.length < 8 ? 1
    : password.length < 12 && !/[^a-zA-Z0-9]/.test(password) ? 2
    : 3;
  const strengthLabel = ['', 'Débil', 'Media', 'Fuerte'];
  const strengthColor = ['', '#EF4444', '#F59E0B', '#10B981'];

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#050a12' } as React.CSSProperties}>
      <div style={{ background: 'linear-gradient(180deg,#050a12 0%,#0a1628 60%,#0e1d35 100%)', padding: '3.5rem 1rem 6rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 500, height: 300, background: 'radial-gradient(circle,rgba(32,126,131,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#207E83,#2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 900, color: '#fff', boxShadow: '0 0 0 3px rgba(255,255,255,0.08),0 8px 24px rgba(32,126,131,0.4)' }}>S</div>
          </div>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2BB4BB', marginBottom: '0.5rem', fontFamily: "'Inter',sans-serif" }}>S10 Intelligence Hub</div>
          <h1 style={{ fontFamily: "'Outfit',sans-serif", fontSize: '2.2rem', fontWeight: 900, color: '#F8FAFC', margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>Nueva contraseña</h1>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-3rem', padding: '0 1rem 3rem', position: 'relative', zIndex: 10 }}>
        <div style={{ background: '#ffffff', borderRadius: '1.5rem', padding: '2.5rem', width: '100%', maxWidth: 440, boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(32,126,131,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🔐</div>
          </div>

          <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: '1.4rem', fontWeight: 800, color: '#0D1525', textAlign: 'center', margin: '0 0 0.35rem 0' }}>Crea tu nueva contraseña</h2>
          <p style={{ textAlign: 'center', color: '#8B97A8', fontSize: '0.85rem', margin: '0 0 2rem 0', fontFamily: "'Inter',sans-serif" }}>
            Mínimo 8 caracteres
          </p>

          {done ? (
            <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.75rem', color: '#059669', fontSize: '0.85rem', textAlign: 'center', fontFamily: "'Inter',sans-serif" }}>
              ✓ Contraseña actualizada. Redirigiendo al inicio de sesión...
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', fontFamily: "'Inter',sans-serif" }}>Nueva contraseña</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '0.9rem' }}>🔒</span>
                  <input
                    type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '0.75rem 2.75rem 0.75rem 2.5rem', border: '1.5px solid #E5E7EB', borderRadius: '0.75rem', fontSize: '0.9rem', color: '#0D1525', background: '#F9FAFB', boxSizing: 'border-box', outline: 'none', fontFamily: "'Inter',sans-serif" }}
                    onFocus={e => (e.target.style.borderColor = '#207E83')}
                    onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '0.85rem', padding: 0 }}>
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>
                {password.length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#E5E7EB', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(strength / 3) * 100}%`, background: strengthColor[strength], transition: 'width 0.3s, background 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: strengthColor[strength], fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{strengthLabel[strength]}</span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', fontFamily: "'Inter',sans-serif" }}>Confirmar contraseña</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '0.9rem' }}>🔒</span>
                  <input
                    type={showPwd ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '0.75rem 0.875rem 0.75rem 2.5rem', border: `1.5px solid ${confirm && confirm !== password ? '#EF4444' : '#E5E7EB'}`, borderRadius: '0.75rem', fontSize: '0.9rem', color: '#0D1525', background: '#F9FAFB', boxSizing: 'border-box', outline: 'none', fontFamily: "'Inter',sans-serif" }}
                    onFocus={e => (e.target.style.borderColor = '#207E83')}
                    onBlur={e => (e.target.style.borderColor = confirm && confirm !== password ? '#EF4444' : '#E5E7EB')}
                  />
                </div>
              </div>

              {error && (
                <div style={{ padding: '0.625rem 0.875rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.75rem', color: '#EF4444', fontSize: '0.82rem', marginBottom: '1.25rem', textAlign: 'center', fontFamily: "'Inter',sans-serif" }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '0.9rem', background: loading ? '#9CA3AF' : '#207E83', color: 'white', border: 'none', borderRadius: '0.875rem', fontSize: '0.85rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'Inter',sans-serif", boxShadow: loading ? 'none' : '0 4px 20px rgba(32,126,131,0.4)' }}>
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '0 1rem 2rem', fontSize: '0.65rem', color: '#374151', fontFamily: "'Inter',sans-serif" }}>
        © 2026 Bizware Consultoría. Todos los derechos reservados.
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
