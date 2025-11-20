#!/bin/bash
# Setup script for auto-updating webhook server
# Run with: sudo bash setup-update-service.sh

set -e

echo "=== Jelly Stream Viewer - Update Service Setup ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "Dette scriptet må kjøres som root (bruk sudo)"
  exit 1
fi

# Get current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$SCRIPT_DIR"

echo "App directory: $APP_DIR"
echo ""

# Check if .env exists
if [ ! -f "$APP_DIR/.env" ]; then
  echo "Feil: .env filen finnes ikke!"
  echo "Kopier .env.example til .env og fyll ut verdiene først."
  exit 1
fi

# Source .env file to get webhook secret
export $(cat "$APP_DIR/.env" | grep -v '^#' | xargs)

if [ -z "$WEBHOOK_SECRET" ]; then
  echo "Feil: WEBHOOK_SECRET mangler i .env filen"
  exit 1
fi

# Get the user who should run the service (current user who called sudo)
SERVICE_USER="${SUDO_USER:-www-data}"
echo "Service vil kjøre som bruker: $SERVICE_USER"
echo ""

# Create systemd service file
echo "Oppretter systemd service fil..."
cat > /etc/systemd/system/jelly-update-server.service << EOF
[Unit]
Description=Jelly Stream Viewer Auto-Update Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
Environment="NODE_ENV=production"
Environment="PORT=3001"
Environment="UPDATE_SECRET=$WEBHOOK_SECRET"
Environment="APP_DIR=$APP_DIR"
Environment="RESTART_COMMAND=sudo systemctl restart jelly-stream"
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node $APP_DIR/update-server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=jelly-update

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF

echo "✓ Systemd service fil opprettet"

# Reload systemd
echo "Laster inn systemd konfigurasjon..."
systemctl daemon-reload

# Enable service to start on boot
echo "Aktiverer service ved oppstart..."
systemctl enable jelly-update-server.service

# Start service
echo "Starter service..."
systemctl start jelly-update-server.service

# Wait a moment for service to start
sleep 2

# Check status
echo ""
echo "=== Service Status ==="
systemctl status jelly-update-server.service --no-pager || true

echo ""
echo "=== Setup fullført! ==="
echo ""
echo "Nyttige kommandoer:"
echo "  Sjekk status:   sudo systemctl status jelly-update-server"
echo "  Stopp service:  sudo systemctl stop jelly-update-server"
echo "  Start service:  sudo systemctl start jelly-update-server"
echo "  Restart:        sudo systemctl restart jelly-update-server"
echo "  Se logger:      sudo journalctl -u jelly-update-server -f"
echo "  Deaktiver:      sudo systemctl disable jelly-update-server"
echo ""
echo "Update webhook URL: http://ditt-domene.com:3001/update"
echo "(Husk å konfigurere denne i Admin → Servers → Update Webhook URL)"
