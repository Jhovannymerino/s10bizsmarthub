# GitHub Setup — s10bizsmarthub

Ejecutar los siguientes comandos desde PowerShell en la carpeta del proyecto.

## Paso 1 — Inicializar repo local

```powershell
# Desde PowerShell:
cd C:\Users\jhova\OneDrive\antigravity-proyectos\s10bizsmarthub

git init
git config user.email "jhovanny.merino@gmail.com"
git config user.name "Jhovanny Merino"
git checkout -b main
git add .
git commit -m "feat: S10 BizSmartHub initial scaffold"
```

## Paso 2 — Crear repositorio en GitHub y subir

### Opción A — con GitHub CLI (recomendado)

```powershell
# Verificar que gh esté instalado y autenticado:
gh auth status

# Crear repo y subir:
gh repo create s10bizsmarthub --public --source=. --remote=origin --push
```

### Opción B — manual

1. Ir a https://github.com/new
2. Repository name: `s10bizsmarthub`
3. Visibility: Public (o Private)
4. **No** marcar "Initialize this repository" (ya tienes código)
5. Click "Create repository"
6. Luego en PowerShell:

```powershell
git remote add origin https://github.com/jhovanny.merino/s10bizsmarthub.git
git push -u origin main
```

> ⚠️ Reemplaza `jhovanny.merino` con tu username real de GitHub si es diferente.

## Paso 3 — Verificar que .gitignore excluye archivos sensibles

El `.gitignore` ya incluye:
- `*.env` (pero NO `.env.example`)
- `node_modules/`
- `.next/`
- `dist/`

**NUNCA subas el archivo `backend/.env` con credenciales reales al repositorio.**

## Estructura del repositorio

```
s10bizsmarthub/
├── backend/               NestJS API (puerto 3202)
│   ├── src/
│   │   └── modules/
│   │       ├── s10/       Conexión SQL Server + queries
│   │       ├── kpi/       Procesamiento y cache de KPIs
│   │       ├── sync/      Endpoints push y direct sync
│   │       ├── auth/      JWT auth
│   │       ├── company/   CRUD empresas
│   │       └── prisma/    ORM PostgreSQL
│   ├── prisma/
│   │   └── schema.prisma  Modelos: KpiSnapshot, Company, SyncLog, User
│   ├── .env.example       Template de variables (sin secretos)
│   └── Dockerfile
├── frontend/              Next.js 14 dashboard (puerto 3100)
│   └── src/app/
│       ├── dashboard/     P&L, CxC, Caja, GAV
│       └── login/         Autenticación JWT
├── s10-agent/             Agente local Node.js
│   └── sync-agent.js      Conecta a S10 y POSTea al VPS
├── docker-compose.yml     Desarrollo local
├── docker-compose.prod.yml  Producción VPS
├── nginx-s10block.conf    Bloque nginx para el VPS
└── DEPLOY.md              Instrucciones de despliegue
```
