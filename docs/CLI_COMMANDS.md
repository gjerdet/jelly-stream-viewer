# CLI Commands Reference

Quick reference for checking system status and troubleshooting.

## Service Status Commands

### Check All Jelly Stream Services
```bash
# Quick status overview
sudo systemctl status jelly-stream-preview jelly-git-pull jelly-transcode --no-pager

# Individual services
sudo systemctl status jelly-stream-preview   # Web UI (port 4173)
sudo systemctl status jelly-git-pull         # Update server (port 3002)
sudo systemctl status jelly-transcode        # Transcode server (port 3001)
```

### Check if Services are Running
```bash
# Returns active/inactive
systemctl is-active jelly-stream-preview
systemctl is-active jelly-git-pull
systemctl is-active jelly-transcode
```

### One-liner to Check All
```bash
echo "Preview: $(systemctl is-active jelly-stream-preview) | Git-Pull: $(systemctl is-active jelly-git-pull) | Transcode: $(systemctl is-active jelly-transcode)"
```

## Service Management

### Start/Stop/Restart Services
```bash
# Preview (Web UI)
sudo systemctl start jelly-stream-preview
sudo systemctl stop jelly-stream-preview
sudo systemctl restart jelly-stream-preview

# Git-Pull Server
sudo systemctl start jelly-git-pull
sudo systemctl stop jelly-git-pull
sudo systemctl restart jelly-git-pull

# Transcode Server
sudo systemctl start jelly-transcode
sudo systemctl stop jelly-transcode
sudo systemctl restart jelly-transcode
```

### Enable/Disable Auto-start on Boot
```bash
sudo systemctl enable jelly-stream-preview
sudo systemctl disable jelly-stream-preview
```

## Log Viewing

### Real-time Logs (Follow Mode)
```bash
# Preview service logs
sudo journalctl -u jelly-stream-preview -f

# Git-pull server logs
sudo journalctl -u jelly-git-pull -f

# Transcode server logs
sudo journalctl -u jelly-transcode -f
```

### Recent Logs (Last 100 Lines)
```bash
sudo journalctl -u jelly-stream-preview -n 100 --no-pager
sudo journalctl -u jelly-git-pull -n 100 --no-pager
sudo journalctl -u jelly-transcode -n 100 --no-pager
```

### Logs from Today
```bash
sudo journalctl -u jelly-stream-preview --since today
```

### Logs with Errors Only
```bash
sudo journalctl -u jelly-stream-preview -p err
```

## Network & Port Checks

### Check if Ports are Listening
```bash
# Check all Jelly Stream ports
sudo ss -tlnp | grep -E ':(4173|3002|3001)'

# Alternative with netstat
sudo netstat -tlnp | grep -E ':(4173|3002|3001)'
```

### Test Local Connectivity
```bash
# Test Preview (Web UI)
curl -I http://localhost:4173

# Test Git-Pull Server
curl http://localhost:3002/health

# Test Transcode Server
curl http://localhost:3001/health
```

### Check External Accessibility
```bash
# Get server IP
hostname -I | awk '{print $1}'

# Test from another machine (replace IP)
curl -I http://YOUR_SERVER_IP:4173
```

## External Services

### Netdata (Monitoring)
```bash
# Check if Netdata is running
sudo systemctl status netdata

# Test Netdata API
curl http://localhost:19999/api/v1/info
```

### Jellyfin
```bash
# Check Jellyfin status (if installed as service)
sudo systemctl status jellyfin

# Test Jellyfin API
curl http://localhost:8096/System/Info/Public
```

### qBittorrent
```bash
# Check qBittorrent status
sudo systemctl status qbittorrent-nox

# Test qBittorrent WebUI
curl -I http://localhost:8080
```

## System Health

### Disk Space
```bash
df -h /
```

### Memory Usage
```bash
free -h
```

### CPU Load
```bash
uptime
# or
top -bn1 | head -5
```

### All System Resources
```bash
htop  # Interactive (if installed)
# or
vmstat 1 5  # 5 samples, 1 second apart
```

## Node.js & NPM

### Check Node Version
```bash
node --version

# If using nvm
source ~/.nvm/nvm.sh && node --version
```

### Check npm Version
```bash
npm --version
```

## Quick Health Check Script

Create this as `check-health.sh`:
```bash
#!/bin/bash

echo "=== Jelly Stream Health Check ==="
echo ""

# Services
echo "Services:"
echo "  Preview (4173):   $(systemctl is-active jelly-stream-preview)"
echo "  Git-Pull (3002):  $(systemctl is-active jelly-git-pull)"
echo "  Transcode (3001): $(systemctl is-active jelly-transcode)"
echo ""

# Ports
echo "Ports Listening:"
ss -tlnp 2>/dev/null | grep -E ':(4173|3002|3001|19999)' | awk '{print "  " $4}'
echo ""

# System
echo "System:"
echo "  CPU Load: $(uptime | awk -F'load average:' '{print $2}')"
echo "  Memory:   $(free -h | awk '/^Mem:/ {print $3 "/" $2}')"
echo "  Disk:     $(df -h / | awk 'NR==2 {print $3 "/" $2 " (" $5 " used)"}')"
echo ""

# Node
echo "Node.js: $(node --version 2>/dev/null || echo 'not found')"
```

Run with:
```bash
chmod +x check-health.sh
./check-health.sh
```

## Troubleshooting

### Service Won't Start
```bash
# Check detailed error
sudo journalctl -u SERVICE_NAME -n 50 --no-pager

# Check service file syntax
sudo systemctl cat SERVICE_NAME
```

### Permission Issues
```bash
# Check file ownership in app directory
ls -la /path/to/jelly-stream/

# Fix ownership (replace USER)
sudo chown -R USER:USER /path/to/jelly-stream/
```

### Rebuild Application
```bash
cd /path/to/jelly-stream
rm -rf dist node_modules/.vite
npm install
npm run build
sudo systemctl restart jelly-stream-preview
```
