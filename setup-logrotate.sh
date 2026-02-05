#!/bin/bash

# Setup script for log rotation
# Konfigurerer journald og logrotate for Jelly Stream

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Jelly Stream Log Rotation Setup ===${NC}"

# Sjekk root
if [ "$EUID" -ne 0 ]; then 
    echo "Kjør med sudo: sudo bash $0"
    exit 1
fi

echo -e "${GREEN}[1/3]${NC} Konfigurerer journald..."

# Begrens journald størrelse til 500MB
mkdir -p /etc/systemd/journald.conf.d/
cat > /etc/systemd/journald.conf.d/jelly-stream.conf << EOF
[Journal]
SystemMaxUse=500M
SystemKeepFree=1G
MaxFileSec=1week
EOF

systemctl restart systemd-journald

echo -e "${GREEN}[2/3]${NC} Oppretter logg-mapper..."

mkdir -p /var/log/jelly-stream
mkdir -p /var/log/jelly-git-pull
mkdir -p /var/log/jelly-transcode

echo -e "${GREEN}[3/3]${NC} Installerer logrotate konfigurasjon..."

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$APP_DIR/logrotate-jelly-stream.conf" /etc/logrotate.d/jelly-stream

# Test logrotate konfigurasjon
logrotate -d /etc/logrotate.d/jelly-stream 2>/dev/null || true

echo ""
echo -e "${GREEN}✓ Log rotation konfigurert!${NC}"
echo ""
echo "Journald er begrenset til 500MB"
echo "Logger roteres daglig og beholdes i 7 dager"
echo ""
echo "Nyttige kommandoer:"
echo "  Se journal størrelse: journalctl --disk-usage"
echo "  Rydd journal manuelt: sudo journalctl --vacuum-size=100M"
echo "  Test logrotate:       sudo logrotate -d /etc/logrotate.d/jelly-stream"
