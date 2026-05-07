'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3202';

const COMPANIES = [
  { name: 'CMO GROUP S.A.',                           abbr: 'CMO' },
  { name: 'INTEGRAL CONSULTORES S.A.C.',               abbr: 'INT' },
  { name: 'MEDARQ S.A.C.',                             abbr: 'MDQ' },
  { name: 'COMPAÑÍA AMERICANA DE CONSTRUCCIÓN S.A.C.', abbr: 'CAC' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#05080F' }}>

      {/* ── Left hero panel ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '3rem',
        background: 'linear-gradient(135deg, #050B16 0%, #0B1424 60%, #0D1F35 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, left: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(32,126,131,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, right: -60, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(32,126,131,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '3.5rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: '0.75rem', background: 'linear-gradient(135deg, #207E83, #2BB4BB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>
              S
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '1rem', color: '#F8FAFC', letterSpacing: '-0.02em', lineHeight: 1.1 }}>S10 BizSmartHub</div>
              <div style={{ fontSize: '0.62rem', color: '#8B97A8', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Dashboard Financiero</div>
            </div>
          </div>

          {/* Hero text */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2BB4BB', marginBottom: '0.5rem' }}>
              Inteligencia de Negocios
            </div>
            <h1 style={{ fontSize: '2.75rem', fontWeight: 900, color: '#F8FAFC', lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '-0.02em', margin: '0 0 1rem 0' }}>
              Control<br />
              <span style={{ color: '#2BB4BB' }}>Financiero</span><br />
              del Grupo
            </h1>
            <p style={{ color: '#8B97A8', fontSize: '0.88rem', lineHeight: 1.65, maxWidth: 320, margin: 0 }}>
              Consolidado financiero en tiempo real, aging de cartera y KPIs de gestión para todo el grupo empresarial.
            </p>
          </div>

          {/* Company chips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {COMPANIES.map((co) => (
              <div key={co.abbr} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: '0.5rem', background: 'rgba(32,126,131,0.12)', border: '1px solid rgba(32,126,131,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem', fontWeight: 800, color: '#2BB4BB', flexShrink: 0, letterSpacing: '0.03em' }}>
                  {co.abbr}
                </div>
                <span style={{ fontSize: '0.78rem', color: '#8B97A8' }}>{co.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: '0.65rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Powered by</span>
          <span style={{ fontWeight: 700, color: '#4B5563' }}>Bizware Consultoría</span>
          <span>·</span>
          <span>© 2026</span>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{ width: 440, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '3rem 3.5rem', background: '#05080F' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2BB4BB', marginBottom: '0.4rem' }}>
            Acceso Central
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#F8FAFC', margin: '0 0 0.4rem 0', lineHeight: 1.1 }}>
            Bienvenido de vuelta
          </h2>
          <p style={{ color: '#8B97A8', fontSize: '0.85rem', margin: 0 }}>Ingresa tus credenciales para continuar</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, marginBottom: '0.5rem', color: '#8B97A8', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
              Identidad Digital
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: '#8B97A8' }}>✉</span>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="nombre@empresa.com"
                style={{ width: '100%', padding: '0.75rem 0.875rem 0.75rem 2.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', fontSize: '0.9rem', color: '#F8FAFC', boxSizing: 'border-box', outline: 'none' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(32,126,131,0.6)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, marginBottom: '0.5rem', color: '#8B97A8', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
              Clave Secreta
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: '#8B97A8' }}>🔒</span>
              <input
                type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder="••••••••"
                style={{ width: '100%', padding: '0.75rem 2.75rem 0.75rem 2.5rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', fontSize: '0.9rem', color: '#F8FAFC', boxSizing: 'border-box', outline: 'none' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(32,126,131,0.6)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8B97A8', fontSize: '0.85rem', padding: 0 }}>
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: '0.625rem 0.875rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.75rem', color: '#EF4444', fontSize: '0.82rem', marginBottom: '1.25rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '0.875rem', background: loading ? 'rgba(32,126,131,0.4)' : 'linear-gradient(135deg, #207E83 0%, #2BB4BB 100%)', color: 'white', border: 'none', borderRadius: '0.75rem', fontSize: '0.82rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', transition: 'opacity 0.15s' }}>
            {loading ? 'Autenticando...' : 'Entrar al sistema →'}
          </button>
        </form>
      </div>
    </div>
  );
}
