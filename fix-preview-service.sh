#!/bin/bash

# Fix jelly-stream-preview systemd service to use correct Node.js version

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Fikser jelly-stream-preview systemd service...${NC}"

# Get current directory and user
APP_DIR=$(pwd)
ACTUAL_USER=${SUDO_USER:-$(whoami)}

# Find node from nvm
NODE_PATH="/home/${ACTUAL_USER}/.nvm/versions/node/v18.20.0/bin/node"

if [ ! -f "$NODE_PATH" ]; then
    echo "Finner ikke Node.js på $NODE_PATH"
    echo "Prøver å finne node..."
    NODE_PATH=$(which node)
fi

echo -e "${BLUE}Node path: ${NODE_PATH}${NC}"
echo -e "${BLUE}App directory: ${APP_DIR}${NC}"

# Create new systemd service
SERVICE_FILE="/etc/systemd/system/jelly-stream-preview.service"
echo -e "${BLUE}Oppdaterer ${SERVICE_FILE}...${NC}"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Jelly Stream Preview
After=network.target

[Service]
Type=simple
User=${ACTUAL_USER}
WorkingDirectory=${APP_DIR}
Environment="NODE_ENV=production"
ExecStart=${NODE_PATH} ${APP_DIR}/node_modules/.bin/vite preview --host 0.0.0.0 --port 4173
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=jelly-preview

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ Service fil oppdatert${NC}"

# Reload and restart
systemctl daemon-reload
systemctl restart jelly-stream-preview

sleep 2

if systemctl is-active --quiet jelly-stream-preview; then
    echo -e "${GREEN}✓ Preview service kjører!${NC}"
    systemctl status jelly-stream-preview --no-pager
else
    echo "Sjekker logs..."
    journalctl -u jelly-stream-preview -n 20 --no-pager
fi
