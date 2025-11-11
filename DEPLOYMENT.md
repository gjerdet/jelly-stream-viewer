# Deployment Guide

This guide covers deployment options for Jelly Stream Viewer.

## Overview

Jelly Stream Viewer can be deployed in two ways:
1. **Lovable Cloud** (Recommended) - Fully managed, automatic deployment
2. **Self-Hosted** - Full control, requires manual setup

## Prerequisites

Before deploying, ensure you have:
- ✅ A Jellyfin media server with API access
- ✅ (Optional) Jellyseerr instance for content requests
- ✅ GitHub account (for version control)
- ✅ Modern web browser for testing

---

## Option 1: Lovable Cloud Deployment (Recommended)

### Why Lovable Cloud?

- **Zero Configuration**: Backend automatically provisioned
- **Automatic Deployments**: Push to GitHub, auto-deploy
- **Managed Infrastructure**: Database, auth, edge functions handled
- **Free Tier Available**: Get started at no cost
- **Built-in SSL**: HTTPS by default
- **Global CDN**: Fast worldwide

### Deployment Steps

#### 1. Connect to GitHub

1. In Lovable editor, click **GitHub** in top-right
2. Click **Connect to GitHub**
3. Authorize Lovable GitHub App
4. Select organization/account
5. Click **Create Repository**

Your code is now synced to GitHub with automatic bidirectional sync.

#### 2. Backend Setup

The backend (database, auth, edge functions) is already set up through Lovable Cloud.

No additional configuration needed!

#### 3. First-Time Configuration

1. **Deploy the App**
   - Click **Publish** button (top-right)
   - Your app will be deployed to a Lovable staging URL

2. **Create Admin Account**
   - Visit your deployed app URL
   - Click **Register**
   - Create your account
   - **First user is automatically admin**

3. **Configure Jellyfin**
   - Log in with your new account
   - Navigate to **Admin → Servers** tab
   - Enter Jellyfin settings:
     - **Server URL**: Your Jellyfin server URL
     - **API Key**: Generate in Jellyfin Dashboard → Advanced → API Keys

4. **(Optional) Configure Jellyseerr**
   - In the same Servers tab
   - Enter Jellyseerr URL and API Key

#### 4. Custom Domain (Optional)

1. Click **Settings** in Lovable editor
2. Go to **Domains** tab
3. Add your custom domain
4. Update DNS records as instructed
5. SSL certificate auto-generated

### Updating Your App

**Automatic Deployment**:
- Make changes in Lovable editor
- Changes sync to GitHub
- Click **Update** in publish dialog
- App deploys automatically

**Version Control**:
- All changes tracked in GitHub
- Use Git branches for feature development
- Lovable supports branch switching (enable in Labs)

### Monitoring

**Built-in Tools**:
- Backend panel: View database, logs
- Real-time updates: Watch edge function execution
- Error tracking: Automatic error logs

---

## Option 2: Self-Hosted Deployment

### Why Self-Host?

- **Full Control**: Own your infrastructure
- **Privacy**: All data on your servers
- **Customization**: Modify anything
- **Cost**: Can be cheaper at scale

### Requirements

- **Ubuntu Server 20.04+** (or similar Linux)
- **Node.js 18+** and npm
- **Nginx** (or similar web server)
- **Lovable Cloud** or **Supabase** account (for backend)
- **Git** installed
- (Optional) **Domain name** for SSL

### Installation Steps

#### 1. Clone Repository

```bash
# SSH into your server
ssh user@your-server-ip

# Clone your repository
git clone https://github.com/yourusername/jelly-stream-viewer.git
cd jelly-stream-viewer
```

#### 2. Install Dependencies

```bash
# Install Node.js if needed
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install project dependencies
npm install
```

#### 3. Configure Environment

Create `.env` file:

```bash
cp .env.example .env
nano .env
```

Fill in your credentials:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

Get these from:
- **Lovable Cloud**: Settings → Backend → Connection Details
- **Supabase**: Project Settings → API

#### 4. Build Application

```bash
npm run build
```

This creates production files in `dist/` directory.

#### 5. Configure Nginx

Install Nginx:

```bash
sudo apt update
sudo apt install nginx
```

Create site configuration:

```bash
sudo nano /etc/nginx/sites-available/jelly-stream
```

Add configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # or server IP
    
    root /path/to/jelly-stream-viewer/dist;
    index index.html;
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/jelly-stream /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 6. Configure Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

#### 7. SSL Certificate (Recommended)

Using Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certificate auto-renews via cron.

#### 8. Setup Systemd Service (Optional)

For easier management:

```bash
sudo nano /etc/systemd/system/jelly-stream.service
```

Add:

```ini
[Unit]
Description=Jelly Stream Viewer
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/jelly-stream-viewer
ExecStart=/usr/bin/npm run preview
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable jelly-stream
sudo systemctl start jelly-stream
```

### Update System (Self-Hosted)

#### Manual Updates

```bash
cd /path/to/jelly-stream-viewer
git pull origin main
npm install
npm run build
sudo systemctl reload nginx
```

