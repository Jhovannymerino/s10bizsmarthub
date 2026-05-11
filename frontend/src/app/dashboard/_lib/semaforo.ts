export type Signal = 'green' | 'yellow' | 'red' | 'neutral';

export function semaforo(key: string, value: number | null): Signal {
  if (value === null || value === undefined) return 'neutral';
  const v = value;
  switch (key) {
    case 'margenBrutoPct': return v >= 30 ? 'green' : v >= 15 ? 'yellow' : 'red';
    case 'ebitdaPct':      return v >= 15 ? 'green' : v >= 5  ? 'yellow' : 'red';
    case 'margenNetoPct':  return v >= 10 ? 'green' : v >= 3  ? 'yellow' : 'red';
    case 'gavPct':         return v <= 15 ? 'green' : v <= 25 ? 'yellow' : 'red';
    case 'dso':            return v <= 60 ? 'green' : v <= 90 ? 'yellow' : 'red';
    case 'covIntereses':   return v >= 3  ? 'green' : v >= 1.5? 'yellow' : 'red';
    case 'pct90mas':       return v <= 20 ? 'green' : v <= 40 ? 'yellow' : 'red';
    case 'concentracion':  return v <= 50 ? 'green' : v <= 70 ? 'yellow' : 'red';
    default: return 'neutral';
  }
}

export const SIGNAL_COLOR: Record<Signal, string> = {
  green: '#10B981', yellow: '#F59E0B', red: '#EF4444', neutral: '#8B97A8',
};

export const SIGNAL_DOT: Record<Signal, string> = {
  green: '🟢', yellow: '🟡', red: '🔴', neutral: '',
};
