export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3202';

export const COMPANIES = [
  { codEmpresa: '22011489', shortName: 'CMO GROUP',  fullName: 'CMO GROUP S.A.' },
  { codEmpresa: '80688541', shortName: 'INTEGRAL',   fullName: 'INTEGRAL CONSULTORES S.A.C.' },
  { codEmpresa: '80688706', shortName: 'MEDARQ',     fullName: 'MEDARQ S.A.C.' },
  { codEmpresa: '80688524', shortName: 'AMERICANA',  fullName: 'COMPAÑÍA AMERICANA DE CONSTRUCCIÓN Y EQUIPAMIENTO S.A.C.' },
];

export const GRUPO = { codEmpresa: 'GRUPO', shortName: 'GRUPO', fullName: 'Consolidado del Grupo' };

export const CURRENT_YEAR = new Date().getFullYear();
export const MIN_YEAR = 2025;

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

export const COLORS_PIE = ['#207E83', '#F59E0B', '#10B981', '#2BB4BB', '#8E44AD', '#F97316', '#148F77', '#EF4444'];
export const COLORS_EMPRESA = ['#207E83', '#F59E0B', '#10B981', '#2BB4BB'];

export const CLASE_NAMES: Record<string, string> = {
  '10': 'Efectivo y Equivalentes (Caja y Bancos)',
  '12': 'Cuentas por Cobrar Comerciales',
  '13': 'CxC Comerciales — Relacionadas',
  '14': 'CxC al Personal y Accionistas',
  '16': 'Cuentas por Cobrar Diversas',
  '17': 'Entregas a Rendir',
  '18': 'Servicios Pagados por Anticipado',
  '40': 'Tributos por Pagar',
  '41': 'Remuneraciones y Participaciones por Pagar',
  '42': 'Cuentas por Pagar Comerciales',
  '43': 'CxP Comerciales — Relacionadas',
  '44': 'CxP a Directores y Gerentes',
  '45': 'Obligaciones Financieras',
  '46': 'Cuentas por Pagar Diversas',
  '47': 'CxP Diversas — Relacionadas',
  '70': 'Ingresos por Ventas',
  '75': 'Otros Ingresos de Gestión',
  '91': 'Costos Directos (Costo de Producción/Venta)',
  '94': 'Gastos Administrativos',
  '97': 'Gastos Financieros',
};
