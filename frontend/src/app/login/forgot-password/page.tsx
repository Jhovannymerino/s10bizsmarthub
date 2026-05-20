'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3202';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/recovery/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login }),
      });
      if (!res.ok) throw new Error('Error al enviar el código');
      setSent(true);
      setTimeout(() => {
        router.push(`/login/verify-code?login=${encodeURIComponent(login)}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#050a12' } as React.CSSProperties}>
      <div style={{ background: 'linear-gradient(180deg,#050a12 0%,#0a1628 60%,#0e1d35 100%)', padding: '3.5rem 1rem 6rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 500, height: 300, background: 'radial-gradient(circle,rgba(32,126,131,0.12) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#207E83,#2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 900, color: '#fff', boxShadow: '0 0 0 3px rgba(255,255,255,0.08),0 8px 24px rgba(32,126,131,0.4)' }}>S</div>
          </div>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#2BB4BB', marginBottom: '0.5rem', fontFamily: "'Inter',sans-serif" }}>S10 Intelligence Hub</div>
          <h1 style={{ fontFamily: "'Outfit',sans-serif", fontSize: '2.2rem', fontWeight: 900, color: '#F8FAFC', margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>Recuperar contraseña</h1>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-3rem', padding: '0 1rem 3rem', position: 'relative', zIndex: 10 }}>
        <div style={{ background: '#ffffff', borderRadius: '1.5rem', padding: '2.5rem', width: '100%', maxWidth: 440, boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(32,126,131,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>✉️</div>
          </div>

          <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: '1.4rem', fontWeight: 800, color: '#0D1525', textAlign: 'center', margin: '0 0 0.35rem 0' }}>Ingresa tu email o usuario</h2>
          <p style={{ textAlign: 'center', color: '#8B97A8', fontSize: '0.85rem', margin: '0 0 2rem 0', fontFamily: "'Inter',sans-serif" }}>
            Te enviaremos un código de 6 dígitos al correo de tu cuenta
          </p>

          {sent ? (
            <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.75rem', color: '#059669', fontSize: '0.85rem', textAlign: 'center', fontFamily: "'Inter',sans-serif" }}>
              Código enviado. Redirigiendo...
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', fontFamily: "'Inter',sans-serif" }}>Email o usuario</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '0.9rem' }}>✉</span>
                  <input
                    type="text" value={login} onChange={e => setLogin(e.target.value)} required
                    placeholder="usuario o nombre@empresa.com"
                    style={{ width: '100%', padding: '0.75rem 0.875rem 0.75rem 2.5rem', border: '1.5px solid #E5E7EB', borderRadius: '0.75rem', fontSize: '0.9rem', color: '#0D1525', background: '#F9FAFB', boxSizing: 'border-box', outline: 'none', fontFamily: "'Inter',sans-serif" }}
                    onFocus={e => (e.target.style.borderColor = '#207E83')}
                    onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
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
                {loading ? 'Enviando...' : 'Enviar código'}
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link href="/login" style={{ color: '#207E83', fontSize: '0.82rem', textDecoration: 'none', fontFamily: "'Inter',sans-serif" }}>
              ← Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '0 1rem 2rem', fontSize: '0.65rem', color: '#374151', fontFamily: "'Inter',sans-serif" }}>
        © 2026 Bizware Consultoría. Todos los derechos reservados.
      </div>
    </div>
  );
}
