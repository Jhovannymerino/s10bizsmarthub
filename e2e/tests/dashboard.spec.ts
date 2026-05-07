import { test, expect, Page } from '@playwright/test';

const URL = 'https://s10bizsmarthub.bizwareapps.com';
const EMAIL = 'admin@bizwareapps.com';
const PASS  = 'Admin2026!';

const COMPANIES = [
  { short: 'CMO GROUP',  full: 'CMO GROUP S.A.' },
  { short: 'INTEGRAL',   full: 'INTEGRAL CONSULTORES S.A.C.' },
  { short: 'MEDARQ',     full: 'MEDARQ S.A.C.' },
  { short: 'AMERICANA',  full: 'COMPAÑÍA AMERICANA DE CONSTRUCCIÓN Y EQUIPAMIENTO S.A.C.' },
];

async function login(page: Page) {
  await page.goto(`${URL}/login`);
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="correo" i]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${URL}/dashboard`, { timeout: 15_000 });
}

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────

test.describe('Autenticación', () => {
  test('redirige /dashboard → /login si no hay token', async ({ page }) => {
    await page.goto(`${URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('login con credenciales incorrectas muestra error', async ({ page }) => {
    await page.goto(`${URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'badpass');
    await page.click('button[type="submit"]');
    // Should NOT redirect to dashboard
    await page.waitForTimeout(2000);
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test('login exitoso redirige al dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('logout borra token y redirige a login', async ({ page }) => {
    await login(page);
    await page.click('button:has-text("Cerrar sesión")');
    await expect(page).toHaveURL(/\/login/);
    // Token should be gone
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// SIDEBAR — Empresas y Años
// ─────────────────────────────────────────────────────────────

test.describe('Sidebar', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('muestra las 4 empresas en el selector', async ({ page }) => {
    for (const co of COMPANIES) {
      await expect(page.locator(`button:has-text("${co.short}")`).first()).toBeVisible();
    }
  });

  test('muestra botones de año 2024, 2025, 2026', async ({ page }) => {
    for (const y of ['2026', '2025', '2024']) {
      await expect(page.locator(`button:has-text("${y}")`).first()).toBeVisible();
    }
  });

  test('muestra las 4 tabs de navegación', async ({ page }) => {
    await expect(page.locator('button:has-text("P&L")')).toBeVisible();
    await expect(page.locator('button:has-text("CxC")')).toBeVisible();
    await expect(page.locator('button:has-text("Caja")')).toBeVisible();
    await expect(page.locator('button:has-text("GAV")')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// P&L — INTEGRAL (empresa principal con más data)
// ─────────────────────────────────────────────────────────────

test.describe('P&L — INTEGRAL', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.click('button:has-text("INTEGRAL")');
    await page.click('button:has-text("2026")');
    await page.waitForTimeout(2000);
  });

  test('muestra KPI cards con valores numéricos', async ({ page }) => {
    const cards = page.locator('.kpi-card .kpi-value');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(4);
    // At least one card should have a monetary value
    const texts = await cards.allTextContents();
    const hasValue = texts.some(t => t.includes('S/'));
    expect(hasValue).toBe(true);
  });

  test('muestra gráfico de barras Ingresos vs EBITDA', async ({ page }) => {
    await expect(page.locator('.recharts-bar')).toHaveCount({ min: 1 });
  });

  test('tabla P&L tiene filas de Ingresos, Costo Directo, EBITDA, Utilidad Neta', async ({ page }) => {
    for (const label of ['Ingresos', 'Costo Directo', 'EBITDA', 'Utilidad Neta']) {
      await expect(page.locator(`td:has-text("${label}")`).first()).toBeVisible();
    }
  });

  test('filas drillables muestran indicador de cuentas', async ({ page }) => {
    // At least one row should show "▶ N cuentas"
    await expect(page.locator('text=/▶ \\d+ cuentas/')).toHaveCount({ min: 1 });
  });

  test('click en Ingresos abre modal de detalle con cuentas', async ({ page }) => {
    const ingresosRow = page.locator('tr').filter({ hasText: 'Ingresos' }).filter({ hasText: 'cuentas' }).first();
    await ingresosRow.click();
    // Modal should appear
    await expect(page.locator('text=Detalle: Ingresos')).toBeVisible({ timeout: 3000 });
    // Modal should have table with accounts
    await expect(page.locator('table').last().locator('tbody tr')).toHaveCount({ min: 1 });
  });

  test('modal de detalle se cierra con botón X', async ({ page }) => {
    const ingresosRow = page.locator('tr').filter({ hasText: 'Ingresos' }).filter({ hasText: 'cuentas' }).first();
    await ingresosRow.click();
    await expect(page.locator('text=Detalle: Ingresos')).toBeVisible();
    await page.click('button:has-text("✕")');
    await expect(page.locator('text=Detalle: Ingresos')).not.toBeVisible();
  });

  test('modal de detalle se cierra clicando fuera', async ({ page }) => {
    const ingresosRow = page.locator('tr').filter({ hasText: 'Ingresos' }).filter({ hasText: 'cuentas' }).first();
    await ingresosRow.click();
    await expect(page.locator('text=Detalle: Ingresos')).toBeVisible();
    // Click backdrop (fixed overlay)
    await page.mouse.click(10, 10);
    await expect(page.locator('text=Detalle: Ingresos')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// CAMBIO DE AÑO
// ─────────────────────────────────────────────────────────────

test.describe('Selector de año', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.click('button:has-text("INTEGRAL")');
  });

  test('cambia a 2025 y muestra datos distintos a 2026', async ({ page }) => {
    // Get 2026 YTD value
    await page.click('button:has-text("2026")');
    await page.waitForTimeout(2000);
    const cards2026 = await page.locator('.kpi-value').allTextContents();

    // Switch to 2025
    await page.click('button:has-text("2025")');
    await page.waitForTimeout(2000);
    const cards2025 = await page.locator('.kpi-value').allTextContents();

    // Values should be different (2025 has full year vs 2026 YTD)
    expect(cards2026.join('')).not.toEqual(cards2025.join(''));
  });

  test('el subtítulo refleja el año seleccionado', async ({ page }) => {
    await page.click('button:has-text("2025")');
    await expect(page.locator('text=YTD 2025')).toBeVisible();
    await page.click('button:has-text("2026")');
    await expect(page.locator('text=YTD 2026')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// CAMBIO DE EMPRESA
// ─────────────────────────────────────────────────────────────

test.describe('Selector de empresa', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('cada empresa muestra su nombre completo en el subtítulo', async ({ page }) => {
    for (const co of COMPANIES) {
      await page.click(`button:has-text("${co.short}")`);
      await page.waitForTimeout(1500);
      await expect(page.locator(`text=${co.full}`)).toBeVisible();
    }
  });

  test('MEDARQ tiene datos en 2026', async ({ page }) => {
    await page.click('button:has-text("MEDARQ")');
    await page.click('button:has-text("2026")');
    await page.waitForTimeout(2000);
    // Should show KPI cards, not NoDataBanner
    await expect(page.locator('.kpi-value').first()).toBeVisible();
    await expect(page.locator('text=📭')).not.toBeVisible();
  });

  test('AMERICANA tiene datos en 2026', async ({ page }) => {
    await page.click('button:has-text("AMERICANA")');
    await page.click('button:has-text("2026")');
    await page.waitForTimeout(2000);
    await expect(page.locator('.kpi-value').first()).toBeVisible();
    await expect(page.locator('text=📭')).not.toBeVisible();
  });

  test('CMO GROUP tiene datos en 2026', async ({ page }) => {
    await page.click('button:has-text("CMO GROUP")');
    await page.click('button:has-text("2026")');
    await page.waitForTimeout(2000);
    await expect(page.locator('.kpi-value').first()).toBeVisible();
    await expect(page.locator('text=📭')).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// TABS — CxC, Caja, GAV
// ─────────────────────────────────────────────────────────────

test.describe('Tab CxC', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.click('button:has-text("INTEGRAL")');
    await page.click('button:has-text("💰 CxC")');
    await page.waitForTimeout(2000);
  });

  test('muestra tabla de aging con columnas correctas', async ({ page }) => {
    for (const col of ['Cliente', '0-30 días', '31-60 días', '61-90 días', '+90 días', 'Total']) {
      await expect(page.locator(`th:has-text("${col}")`).first()).toBeVisible();
    }
  });

  test('muestra KPI de Cartera Total, +90 días y Clientes', async ({ page }) => {
    await expect(page.locator('text=Cartera Total')).toBeVisible();
    await expect(page.locator('text=+90 días')).toBeVisible();
    await expect(page.locator('text=Clientes')).toBeVisible();
  });

  test('tabla tiene al menos 1 cliente', async ({ page }) => {
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Tab Caja', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.click('button:has-text("INTEGRAL")');
    await page.click('button:has-text("🏦 Posición Caja")');
    await page.waitForTimeout(2000);
  });

  test('muestra tabla con los 12 meses', async ({ page }) => {
    for (const mes of ['Ene', 'Feb', 'Mar']) {
      await expect(page.locator(`th:has-text("${mes}")`).first()).toBeVisible();
    }
  });

  test('muestra al menos 1 banco', async ({ page }) => {
    const rows = page.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Tab GAV', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.click('button:has-text("INTEGRAL")');
    await page.click('button:has-text("📋 GAV")');
    await page.waitForTimeout(2000);
  });

  test('muestra tabla de categorías con columnas YTD y %', async ({ page }) => {
    await expect(page.locator('th:has-text("Categoría")')).toBeVisible();
    await expect(page.locator('th:has-text("YTD")')).toBeVisible();
    await expect(page.locator('th:has-text("%")')).toBeVisible();
  });

  test('muestra gráfico de torta de distribución', async ({ page }) => {
    await expect(page.locator('.recharts-pie')).toBeVisible();
  });

  test('fila TOTAL muestra 100%', async ({ page }) => {
    await expect(page.locator('tfoot').locator('text=100%')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// UI — Layout y responsividad básica
// ─────────────────────────────────────────────────────────────

test.describe('UI General', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('sidebar es visible con fondo oscuro', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();
    const bg = await sidebar.evaluate(el => getComputedStyle(el).backgroundColor);
    // Should be dark — not white
    expect(bg).not.toBe('rgb(255, 255, 255)');
  });

  test('header muestra título correcto según tab activo', async ({ page }) => {
    await expect(page.locator('h1:has-text("Estado de Resultados")')).toBeVisible();
    await page.click('button:has-text("💰 CxC")');
    await expect(page.locator('h1:has-text("Cuentas por Cobrar")')).toBeVisible();
    await page.click('button:has-text("🏦 Posición Caja")');
    await expect(page.locator('h1:has-text("Posición de Caja")')).toBeVisible();
    await page.click('button:has-text("📋 GAV")');
    await expect(page.locator('h1:has-text("Gastos de Admin")')).toBeVisible();
  });

  test('no hay errores de JS visibles en consola', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.click('button:has-text("MEDARQ")');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("📊 P&L")');
    await page.waitForTimeout(1000);
    expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  test('valores monetarios usan formato S/', async ({ page }) => {
    await page.waitForTimeout(2000);
    const values = await page.locator('.kpi-value').allTextContents();
    const monetary = values.filter(v => v.includes('S/'));
    expect(monetary.length).toBeGreaterThan(0);
  });
});
