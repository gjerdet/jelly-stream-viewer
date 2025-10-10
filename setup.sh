#!/bin/bash

# Jelly Stream Viewer - Automatisk installasjonsskript for Ubuntu
# Dette skriptet installerer og konfigurerer alt som trengs for å kjøre applikasjonen

set -e  # Avslutt ved feil

# Farger for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funksjoner for formatert output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

print_header() {
    echo ""
    echo "=================================="
    echo "$1"
    echo "=================================="
    echo ""
}

# Sjekk at skriptet kjøres som root eller med sudo
if [ "$EUID" -ne 0 ] && [ -z "$SUDO_USER" ]; then 
    print_error "Dette skriptet må kjøres med sudo"
    exit 1
fi

print_header "Jelly Stream Viewer - Installasjon"

# 1. Sjekk systemkrav
print_info "Sjekker systemkrav..."

if ! command -v node &> /dev/null; then
    print_info "Node.js ikke funnet. Installerer Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    print_success "Node.js installert"
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js versjon $NODE_VERSION funnet. Trenger versjon 18 eller nyere."
        print_info "Installerer Node.js 18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
        print_success "Node.js oppgradert"
    else
        print_success "Node.js $(node --version) er installert"
    fi
fi

# 2. Installer npm avhengigheter
print_header "Installerer avhengigheter"
print_info "Dette kan ta noen minutter..."

npm install
print_success "Avhengigheter installert"

# 3. Konfigurer miljøvariabler
print_header "Konfigurasjon av miljøvariabler"

if [ ! -f .env ]; then
    print_info "Oppretter .env fil..."
    
    read -p "Supabase URL (https://xxxx.supabase.co): " SUPABASE_URL
    read -p "Supabase Publishable Key: " SUPABASE_KEY
    read -p "Supabase Project ID: " SUPABASE_PROJECT_ID
    
    cat > .env << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_KEY
VITE_SUPABASE_PROJECT_ID=$SUPABASE_PROJECT_ID
VITE_NODE_ENV=production
EOF
    
    print_success ".env fil opprettet"
else
    print_info ".env fil eksisterer allerede"
fi

# 4. Bygg applikasjonen
print_header "Bygger applikasjonen"
print_info "Dette kan ta noen minutter..."

npm run build
print_success "Applikasjon bygget til dist/"

# 5. Installer og konfigurer Nginx
print_header "Installerer Nginx"

if ! command -v nginx &> /dev/null; then
    apt-get update
    apt-get install -y nginx
    print_success "Nginx installert"
else
    print_success "Nginx er allerede installert"
fi

# Hent nåværende bruker (den som kjører sudo)
ACTUAL_USER=${SUDO_USER:-$(whoami)}
INSTALL_DIR=$(pwd)

# Opprett symbolsk lenke til dist-mappen
print_info "Konfigurerer Nginx..."

# Be om server navn/IP
read -p "Server navn eller IP (f.eks. 192.168.1.100 eller min-server.local): " SERVER_NAME

# Opprett Nginx konfigurasjon
cat > /etc/nginx/sites-available/jelly-stream << EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    root $INSTALL_DIR/dist;
    index index.html;

    # Komprimering
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache statiske filer
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Sikkerhetshoder
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# Aktiver site
ln -sf /etc/nginx/sites-available/jelly-stream /etc/nginx/sites-enabled/

# Fjern standard site
rm -f /etc/nginx/sites-enabled/default

# Test Nginx konfigurasjon
if nginx -t 2>/dev/null; then
    systemctl restart nginx
    systemctl enable nginx
    print_success "Nginx konfigurert og startet"
else
    print_error "Nginx konfigurasjon feilet"
    nginx -t
    exit 1
fi

# 6. Sett opp systemd service (valgfritt)
print_header "Systemd service (valgfritt)"

read -p "Vil du sette opp en systemd service for automatisk start? (j/n): " SETUP_SERVICE

if [ "$SETUP_SERVICE" = "j" ] || [ "$SETUP_SERVICE" = "J" ]; then
    cat > /etc/systemd/system/jelly-stream.service << EOF
[Unit]
Description=Jelly Stream Viewer
After=network.target

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/npm run preview -- --host 0.0.0.0 --port 4173
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable jelly-stream
    systemctl start jelly-stream
    print_success "Systemd service opprettet og startet"
fi

# 7. Firewall konfigurasjon
print_header "Firewall konfigurasjon"

if command -v ufw &> /dev/null; then
    read -p "Vil du åpne port 80 i firewall (ufw)? (j/n): " OPEN_FIREWALL
    
    if [ "$OPEN_FIREWALL" = "j" ] || [ "$OPEN_FIREWALL" = "J" ]; then
        ufw allow 80/tcp
        print_success "Port 80 åpnet i firewall"
    fi
fi

# 8. Oppsummering
print_header "Installasjon fullført!"

echo ""
echo "Applikasjonen er nå installert og kjører!"
echo ""
echo "Tilgang:"
echo "  URL: http://$SERVER_NAME"
echo "  Installasjonskatalog: $INSTALL_DIR"
echo ""
echo "Neste steg:"
echo "  1. Besøk http://$SERVER_NAME i nettleseren"
echo "  2. Registrer en brukerkonto"
echo "  3. Logg inn på Supabase Dashboard og kjør følgende SQL:"
echo ""
echo "     -- Gjør første bruker til admin (erstatt <USER_ID>)"
echo "     INSERT INTO public.user_roles (user_id, role)"
echo "     VALUES ('<USER_ID>', 'admin');"
echo ""
echo "  4. Logg inn og gå til Admin-siden"
echo "  5. Konfigurer Jellyfin server URL og API-nøkkel"
echo ""
echo "Nyttige kommandoer:"
echo "  Restart Nginx:    sudo systemctl restart nginx"
if [ "$SETUP_SERVICE" = "j" ] || [ "$SETUP_SERVICE" = "J" ]; then
    echo "  Restart service:  sudo systemctl restart jelly-stream"
    echo "  Se logs:          sudo journalctl -u jelly-stream -f"
fi
echo "  Nginx logs:       sudo tail -f /var/log/nginx/error.log"
echo ""
echo "For SSL/HTTPS (anbefalt):"
echo "  sudo apt-get install certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d $SERVER_NAME"
echo ""

print_success "Installasjonen er fullført!"
