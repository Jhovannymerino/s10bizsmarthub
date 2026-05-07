# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> P&L — INTEGRAL >> muestra gráfico de barras Ingresos vs EBITDA
- Location: tests\dashboard.spec.ts:106:7

# Error details

```
Error: locator._expect: expectedNumber: expected float, got object
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e6]: S10 BizSmartHub
      - generic [ref=e7]:
        - generic [ref=e8]: Empresa
        - button "CMO GROUP" [ref=e9] [cursor=pointer]
        - button "INTEGRAL" [ref=e10] [cursor=pointer]
        - button "MEDARQ" [ref=e11] [cursor=pointer]
        - button "AMERICANA" [ref=e12] [cursor=pointer]
      - generic [ref=e13]:
        - generic [ref=e14]: Año
        - button "2026" [active] [ref=e15] [cursor=pointer]
        - button "2025" [ref=e16] [cursor=pointer]
        - button "2024" [ref=e17] [cursor=pointer]
      - navigation [ref=e18]:
        - button "📊 P&L" [ref=e19] [cursor=pointer]
        - button "💰 CxC Aging" [ref=e20] [cursor=pointer]
        - button "🏦 Posición Caja" [ref=e21] [cursor=pointer]
        - button "📋 GAV Detalle" [ref=e22] [cursor=pointer]
      - button "Cerrar sesión" [ref=e24] [cursor=pointer]
    - generic [ref=e25]:
      - generic [ref=e27]:
        - heading "Estado de Resultados" [level=1] [ref=e28]
        - generic [ref=e29]: "INTEGRAL CONSULTORES S.A.C. · YTD 2026 · Fuente: S10 ERP"
      - generic [ref=e30]:
        - generic [ref=e31]:
          - generic [ref=e32]: Ingresos YTD
          - generic [ref=e33]: S/ 2.68M
        - generic [ref=e34]:
          - generic [ref=e35]: Margen Bruto
          - generic [ref=e36]: S/ 3.91M
          - generic [ref=e37]: 145.8%
        - generic [ref=e38]:
          - generic [ref=e39]: EBITDA
          - generic [ref=e40]: S/ 2.81M
          - generic [ref=e41]: 104.8%
        - generic [ref=e42]:
          - generic [ref=e43]: GAV
          - generic [ref=e44]: S/ 1.10M
        - generic [ref=e45]:
          - generic [ref=e46]: Utilidad Neta
          - generic [ref=e47]: S/ 2.68M
      - generic [ref=e48]:
        - generic [ref=e49]: Ingresos vs EBITDA — Mensual
        - img [ref=e52]:
          - generic [ref=e57]:
            - generic [ref=e59]: Ene
            - generic [ref=e61]: Feb
            - generic [ref=e63]: Mar
          - generic [ref=e65]:
            - generic [ref=e67]: 0K
            - generic [ref=e69]: 300K
            - generic [ref=e71]: 600K
            - generic [ref=e73]: 900K
            - generic [ref=e75]: 1200K
      - generic [ref=e94]:
        - generic [ref=e95]:
          - generic [ref=e96]: Detalle Mensual
          - generic [ref=e97]: Click en Ingresos, Costo, GAV o Gastos para ver el desglose de cuentas
        - table [ref=e99]:
          - rowgroup [ref=e100]:
            - row "Concepto Ene Feb Mar Abr YTD" [ref=e101]:
              - columnheader "Concepto" [ref=e102]
              - columnheader "Ene" [ref=e103]
              - columnheader "Feb" [ref=e104]
              - columnheader "Mar" [ref=e105]
              - columnheader "Abr" [ref=e106]
              - columnheader "YTD" [ref=e107]
          - rowgroup [ref=e108]:
            - row "Ingresos▶ 1 cuentas S/ 752K S/ 862K S/ 1.07M S/ 0 S/ 2.68M" [ref=e109] [cursor=pointer]:
              - cell "Ingresos▶ 1 cuentas" [ref=e110]:
                - text: Ingresos
                - generic [ref=e111]: ▶ 1 cuentas
              - cell "S/ 752K" [ref=e112]
              - cell "S/ 862K" [ref=e113]
              - cell "S/ 1.07M" [ref=e114]
              - cell "S/ 0" [ref=e115]
              - cell "S/ 2.68M" [ref=e116]
            - row "Costo Directo▶ 7 cuentas S/ -253K S/ -173K S/ -584K S/ -244K S/ -1.23M" [ref=e117] [cursor=pointer]:
              - cell "Costo Directo▶ 7 cuentas" [ref=e118]:
                - text: Costo Directo
                - generic [ref=e119]: ▶ 7 cuentas
              - cell "S/ -253K" [ref=e120]
              - cell "S/ -173K" [ref=e121]
              - cell "S/ -584K" [ref=e122]
              - cell "S/ -244K" [ref=e123]
              - cell "S/ -1.23M" [ref=e124]
            - row "Margen Bruto S/ 1.01M S/ 1.03M S/ 1.65M S/ 244K S/ 3.91M" [ref=e125]:
              - cell "Margen Bruto" [ref=e126]
              - cell "S/ 1.01M" [ref=e127]
              - cell "S/ 1.03M" [ref=e128]
              - cell "S/ 1.65M" [ref=e129]
              - cell "S/ 244K" [ref=e130]
              - cell "S/ 3.91M" [ref=e131]
            - row "% Margen 133.7% 120.0% 154.7% 0.0% 145.8%" [ref=e132]:
              - cell "% Margen" [ref=e133]
              - cell "133.7%" [ref=e134]
              - cell "120.0%" [ref=e135]
              - cell "154.7%" [ref=e136]
              - cell "0.0%" [ref=e137]
              - cell "145.8%" [ref=e138]
            - row "GAV▶ 45 cuentas S/ 232K S/ 167K S/ 501K S/ 226K S/ 1.10M" [ref=e139] [cursor=pointer]:
              - cell "GAV▶ 45 cuentas" [ref=e140]:
                - text: GAV
                - generic [ref=e141]: ▶ 45 cuentas
              - cell "S/ 232K" [ref=e142]
              - cell "S/ 167K" [ref=e143]
              - cell "S/ 501K" [ref=e144]
              - cell "S/ 226K" [ref=e145]
              - cell "S/ 1.10M" [ref=e146]
            - row "EBITDA S/ 773K S/ 868K S/ 1.15M S/ 18K S/ 2.81M" [ref=e147]:
              - cell "EBITDA" [ref=e148]
              - cell "S/ 773K" [ref=e149]
              - cell "S/ 868K" [ref=e150]
              - cell "S/ 1.15M" [ref=e151]
              - cell "S/ 18K" [ref=e152]
              - cell "S/ 2.81M" [ref=e153]
            - row "% EBITDA 102.9% 100.7% 107.7% 0.0% 104.8%" [ref=e154]:
              - cell "% EBITDA" [ref=e155]
              - cell "102.9%" [ref=e156]
              - cell "100.7%" [ref=e157]
              - cell "107.7%" [ref=e158]
              - cell "0.0%" [ref=e159]
              - cell "104.8%" [ref=e160]
            - row "Gastos Financieros▶ 4 cuentas S/ 22K S/ 6K S/ 82K S/ 18K S/ 128K" [ref=e161] [cursor=pointer]:
              - cell "Gastos Financieros▶ 4 cuentas" [ref=e162]:
                - text: Gastos Financieros
                - generic [ref=e163]: ▶ 4 cuentas
              - cell "S/ 22K" [ref=e164]
              - cell "S/ 6K" [ref=e165]
              - cell "S/ 82K" [ref=e166]
              - cell "S/ 18K" [ref=e167]
              - cell "S/ 128K" [ref=e168]
            - row "Utilidad Neta S/ 752K S/ 862K S/ 1.07M S/ 0 S/ 2.68M" [ref=e169]:
              - cell "Utilidad Neta" [ref=e170]
              - cell "S/ 752K" [ref=e171]
              - cell "S/ 862K" [ref=e172]
              - cell "S/ 1.07M" [ref=e173]
              - cell "S/ 0" [ref=e174]
              - cell "S/ 2.68M" [ref=e175]
  - generic [ref=e176]: 300K
```

