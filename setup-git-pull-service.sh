#!/bin/bash

# Setup script for Git Pull Server systemd service
# This is MUCH simpler than the webhook setup!

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Git Pull Server Setup ===${NC}"
echo "Dette setter opp en lokal server som kan kjøre git pull"
echo "Ingen webhook, domene eller proxy nødvendig!"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}Feil: Dette scriptet må kjøres som root${NC}"
   echo "Kjør: sudo bash setup-git-pull-service.sh"
   exit 1
fi

# Get current directory
APP_DIR=$(pwd)
echo -e "${BLUE}App directory: ${APP_DIR}${NC}"

# Check for .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Lager .env fil...${NC}"
    touch .env
fi

# Generate or get UPDATE_SECRET
if grep -q "UPDATE_SECRET" .env; then
    UPDATE_SECRET=$(grep "UPDATE_SECRET" .env | cut -d '=' -f2)
    echo -e "${GREEN}Bruker eksisterende UPDATE_SECRET${NC}"
else
    UPDATE_SECRET=$(openssl rand -hex 32)
    echo "UPDATE_SECRET=${UPDATE_SECRET}" >> .env
    echo -e "${GREEN}Generert ny UPDATE_SECRET${NC}"
fi

# Get current user (the one who ran sudo)
ACTUAL_USER=${SUDO_USER:-$(whoami)}
echo -e "${BLUE}Service vil kjøre som bruker: ${ACTUAL_USER}${NC}"

# Create systemd service
SERVICE_FILE="/etc/systemd/system/jelly-git-pull.service"
echo -e "${BLUE}Lager systemd service: ${SERVICE_FILE}${NC}"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Jelly Stream Git Pull Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=${ACTUAL_USER}
WorkingDirectory=${APP_DIR}
Environment="NODE_ENV=production"
Environment="GIT_PULL_PORT=3002"
Environment="APP_DIR=${APP_DIR}"
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/node ${APP_DIR}/git-pull-server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=jelly-git-pull

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ Systemd service opprettet${NC}"

# Reload systemd
echo -e "${BLUE}Reloader systemd daemon...${NC}"
systemctl daemon-reload

# Enable service
echo -e "${BLUE}Aktiverer service (autostart ved oppstart)...${NC}"
systemctl enable jelly-git-pull.service

# Start service
echo -e "${BLUE}Starter service...${NC}"
systemctl start jelly-git-pull.service

# Check status
sleep 2
if systemctl is-active --quiet jelly-git-pull.service; then
    echo -e "${GREEN}✓ Service kjører!${NC}"
    systemctl status jelly-git-pull.service --no-pager
else
    echo -e "${RED}✗ Service startet ikke. Sjekk logs:${NC}"
    journalctl -u jelly-git-pull.service -n 50 --no-pager
    exit 1
fi

# Create summary file
SUMMARY_FILE="${APP_DIR}/git-pull-config.txt"
cat > "$SUMMARY_FILE" << EOF
=== Git Pull Server Konfigurasjon ===
Generert: $(date)

UPDATE_SECRET: ${UPDATE_SECRET}
Git Pull Server URL: http://localhost:3002/git-pull
Health Check URL: http://localhost:3002/health

=== Admin Panel Konfigurasjon ===
Gå til Admin → Server Settings og sett:

Git Pull Server URL: http://localhost:3002/git-pull
Git Pull Secret: ${UPDATE_SECRET}

=== Systemd Kommandoer ===
Status:  sudo systemctl status jelly-git-pull
Start:   sudo systemctl start jelly-git-pull
Stopp:   sudo systemctl stop jelly-git-pull
Restart: sudo systemctl restart jelly-git-pull
Logs:    sudo journalctl -u jelly-git-pull -f

=== Test Git Pull Server ===
curl http://localhost:3002/health

=== Hvordan det fungerer ===
1. Admin panel sender request til localhost:3002/git-pull
2. Serveren kjører: git stash && git pull && npm install && npm run build
3. Applikasjonen er oppdatert!

Ingen webhook, domene eller proxy nødvendig! 🎉
EOF

echo ""
echo -e "${GREEN}=== Setup Fullført! ===${NC}"
echo ""
echo -e "${BLUE}📝 Konfigurasjon lagret i: ${SUMMARY_FILE}${NC}"
echo ""
echo -e "${YELLOW}Neste steg:${NC}"
echo "1. Gå til Admin → Server Settings i Jelly Stream"
echo "2. Sett Git Pull Server URL: http://localhost:3002/git-pull"
echo "3. Sett Git Pull Secret: ${UPDATE_SECRET}"
echo "4. Klikk 'Installer oppdatering' for å teste!"
echo ""
echo -e "${GREEN}Service kjører nå og starter automatisk ved oppstart${NC}"
echo ""
echo -e "${BLUE}Test med:${NC}"
echo "curl http://localhost:3002/health"
