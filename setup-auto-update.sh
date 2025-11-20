#!/bin/bash

# Jelly Stream Viewer - Auto-Update System Installer
# Dette scriptet setter opp alt som trengs for auto-update funksjonalitet

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    log_error "Ikke kjør dette scriptet som root. Kjør det som din vanlige bruker (scriptet vil be om sudo når nødvendig)."
    exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Jelly Stream Viewer - Auto-Update System Installer      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Get current directory
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
log_info "Installerer fra: $INSTALL_DIR"

# Step 1: Check prerequisites
log_info "Steg 1: Sjekker forutsetninger..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    log_error "Node.js er ikke installert. Installer Node.js v16 eller nyere."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    log_error "Node.js versjon $NODE_VERSION er for gammel. Installer v16 eller nyere."
    exit 1
fi
log_success "Node.js versjon OK (v$(node -v))"

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm er ikke installert."
    exit 1
fi
log_success "npm funnet"

# Check systemd
if ! command -v systemctl &> /dev/null; then
    log_error "systemd er ikke tilgjengelig på dette systemet."
    exit 1
fi
log_success "systemd funnet"

# Check nginx
if ! command -v nginx &> /dev/null; then
    log_warning "nginx er ikke installert. Installer nginx for å kunne motta webhooks fra internett."
    NGINX_AVAILABLE=false
else
    NGINX_AVAILABLE=true
    log_success "nginx funnet"
fi

# Step 2: Install dependencies
log_info "Steg 2: Installerer npm-avhengigheter..."
cd "$INSTALL_DIR"
npm install express@4 --save 2>&1 | grep -v "npm WARN" || true
log_success "Express installert"

# Step 3: Generate webhook secret
log_info "Steg 3: Genererer webhook secret..."
WEBHOOK_SECRET=$(openssl rand -hex 32)
log_success "Webhook secret generert"

# Step 4: Get domain configuration
echo ""
log_info "Steg 4: Domene-konfigurasjon"
echo ""
echo "Hvis du har et domene med HTTPS-sertifikat (f.eks. jellyfin.gjerdet.casa),"
echo "kan du motta webhooks fra internett for automatiske oppdateringer."
echo ""
read -p "Har du et domene du vil bruke? (y/n): " HAS_DOMAIN

if [[ "$HAS_DOMAIN" =~ ^[Yy]$ ]]; then
    read -p "Skriv inn domenet (f.eks. jellyfin.gjerdet.casa): " DOMAIN
    read -p "Skriv inn stien for webhook (f.eks. /update-webhook): " WEBHOOK_PATH
    WEBHOOK_URL="https://${DOMAIN}${WEBHOOK_PATH}"
    SETUP_NGINX=true
else
    WEBHOOK_URL="http://localhost:3001/update"
    SETUP_NGINX=false
    log_info "Bruker localhost - kun lokale oppdateringer vil fungere"
fi

# Step 5: Create systemd service
log_info "Steg 5: Oppretter systemd-tjeneste..."

SERVICE_FILE="/etc/systemd/system/jelly-update-server.service"
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Jelly Stream Viewer Auto-Update Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="UPDATE_SECRET=$WEBHOOK_SECRET"
Environment="REPO_OWNER=AUTO_DETECT"
Environment="REPO_NAME=AUTO_DETECT"
ExecStart=/usr/bin/node $INSTALL_DIR/update-server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

log_success "Systemd-tjeneste opprettet: $SERVICE_FILE"

# Step 6: Setup nginx if requested
if [ "$SETUP_NGINX" = true ] && [ "$NGINX_AVAILABLE" = true ]; then
    log_info "Steg 6: Setter opp nginx-konfigurasjon..."
    
    NGINX_CONF="/etc/nginx/sites-available/jelly-update-webhook"
    
    sudo tee "$NGINX_CONF" > /dev/null <<EOF
