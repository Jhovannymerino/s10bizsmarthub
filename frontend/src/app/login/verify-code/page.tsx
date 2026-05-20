'use client';
import React, { Suspense, useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3202';

function VerifyCodeContent() {
  const router = useRouter();
  const params = useSearchParams();
  const login = params.get('login') ?? '';

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  function handleDigit(i: number, val: string) {
    if (!/^\d*$/.test(val)) return;
    const next = [...digits];
    next[i] = val.slice(-1);
    setDigits(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      inputs.current[5]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/recovery/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, otp }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Código incorrecto');
      }
      router.push(`/login/reset-password?login=${encodeURIComponent(login)}&otp=${otp}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setResendMsg('');
    try {
      await fetch(`${API}/auth/recovery/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login }),
      });
      setResendMsg('Nuevo código enviado');
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setResending(false);
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
          <h1 style={{ fontFamily: "'Outfit',sans-serif", fontSize: '2.2rem', fontWeight: 900, color: '#F8FAFC', margin: 0, lineHeight: 1, letterSpacing: '-0.03em' }}>Verificar código</h1>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-3rem', padding: '0 1rem 3rem', position: 'relative', zIndex: 10 }}>
        <div style={{ background: '#ffffff', borderRadius: '1.5rem', padding: '2.5rem', width: '100%', maxWidth: 440, boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(32,126,131,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🔑</div>
          </div>

          <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: '1.4rem', fontWeight: 800, color: '#0D1525', textAlign: 'center', margin: '0 0 0.35rem 0' }}>Ingresa el código</h2>
          <p style={{ textAlign: 'center', color: '#8B97A8', fontSize: '0.85rem', margin: '0 0 0.5rem 0', fontFamily: "'Inter',sans-serif" }}>
            Enviamos un código de 6 dígitos a
          </p>
          <p style={{ textAlign: 'center', color: '#0D3B5E', fontSize: '0.88rem', fontWeight: 600, margin: '0 0 2rem 0', fontFamily: "'Inter',sans-serif" }}>
            {login}
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.75rem' }} onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputs.current[i] = el; }}
                  type="text" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleDigit(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  style={{
                    width: '3rem', height: '3.5rem', textAlign: 'center', fontSize: '1.5rem', fontWeight: 700,
                    border: '2px solid #E5E7EB', borderRadius: '0.75rem', outline: 'none', color: '#0D1525',
                    background: d ? '#F0FDF4' : '#F9FAFB', fontFamily: "'IBM Plex Mono',monospace",
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#207E83')}
                  onBlur={e => (e.target.style.borderColor = digits[i] ? '#10B981' : '#E5E7EB')}
                />
              ))}
            </div>

            {error && (
              <div style={{ padding: '0.625rem 0.875rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.75rem', color: '#EF4444', fontSize: '0.82rem', marginBottom: '1.25rem', textAlign: 'center', fontFamily: "'Inter',sans-serif" }}>
                {error}
              </div>
            )}
            {resendMsg && (
              <div style={{ padding: '0.5rem', color: '#059669', fontSize: '0.82rem', marginBottom: '1rem', textAlign: 'center', fontFamily: "'Inter',sans-serif" }}>
                {resendMsg}
              </div>
            )}

            <button type="submit" disabled={loading || digits.join('').length < 6}
              style={{ width: '100%', padding: '0.9rem', background: loading || digits.join('').length < 6 ? '#9CA3AF' : '#207E83', color: 'white', border: 'none', borderRadius: '0.875rem', fontSize: '0.85rem', fontWeight: 700, cursor: loading || digits.join('').length < 6 ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'Inter',sans-serif", boxShadow: digits.join('').length === 6 ? '0 4px 20px rgba(32,126,131,0.4)' : 'none' }}>
              {loading ? 'Verificando...' : 'Verificar código'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button onClick={handleResend} disabled={resending}
              style={{ background: 'none', border: 'none', color: '#207E83', fontSize: '0.82rem', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
              {resending ? 'Enviando...' : '¿No recibiste el código? Reenviar'}
            </button>
            <Link href="/login" style={{ color: '#9CA3AF', fontSize: '0.82rem', textDecoration: 'none', fontFamily: "'Inter',sans-serif" }}>
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

export default function VerifyCodePage() {
  return (
    <Suspense>
      <VerifyCodeContent />
    </Suspense>
  );
}