#### Automated Updates (Advanced)

The app includes update tracking. To enable installation:

1. **Create Update Webhook Server**

Create `update-webhook.js`:

```javascript
const express = require('express');
const { exec } = require('child_process');
const app = express();

app.use(express.json());

app.post('/update', (req, res) => {
  const secret = req.headers['x-update-secret'];
  
  if (secret !== process.env.UPDATE_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  res.json({ message: 'Update started' });
  
  // Run update in background
  exec(`cd ${process.env.APP_DIR} && ./update.sh`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Update failed: ${error}`);
      return;
    }
    console.log(`Update output: ${stdout}`);
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});
```

Create `update.sh`:

```bash
#!/bin/bash
git pull origin main
npm install
npm run build
sudo systemctl reload nginx
```

Make executable:

```bash
chmod +x update.sh
```

2. **Start Webhook Server**

```bash
npm install express
UPDATE_SECRET=$(openssl rand -hex 32)
PORT=3001 APP_DIR=$(pwd) node update-webhook.js &
```

Or use PM2:

```bash
npm install -g pm2
pm2 start update-webhook.js --name update-webhook
pm2 save
pm2 startup
```

3. **Configure in Admin Panel**

In Admin → Versions tab:

- **GitHub Repository URL**: `https://github.com/user/repo`
- **Update Webhook URL**: `http://localhost:3001/update`
- **Update Secret**: Your `UPDATE_SECRET` value

Now you can check and install updates from the admin panel!

---

## Post-Deployment

### Initial Setup

1. **Register First User**
   - Visit your app URL
   - Register account (becomes admin)

2. **Configure Jellyfin**
   - Admin → Servers
   - Add Jellyfin URL and API key

3. **Customize Site**
   - Admin → Site
   - Set site name, logo, header title

4. **Invite Users**
   - Share registration link
   - Assign roles in Admin → Users

### Monitoring

**Health Checks**:
- Admin → Health tab
- View Jellyfin connection status
- Check backend connectivity

**System Logs** (Self-Hosted):
```bash
# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Systemd service logs
sudo journalctl -u jelly-stream -f
```

**Backend Logs**:
- Lovable Cloud: Backend panel → Logs
- Supabase: Dashboard → Functions → Logs

### Backup

**Important Data**:
- `.env` file - Configuration
- Database - Take regular backups via backend panel
- `nginx` config - `/etc/nginx/sites-available/`

**Database Backup**:
- Lovable Cloud: Backend panel → Backup
- Supabase: Dashboard → Database → Backups

---

## Troubleshooting

### Cannot Access App

**Check:**
- Firewall allows port 80/443
- Nginx is running: `sudo systemctl status nginx`
- DNS points to correct IP
- SSL certificate is valid

### Jellyfin Connection Failed

**Check:**
- Jellyfin server is accessible
- API key is correct
- Server URL includes protocol (http/https)
- CORS is configured if needed

### Updates Not Working

**Check:**
- Webhook server is running
- Update secret matches
- Webhook URL is accessible
- App directory has write permissions
- Git is configured correctly

### Database Errors

**Check:**
- Backend credentials in `.env`
- Tables exist (run `supabase/setup.sql`)
- RLS policies are enabled
- Edge functions are deployed

### Video Playback Issues

**Check:**
- Jellyfin can transcode the media
- Browser supports codec
- Network bandwidth sufficient
- Jellyfin CORS allows your domain

---

## Performance Tips

### Frontend Optimization
- Enable gzip compression
- Cache static assets
- Use CDN for assets
- Lazy load images

### Database Optimization
- Regular database maintenance
- Monitor slow queries
- Add indexes for common queries
- Optimize RLS policies

### Media Streaming
- Let Jellyfin handle transcoding
- Use direct streaming when possible
- Configure quality settings in Jellyfin
- Ensure good network between app and Jellyfin

---

## Security Checklist

- [ ] HTTPS enabled (SSL certificate)
- [ ] Strong admin password
- [ ] Firewall configured
- [ ] Database backups enabled
- [ ] RLS policies active
- [ ] API keys secured
- [ ] Update system configured
- [ ] Security headers set in Nginx
- [ ] Jellyfin API key rotated regularly
- [ ] Regular security updates

---

## Support Resources

- **Documentation**: Check README.md and other docs
- **GitHub Issues**: Report bugs or request features
- **Lovable Docs**: https://docs.lovable.dev/
- **Supabase Docs**: https://supabase.com/docs
- **Jellyfin Docs**: https://jellyfin.org/docs/

---

## Quick Reference

### Common Commands

```bash
# Build for production
npm run build

# Start development server
npm run dev

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# View logs
sudo journalctl -u jelly-stream -f

# Pull updates
git pull origin main

# Check update webhook
pm2 logs update-webhook
```

### URLs to Remember

- **Admin Panel**: `https://your-domain.com/admin`
- **Backend Panel**: Lovable editor → Backend
- **Jellyfin API Docs**: `https://api.jellyfin.org/`

---

**Happy Streaming! 🎬**