# Jelly Stream Viewer Update Webhook
location ${WEBHOOK_PATH} {
    proxy_pass http://localhost:3001/update;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    
    # Forward webhook headers
    proxy_set_header X-Webhook-Signature \$http_x_webhook_signature;
    proxy_set_header X-Webhook-Timestamp \$http_x_webhook_timestamp;
    
    # Timeout settings
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
EOF
    
    log_success "Nginx-konfigurasjon opprettet: $NGINX_CONF"
    log_warning "VIKTIG: Du må manuelt inkludere denne filen i din nginx server-blokk for $DOMAIN"
    log_warning "Legg til denne linjen i server-blokken: include $NGINX_CONF;"
fi

# Step 7: Enable and start service
log_info "Steg 7: Starter systemd-tjeneste..."
sudo systemctl daemon-reload
sudo systemctl enable jelly-update-server.service
sudo systemctl restart jelly-update-server.service

# Wait a bit for service to start
sleep 2

# Check if service is running
if sudo systemctl is-active --quiet jelly-update-server.service; then
    log_success "Systemd-tjeneste kjører"
else
    log_error "Systemd-tjeneste startet ikke korrekt. Sjekk: sudo journalctl -u jelly-update-server -n 50"
    exit 1
fi

# Step 8: Test the service
log_info "Steg 8: Tester tjenesten..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/health || echo "FAILED")
if [[ "$HEALTH_RESPONSE" == *"ok"* ]]; then
    log_success "Health-check OK"
else
    log_error "Health-check feilet. Sjekk logs: sudo journalctl -u jelly-update-server -n 50"
    exit 1
fi

# Step 9: Create configuration summary
CONFIG_FILE="$INSTALL_DIR/update-config.txt"
cat > "$CONFIG_FILE" <<EOF
╔═══════════════════════════════════════════════════════════╗
║       Jelly Stream Viewer - Update Konfigurasjon         ║
╚═══════════════════════════════════════════════════════════╝

INSTALLASJON FULLFØRT: $(date)

WEBHOOK SECRET:
$WEBHOOK_SECRET

WEBHOOK URL:
$WEBHOOK_URL

SYSTEMD TJENESTE:
- Navn: jelly-update-server.service
- Status: sudo systemctl status jelly-update-server
- Logs: sudo journalctl -u jelly-update-server -f

NESTE STEG:
1. Gå til admin-panelet i Jelly Stream Viewer
2. Finn "Update Manager" seksjonen
3. Sett "Update Webhook Secret" til verdien over
4. Sett "Update Webhook URL" til URL-en over
5. Hvis du bruker GitHub:
   - Gå til GitHub repository > Settings > Webhooks
   - Legg til ny webhook med URL-en over
   - Sett secret til verdien over
   - Velg "application/json" som content type
   - Velg "Just the push event"

NGINX KONFIGURASJON (hvis applicable):
EOF

if [ "$SETUP_NGINX" = true ] && [ "$NGINX_AVAILABLE" = true ]; then
    cat >> "$CONFIG_FILE" <<EOF
- Konfigurasjonsfil opprettet: /etc/nginx/sites-available/jelly-update-webhook
- Legg til i din $DOMAIN server-blokk:
  include /etc/nginx/sites-available/jelly-update-webhook;
- Test nginx: sudo nginx -t
- Reload nginx: sudo systemctl reload nginx
EOF
else
    cat >> "$CONFIG_FILE" <<EOF
Ingen nginx-konfigurasjon satt opp (localhost eller nginx ikke tilgjengelig)
EOF
fi

cat >> "$CONFIG_FILE" <<EOF

TESTING:
Test webhook lokalt:
curl -X POST http://localhost:3001/health

Test oppdatering (krever riktig signature):
Bruk admin-panelet for å teste full oppdatering

FEILSØKING:
- Se systemd logs: sudo journalctl -u jelly-update-server -n 50
- Se nginx error logs: sudo tail -f /var/log/nginx/error.log
- Test service: sudo systemctl status jelly-update-server

VEDLIKEHOLD:
- Restart service: sudo systemctl restart jelly-update-server
- Stop service: sudo systemctl stop jelly-update-server
- Disable service: sudo systemctl disable jelly-update-server

═══════════════════════════════════════════════════════════
EOF

log_success "Konfigurasjon lagret til: $CONFIG_FILE"

# Step 10: Display summary
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              INSTALLASJON FULLFØRT!                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
log_success "Update-server kjører på http://localhost:3001"
echo ""
echo "📋 NESTE STEG:"
echo ""
echo "1. Se full konfigurasjon: cat $CONFIG_FILE"
echo ""
echo "2. Gå til admin-panelet i Jelly Stream Viewer"
echo ""
echo "3. Konfigurer Update Manager med:"
echo "   Webhook Secret: $WEBHOOK_SECRET"
echo "   Webhook URL: $WEBHOOK_URL"
echo ""

if [ "$SETUP_NGINX" = true ] && [ "$NGINX_AVAILABLE" = true ]; then
    echo "4. Legg til i nginx server-blokk for $DOMAIN:"
    echo "   include /etc/nginx/sites-available/jelly-update-webhook;"
    echo ""
    echo "5. Test og reload nginx:"
    echo "   sudo nginx -t && sudo systemctl reload nginx"
    echo ""
fi

echo "🔍 NYTTIGE KOMMANDOER:"
echo "   sudo systemctl status jelly-update-server    # Sjekk status"
echo "   sudo journalctl -u jelly-update-server -f     # Se live logs"
echo "   curl http://localhost:3001/health             # Test server"
echo ""
log_info "Dokumentasjon: cat $CONFIG_FILE"
echo ""
