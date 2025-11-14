# Deployment Guide

## 📋 Oversikt

**Frontend**: React/Vite-applikasjon  
**Backend**: Lovable Cloud (autentisering, database, edge functions)

---

## ✅ Lovable Cloud (Anbefalt)

1. Koble til GitHub i Lovable editor
2. Klikk **Publish** → app deployes automatisk
3. Opprett første bruker (blir automatisk admin)
4. Konfigurer Jellyfin i Admin → Servere

Se [README.md](README.md) for detaljer.

---

## 🖥️ Self-Hosted (Ubuntu + Nginx)

### Installasjon

```bash
# 1. Installer Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# 2. Klon og installer
git clone https://github.com/gjerdet/jelly-stream-viewer.git
cd jelly-stream-viewer
npm install

# 3. Konfigurer miljø
cp .env.example .env
nano .env  # Fyll inn Lovable Cloud-verdier

# 4. Bygg
npm run build

# 5. Konfigurer Nginx
sudo nano /etc/nginx/sites-available/jelly-stream-viewer
```

**Nginx config**:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /home/user/jelly-stream-viewer/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/jelly-stream-viewer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL (Valgfritt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 🔒 Viktig

- ⚠️ **ALDRI commit `.env`** til Git
- Backend kjører på Lovable Cloud (ikke lokal)
- Self-hosted = kun frontend på egen server
