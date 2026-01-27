#!/bin/bash

# Setup script for Jelly Stream Preview Service
# This script sets up the application to run on port 4173 with auto-start

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Jelly Stream Preview Setup ===${NC}"
echo ""

# Check if running with sudo/root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run with sudo: sudo bash $0${NC}"
    exit 1
fi

# Get the actual user (not root)
ACTUAL_USER="${SUDO_USER:-$USER}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${GREEN}[1/6]${NC} Stopping existing services..."
systemctl stop jelly-stream-preview 2>/dev/null || true
systemctl stop jelly-webhook 2>/dev/null || true

echo -e "${GREEN}[2/6]${NC} Fixing permissions / cleaning old build..."
# CRITICAL: Fix ownership FIRST before any file operations.
# Previous sudo runs may have created root-owned files that block npm install.
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$APP_DIR"

# Now clean old build artifacts (with correct permissions)
rm -rf "$APP_DIR/dist" 2>/dev/null || true
rm -rf "$APP_DIR/node_modules" 2>/dev/null || true
rm -rf "$APP_DIR/.vite" 2>/dev/null || true

# Double-check ownership after cleanup
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$APP_DIR"

echo -e "${GREEN}[3/6]${NC} Installing dependencies..."
cd "$APP_DIR"

# Vite 6 + SWC requires Node 20.19+.
# Ensure nvm exists for the actual user (installs it if missing).
su - "$ACTUAL_USER" -c "export NVM_DIR=\"\$HOME/.nvm\"; if [ ! -s \"\$NVM_DIR/nvm.sh\" ]; then curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash; fi"

# Install/use Node 20.19.0 and run npm install as the actual user (never as root).
su - "$ACTUAL_USER" -c "export NVM_DIR=\"\$HOME/.nvm\"; . \"\$NVM_DIR/nvm.sh\"; nvm install 20.19.0; nvm use 20.19.0; cd '$APP_DIR' && npm install"

echo -e "${GREEN}[4/6]${NC} Building application..."
su - "$ACTUAL_USER" -c "export NVM_DIR=\"\$HOME/.nvm\"; . \"\$NVM_DIR/nvm.sh\"; nvm use 20.19.0; cd '$APP_DIR' && npm run build"

echo -e "${GREEN}[5/6]${NC} Creating systemd service for preview (port 4173)..."

cat > /etc/systemd/system/jelly-stream-preview.service <<EOF
[Unit]
Description=Jelly Stream Preview
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$APP_DIR
Environment="NODE_ENV=production"
ExecStart=/bin/bash -lc 'export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; nvm use 20.19.0 >/dev/null; npm run preview -- --host 0.0.0.0 --port 4173'
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}[6/6]${NC} Starting and enabling services..."
systemctl daemon-reload
systemctl enable jelly-stream-preview
systemctl start jelly-stream-preview

# Also ensure git-pull service is running
if [ -f "/etc/systemd/system/jelly-git-pull.service" ]; then
    systemctl enable jelly-git-pull
    systemctl start jelly-git-pull
    echo -e "${BLUE}✓ git-pull service also started${NC}"
fi

echo -e "${GREEN}[6/6]${NC} Verifying services..."
sleep 2

# Check preview service
if systemctl is-active --quiet jelly-stream-preview; then
    echo -e "${BLUE}✓ Preview service running${NC}"
else
    echo -e "${RED}✗ Preview service failed to start${NC}"
    echo "Check logs with: sudo journalctl -u jelly-stream-preview -f"
fi

# Check git-pull service if it exists
if [ -f "/etc/systemd/system/jelly-git-pull.service" ]; then
    if systemctl is-active --quiet jelly-git-pull; then
        echo -e "${BLUE}✓ Git-pull service running${NC}"
    else
        echo -e "${RED}✗ Git-pull service not running${NC}"
        echo "Start it with: sudo systemctl start jelly-git-pull"
    fi
fi

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Your application is now running on port 4173"
echo ""
echo "To update the application after git pull:"
echo "  1. cd $APP_DIR"
echo "  2. git stash && git pull"
echo "  3. sudo bash setup-preview-service.sh"
echo ""
echo "Useful commands:"
echo "  View preview logs:    sudo journalctl -u jelly-stream-preview -f"
echo "  View git-pull logs:   sudo journalctl -u jelly-git-pull -f"
echo "  Restart preview:      sudo systemctl restart jelly-stream-preview"
echo "  Stop preview:         sudo systemctl stop jelly-stream-preview"
echo ""
echo "Access your app at: http://$(hostname -I | awk '{print $1}'):4173"
echo ""
