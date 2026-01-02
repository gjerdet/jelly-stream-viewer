#!/bin/bash
# Setup script for NAS Delete Agent on TrueNAS Scale
# Run as root: sudo bash setup-nas-delete-agent.sh

set -e

echo "=== NAS Delete Agent Setup ==="

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="nas-delete-agent"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo bash setup-nas-delete-agent.sh)"
  exit 1
fi

# Check if nas-delete-agent.cjs exists
if [ ! -f "${SCRIPT_DIR}/nas-delete-agent.cjs" ]; then
  echo "ERROR: nas-delete-agent.cjs not found in ${SCRIPT_DIR}"
  exit 1
fi

# Get configuration from user
echo ""
echo "Configuration required:"
echo ""

# Secret
if [ -z "$NAS_DELETE_SECRET" ]; then
  read -p "Enter HMAC secret (or press Enter to generate one): " NAS_DELETE_SECRET
  if [ -z "$NAS_DELETE_SECRET" ]; then
    NAS_DELETE_SECRET=$(openssl rand -hex 32)
    echo "Generated secret: $NAS_DELETE_SECRET"
    echo ">>> Copy this secret to the Admin panel NAS Agent Settings!"
  fi
fi

# Port
read -p "Enter port (default: 3003): " NAS_DELETE_PORT
NAS_DELETE_PORT=${NAS_DELETE_PORT:-3003}

# Paths
echo ""
echo "Enter the base paths for your media libraries:"
read -p "Movies path (e.g., /mnt/data/movies): " NAS_MOVIES_PATH
read -p "Shows path (e.g., /mnt/data/shows): " NAS_SHOWS_PATH
read -p "Downloads path (e.g., /mnt/data/downloads): " NAS_DOWNLOADS_PATH

# Validate at least one path
if [ -z "$NAS_MOVIES_PATH" ] && [ -z "$NAS_SHOWS_PATH" ] && [ -z "$NAS_DOWNLOADS_PATH" ]; then
  echo "ERROR: At least one path must be configured"
  exit 1
fi

# Get current user
CURRENT_USER=$(logname 2>/dev/null || echo $SUDO_USER)
if [ -z "$CURRENT_USER" ]; then
  read -p "Enter the user to run the service as: " CURRENT_USER
fi

# Find Node.js path
NODE_PATH=$(which node 2>/dev/null || echo "")
if [ -z "$NODE_PATH" ]; then
  # Try common NVM paths
  if [ -f "/home/${CURRENT_USER}/.nvm/versions/node/v20.19.0/bin/node" ]; then
    NODE_PATH="/home/${CURRENT_USER}/.nvm/versions/node/v20.19.0/bin/node"
  elif [ -f "/root/.nvm/versions/node/v20.19.0/bin/node" ]; then
    NODE_PATH="/root/.nvm/versions/node/v20.19.0/bin/node"
  else
    echo "ERROR: Node.js not found. Please install Node.js 20+"
    exit 1
  fi
fi

echo ""
echo "Using Node.js: $NODE_PATH"

# Stop existing service if running
if systemctl is-active --quiet $SERVICE_NAME; then
  echo "Stopping existing service..."
  systemctl stop $SERVICE_NAME
fi

# Create systemd service
echo "Creating systemd service..."
cat > $SERVICE_FILE << EOF
[Unit]
Description=NAS Delete Agent - Secure file deletion service
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${NODE_PATH} ${SCRIPT_DIR}/nas-delete-agent.cjs
Restart=always
RestartSec=10

# Environment
Environment=NAS_DELETE_SECRET=${NAS_DELETE_SECRET}
Environment=NAS_DELETE_PORT=${NAS_DELETE_PORT}
EOF

# Add paths to environment
if [ -n "$NAS_MOVIES_PATH" ]; then
  echo "Environment=NAS_MOVIES_PATH=${NAS_MOVIES_PATH}" >> $SERVICE_FILE
fi
if [ -n "$NAS_SHOWS_PATH" ]; then
  echo "Environment=NAS_SHOWS_PATH=${NAS_SHOWS_PATH}" >> $SERVICE_FILE
fi
if [ -n "$NAS_DOWNLOADS_PATH" ]; then
  echo "Environment=NAS_DOWNLOADS_PATH=${NAS_DOWNLOADS_PATH}" >> $SERVICE_FILE
fi

# Complete service file
cat >> $SERVICE_FILE << EOF

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable and start service
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Service status:"
systemctl status $SERVICE_NAME --no-pager
echo ""
echo "Configuration saved to: $SERVICE_FILE"
echo ""
echo ">>> IMPORTANT: Update these settings in Admin panel (NAS Agent Settings):"
echo "    URL: http://$(hostname -I | awk '{print $1}'):${NAS_DELETE_PORT}"
echo "    Secret: ${NAS_DELETE_SECRET}"
echo ""
echo "Commands:"
echo "  View logs:     journalctl -u $SERVICE_NAME -f"
echo "  Restart:       sudo systemctl restart $SERVICE_NAME"
echo "  Stop:          sudo systemctl stop $SERVICE_NAME"
echo "  Check status:  sudo systemctl status $SERVICE_NAME"
