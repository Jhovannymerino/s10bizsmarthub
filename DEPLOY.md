# Deploy — s10bizsmarthub.bizwareapps.com

## 1. Crear repositorio GitHub

```bash
# Desde PowerShell en C:\Users\jhova\OneDrive\antigravity-proyectos\s10bizsmarthub\
git init
git config user.email "jhovanny.merino@gmail.com"
git config user.name "Jhovanny Merino"
git checkout -b main
git add .
git commit -m "feat: initial S10 BizSmartHub scaffold"

# Opción A — con GitHub CLI:
gh repo create s10bizsmarthub --public --source=. --remote=origin --push

# Opción B — manual en github.com → New repo → s10bizsmarthub, luego:
git remote add origin https://github.com/<tu-usuario>/s10bizsmarthub.git
git push -u origin main
```

---

## 2. Clonar en el VPS

```bash
ssh root@72.62.16.28
cd /opt/apps
git clone https://github.com/<tu-usuario>/s10bizsmarthub.git
cd s10bizsmarthub
```

---

## 3. Configurar variables de entorno

```bash
cp backend/.env.example backend/.env
nano backend/.env
# Editar:
#   JWT_SECRET    → generar: openssl rand -hex 32
#   SYNC_API_KEY  → generar: openssl rand -hex 24
#   S10_SYNC_MODE → 'push' (recomendado) o 'direct'
```

---

## 4. Agregar bloque nginx al VPS

```bash
# Copiar contenido de nginx-s10block.conf dentro del http{} del nginx del VPS
cat nginx-s10block.conf >> /ruta/al/nginx.conf
docker exec nginx nginx -s reload
```

---

## 5. SSL con Certbot

```bash
certbot --nginx -d s10bizsmarthub.bizwareapps.com
```

---

## 6. Levantar contenedores

```bash
cd /opt/apps/s10bizsmarthub
docker compose -f docker-compose.prod.yml up -d --build
docker ps | grep s10biz
```

---

## 7. Agente local de Sync (red CMO)

```bash
cd s10-agent/
npm install
# Editar variables en sync-agent.js (S10_HOST, S10_PASSWORD, VPS_URL, SYNC_API_KEY)
node sync-agent.js --year=2026
# Programar en Windows Task Scheduler: diario 07:00, Lunes-Viernes
```

---

## Puertos (sin conflicto con Bizsmarthub actual)

| Servicio    | Puerto |
|-------------|--------|
| s10biz-db   | 5435   |
| s10biz-api  | 3202   |
| s10biz-web  | 3100   |