# Test source

```ts
  7   | const COMPANIES = [
  8   |   { short: 'CMO GROUP',  full: 'CMO GROUP S.A.' },
  9   |   { short: 'INTEGRAL',   full: 'INTEGRAL CONSULTORES S.A.C.' },
  10  |   { short: 'MEDARQ',     full: 'MEDARQ S.A.C.' },
  11  |   { short: 'AMERICANA',  full: 'COMPAÑÍA AMERICANA DE CONSTRUCCIÓN Y EQUIPAMIENTO S.A.C.' },
  12  | ];
  13  | 
  14  | async function login(page: Page) {
  15  |   await page.goto(`${URL}/login`);
  16  |   await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i], input[placeholder*="correo" i]', EMAIL);
  17  |   await page.fill('input[type="password"]', PASS);
  18  |   await page.click('button[type="submit"]');
  19  |   await page.waitForURL(`${URL}/dashboard`, { timeout: 15_000 });
  20  | }
  21  | 
  22  | // ─────────────────────────────────────────────────────────────
  23  | // AUTH
  24  | // ─────────────────────────────────────────────────────────────
  25  | 
  26  | test.describe('Autenticación', () => {
  27  |   test('redirige /dashboard → /login si no hay token', async ({ page }) => {
  28  |     await page.goto(`${URL}/dashboard`);
  29  |     await expect(page).toHaveURL(/\/login/);
  30  |   });
  31  | 
  32  |   test('login con credenciales incorrectas muestra error', async ({ page }) => {
  33  |     await page.goto(`${URL}/login`);
  34  |     await page.fill('input[type="email"], input[name="email"]', 'wrong@email.com');
  35  |     await page.fill('input[type="password"]', 'badpass');
  36  |     await page.click('button[type="submit"]');
  37  |     // Should NOT redirect to dashboard
  38  |     await page.waitForTimeout(2000);
  39  |     await expect(page).not.toHaveURL(/\/dashboard/);
  40  |   });
  41  | 
  42  |   test('login exitoso redirige al dashboard', async ({ page }) => {
  43  |     await login(page);
  44  |     await expect(page).toHaveURL(/\/dashboard/);
  45  |   });
  46  | 
  47  |   test('logout borra token y redirige a login', async ({ page }) => {
  48  |     await login(page);
  49  |     await page.click('button:has-text("Cerrar sesión")');
  50  |     await expect(page).toHaveURL(/\/login/);
  51  |     // Token should be gone
  52  |     const token = await page.evaluate(() => localStorage.getItem('token'));
  53  |     expect(token).toBeNull();
  54  |   });
  55  | });
  56  | 
  57  | // ─────────────────────────────────────────────────────────────
  58  | // SIDEBAR — Empresas y Años
  59  | // ─────────────────────────────────────────────────────────────
  60  | 
  61  | test.describe('Sidebar', () => {
  62  |   test.beforeEach(async ({ page }) => { await login(page); });
  63  | 
  64  |   test('muestra las 4 empresas en el selector', async ({ page }) => {
  65  |     for (const co of COMPANIES) {
  66  |       await expect(page.locator(`button:has-text("${co.short}")`).first()).toBeVisible();
  67  |     }
  68  |   });
  69  | 
  70  |   test('muestra botones de año 2024, 2025, 2026', async ({ page }) => {
  71  |     for (const y of ['2026', '2025', '2024']) {
  72  |       await expect(page.locator(`button:has-text("${y}")`).first()).toBeVisible();
  73  |     }
  74  |   });
  75  | 
  76  |   test('muestra las 4 tabs de navegación', async ({ page }) => {
  77  |     await expect(page.locator('button:has-text("P&L")')).toBeVisible();
  78  |     await expect(page.locator('button:has-text("CxC")')).toBeVisible();
  79  |     await expect(page.locator('button:has-text("Caja")')).toBeVisible();
  80  |     await expect(page.locator('button:has-text("GAV")')).toBeVisible();
  81  |   });
  82  | });
  83  | 
  84  | // ─────────────────────────────────────────────────────────────
  85  | // P&L — INTEGRAL (empresa principal con más data)
  86  | // ─────────────────────────────────────────────────────────────
  87  | 
  88  | test.describe('P&L — INTEGRAL', () => {
  89  |   test.beforeEach(async ({ page }) => {
  90  |     await login(page);
  91  |     await page.click('button:has-text("INTEGRAL")');
  92  |     await page.click('button:has-text("2026")');
  93  |     await page.waitForTimeout(2000);
  94  |   });
  95  | 
  96  |   test('muestra KPI cards con valores numéricos', async ({ page }) => {
  97  |     const cards = page.locator('.kpi-card .kpi-value');
  98  |     const count = await cards.count();
  99  |     expect(count).toBeGreaterThanOrEqual(4);
  100 |     // At least one card should have a monetary value
  101 |     const texts = await cards.allTextContents();
  102 |     const hasValue = texts.some(t => t.includes('S/'));
  103 |     expect(hasValue).toBe(true);
  104 |   });
  105 | 
  106 |   test('muestra gráfico de barras Ingresos vs EBITDA', async ({ page }) => {
> 107 |     await expect(page.locator('.recharts-bar')).toHaveCount({ min: 1 });
      |                                                 ^ Error: locator._expect: expectedNumber: expected float, got object
  108 |   });
  109 | 
  110 |   test('tabla P&L tiene filas de Ingresos, Costo Directo, EBITDA, Utilidad Neta', async ({ page }) => {
  111 |     for (const label of ['Ingresos', 'Costo Directo', 'EBITDA', 'Utilidad Neta']) {
  112 |       await expect(page.locator(`td:has-text("${label}")`).first()).toBeVisible();
  113 |     }
  114 |   });
  115 | 
  116 |   test('filas drillables muestran indicador de cuentas', async ({ page }) => {
  117 |     // At least one row should show "▶ N cuentas"
  118 |     await expect(page.locator('text=/▶ \\d+ cuentas/')).toHaveCount({ min: 1 });
  119 |   });
  120 | 
  121 |   test('click en Ingresos abre modal de detalle con cuentas', async ({ page }) => {
  122 |     const ingresosRow = page.locator('tr').filter({ hasText: 'Ingresos' }).filter({ hasText: 'cuentas' }).first();
  123 |     await ingresosRow.click();
  124 |     // Modal should appear
  125 |     await expect(page.locator('text=Detalle: Ingresos')).toBeVisible({ timeout: 3000 });
  126 |     // Modal should have table with accounts
  127 |     await expect(page.locator('table').last().locator('tbody tr')).toHaveCount({ min: 1 });
  128 |   });
  129 | 
  130 |   test('modal de detalle se cierra con botón X', async ({ page }) => {
  131 |     const ingresosRow = page.locator('tr').filter({ hasText: 'Ingresos' }).filter({ hasText: 'cuentas' }).first();
  132 |     await ingresosRow.click();
  133 |     await expect(page.locator('text=Detalle: Ingresos')).toBeVisible();
  134 |     await page.click('button:has-text("✕")');
  135 |     await expect(page.locator('text=Detalle: Ingresos')).not.toBeVisible();
  136 |   });
  137 | 
  138 |   test('modal de detalle se cierra clicando fuera', async ({ page }) => {
  139 |     const ingresosRow = page.locator('tr').filter({ hasText: 'Ingresos' }).filter({ hasText: 'cuentas' }).first();
  140 |     await ingresosRow.click();
  141 |     await expect(page.locator('text=Detalle: Ingresos')).toBeVisible();
  142 |     // Click backdrop (fixed overlay)
  143 |     await page.mouse.click(10, 10);
  144 |     await expect(page.locator('text=Detalle: Ingresos')).not.toBeVisible();
  145 |   });
  146 | });
  147 | 
  148 | // ─────────────────────────────────────────────────────────────
  149 | // CAMBIO DE AÑO
  150 | // ─────────────────────────────────────────────────────────────
  151 | 
  152 | test.describe('Selector de año', () => {
  153 |   test.beforeEach(async ({ page }) => {
  154 |     await login(page);
  155 |     await page.click('button:has-text("INTEGRAL")');
  156 |   });
  157 | 
  158 |   test('cambia a 2025 y muestra datos distintos a 2026', async ({ page }) => {
  159 |     // Get 2026 YTD value
  160 |     await page.click('button:has-text("2026")');
  161 |     await page.waitForTimeout(2000);
  162 |     const cards2026 = await page.locator('.kpi-value').allTextContents();
  163 | 
  164 |     // Switch to 2025
  165 |     await page.click('button:has-text("2025")');
  166 |     await page.waitForTimeout(2000);
  167 |     const cards2025 = await page.locator('.kpi-value').allTextContents();
  168 | 
  169 |     // Values should be different (2025 has full year vs 2026 YTD)
  170 |     expect(cards2026.join('')).not.toEqual(cards2025.join(''));
  171 |   });
  172 | 
  173 |   test('el subtítulo refleja el año seleccionado', async ({ page }) => {
  174 |     await page.click('button:has-text("2025")');
  175 |     await expect(page.locator('text=YTD 2025')).toBeVisible();
  176 |     await page.click('button:has-text("2026")');
  177 |     await expect(page.locator('text=YTD 2026')).toBeVisible();
  178 |   });
  179 | });
  180 | 
  181 | // ─────────────────────────────────────────────────────────────
  182 | // CAMBIO DE EMPRESA
  183 | // ─────────────────────────────────────────────────────────────
  184 | 
  185 | test.describe('Selector de empresa', () => {
  186 |   test.beforeEach(async ({ page }) => { await login(page); });
  187 | 
  188 |   test('cada empresa muestra su nombre completo en el subtítulo', async ({ page }) => {
  189 |     for (const co of COMPANIES) {
  190 |       await page.click(`button:has-text("${co.short}")`);
  191 |       await page.waitForTimeout(1500);
  192 |       await expect(page.locator(`text=${co.full}`)).toBeVisible();
  193 |     }
  194 |   });
  195 | 
  196 |   test('MEDARQ tiene datos en 2026', async ({ page }) => {
  197 |     await page.click('button:has-text("MEDARQ")');
  198 |     await page.click('button:has-text("2026")');
  199 |     await page.waitForTimeout(2000);
  200 |     // Should show KPI cards, not NoDataBanner
  201 |     await expect(page.locator('.kpi-value').first()).toBeVisible();
  202 |     await expect(page.locator('text=📭')).not.toBeVisible();
  203 |   });
  204 | 
  205 |   test('AMERICANA tiene datos en 2026', async ({ page }) => {
  206 |     await page.click('button:has-text("AMERICANA")');
  207 |     await page.click('button:has-text("2026")');
```