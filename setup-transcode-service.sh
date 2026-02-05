#!/bin/bash

# Setup script for HandBrake Transcode Server
# This creates a systemd service for the transcode server

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🎬 HandBrake Transcode Server Setup${NC}"
echo "======================================"

# Check for root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (sudo)${NC}"
  exit 1
fi

# Install HandBrakeCLI if not present
echo -e "${YELLOW}Checking for HandBrakeCLI...${NC}"
if ! command -v HandBrakeCLI &> /dev/null; then
  echo -e "${YELLOW}Installing HandBrakeCLI...${NC}"
  apt-get update
  apt-get install -y handbrake-cli
  echo -e "${GREEN}✅ HandBrakeCLI installed${NC}"
else
  echo -e "${GREEN}✅ HandBrakeCLI already installed${NC}"
fi

# Get app directory
APP_DIR="${APP_DIR:-$(pwd)}"
echo -e "${BLUE}📁 App directory: ${APP_DIR}${NC}"

# Load .env if exists
if [ -f "${APP_DIR}/.env" ]; then
  source "${APP_DIR}/.env"
fi

# Get or generate transcode secret
TRANSCODE_SECRET="${TRANSCODE_SECRET:-$(openssl rand -hex 32)}"

# Fixed Supabase URL for Lovable Cloud
SUPABASE_URL="https://ypjihlfhxqyrpfjfmjdm.supabase.co"

# Prompt for media base path
echo ""
read -p "Enter the base path to your media files (e.g., /mnt/nas/media): " MEDIA_BASE_PATH
MEDIA_BASE_PATH="${MEDIA_BASE_PATH:-/mnt/media}"

# Find the user
if [ -n "$SUDO_USER" ]; then
  RUN_USER="$SUDO_USER"
else
  RUN_USER=$(logname 2>/dev/null || echo "root")
fi

# Find Node.js
NODE_PATH=""
if [ -f "/home/${RUN_USER}/.nvm/versions/node/v20.18.3/bin/node" ]; then
  NODE_PATH="/home/${RUN_USER}/.nvm/versions/node/v20.18.3/bin/node"
elif command -v node &> /dev/null; then
  NODE_PATH=$(which node)
fi

if [ -z "$NODE_PATH" ]; then
  echo -e "${RED}❌ Node.js not found${NC}"
  exit 1
fi

echo -e "${GREEN}📦 Using Node.js: ${NODE_PATH}${NC}"

# Create systemd service
echo -e "${YELLOW}Creating systemd service...${NC}"

cat > /etc/systemd/system/jelly-transcode.service << EOF
[Unit]
Description=Jelly Stream Transcode Server (Polling)
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${APP_DIR}
Environment=TRANSCODE_PORT=3003
Environment=TRANSCODE_HOST=0.0.0.0
Environment=SUPABASE_URL=${SUPABASE_URL}
Environment=TRANSCODE_SECRET=${TRANSCODE_SECRET}
Environment=MEDIA_BASE_PATH=${MEDIA_BASE_PATH}
Environment=POLL_INTERVAL=10000
ExecStart=${NODE_PATH} ${APP_DIR}/transcode-server.cjs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload and start
systemctl daemon-reload
systemctl enable jelly-transcode.service
systemctl restart jelly-transcode.service

# Check status
sleep 2
if systemctl is-active --quiet jelly-transcode.service; then
  echo -e "${GREEN}✅ Transcode service started successfully!${NC}"
else
  echo -e "${RED}❌ Service failed to start${NC}"
  journalctl -u jelly-transcode.service -n 20 --no-pager
  exit 1
fi

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
TRANSCODE_URL="http://${SERVER_IP}:3003"

# Create config summary
cat > "${APP_DIR}/transcode-config.txt" << EOF
========================================
HandBrake Transcode Server Configuration
========================================

TRANSCODE_SECRET: ${TRANSCODE_SECRET}
TRANSCODE_URL: ${TRANSCODE_URL}
MEDIA_BASE_PATH: ${MEDIA_BASE_PATH}

Add these to your server_settings in the database:
- setting_key: transcode_server_url
  setting_value: ${TRANSCODE_URL}

- setting_key: transcode_secret  
  setting_value: ${TRANSCODE_SECRET}

- setting_key: media_base_path
  setting_value: ${MEDIA_BASE_PATH}

Service commands:
  sudo systemctl status jelly-transcode
  sudo systemctl restart jelly-transcode
  sudo journalctl -u jelly-transcode -f

Test health:
  curl http://localhost:3003/health
EOF

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Setup complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Add these settings to your database (server_settings table):${NC}"
echo ""
echo -e "  ${BLUE}transcode_server_url:${NC} ${TRANSCODE_URL}"
echo -e "  ${BLUE}transcode_secret:${NC} ${TRANSCODE_SECRET}"
echo -e "  ${BLUE}media_base_path:${NC} ${MEDIA_BASE_PATH}"
echo ""
echo -e "${YELLOW}Config saved to: ${APP_DIR}/transcode-config.txt${NC}"
