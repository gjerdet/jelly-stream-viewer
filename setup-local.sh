#!/bin/bash

# ============================================
# JELLY STREAM VIEWER - LOKAL SETUP
# ============================================
# Dette scriptet setter opp Jelly Stream Viewer
# med valg mellom Supabase Cloud eller lokal database
# ============================================

set -e

# Farger for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funksjoner for pretty print
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Sjekk om Docker er installert
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker er ikke installert!"
        echo ""
        echo "Installer Docker:"
        echo "  Ubuntu/Debian: curl -fsSL https://get.docker.com | sh"
        echo "  Eller besøk: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose er ikke installert!"
        exit 1
    fi
    
    print_success "Docker er installert"
}

# Sjekk om Node.js er installert
check_node() {
    if ! command -v node &> /dev/null; then
        print_info "Node.js ikke funnet. Installerer Node.js 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        print_success "Node.js installert"
    else
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            print_warning "Node.js versjon $(node --version) er for gammel. Oppgraderer til Node.js 20..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            print_success "Node.js oppgradert til $(node --version)"
        else
            print_success "Node.js $(node --version) er installert"
        fi
    fi
}

# Installer Netdata for server monitoring
install_netdata() {
    print_header "INSTALLERER NETDATA (SERVER MONITORING)"
    
    if command -v netdata &> /dev/null; then
        print_success "Netdata er allerede installert"
        return
    fi
    
    print_info "Installerer Netdata for server-statistikk..."
    
    # Installer Netdata med kickstart script
    wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh && sh /tmp/netdata-kickstart.sh --dont-wait --disable-telemetry
    
    if command -v netdata &> /dev/null; then
        print_success "Netdata installert og kjører på http://localhost:19999"
        
        # Opprett monitoring URL setting
        MONITORING_URL="http://localhost:19999"
        
        print_info "Monitoring URL: $MONITORING_URL"
        echo "Dette vil bli konfigurert automatisk i setup-veilederen"
    else
        print_warning "Netdata-installasjon feilet. Du kan installere det manuelt senere."
    fi
}

# Velg deployment type
choose_deployment_type() {
    print_header "VELG DEPLOYMENT TYPE"
    
    echo "Hvordan vil du kjøre Jelly Stream Viewer?"
    echo ""
    echo "1) Supabase Cloud (Anbefalt)"
    echo "   - Enklest å sette opp"
    echo "   - Gratis tier tilgjengelig"
    echo "   - Automatisk auth, edge functions, realtime"
    echo "   - Krever internett-tilkobling"
    echo ""
    echo "2) Lokal PostgreSQL (Docker)"
    echo "   - Kjører 100% lokalt"
    echo "   - Full kontroll over data"
    echo "   - Krever manuell auth-oppsett"
    echo "   - Ingen edge functions (må implementeres selv)"
    echo ""
    
    while true; do
        read -p "Velg deployment type (1 eller 2): " choice
        case $choice in
            1)
                DEPLOYMENT_TYPE="cloud"
                break
                ;;
            2)
                DEPLOYMENT_TYPE="local"
                break
                ;;
            *)
                print_error "Ugyldig valg. Velg 1 eller 2."
                ;;
        esac
    done
    
    print_success "Deployment type: $DEPLOYMENT_TYPE"
}

# Setup for Supabase Cloud
setup_supabase_cloud() {
    print_header "SUPABASE CLOUD OPPSETT"
    
    echo "Du må opprette et Supabase-prosjekt først:"
    echo "1. Gå til https://supabase.com og opprett en konto"
    echo "2. Opprett et nytt prosjekt"
    echo "3. Vent til databasen er klar (1-2 min)"
    echo "4. Gå til SQL Editor og kjør supabase/setup.sql"
    echo "5. Gå til Authentication → Providers → Email"
    echo "   - Aktiver Email provider"
    echo "   - Skru AV 'Confirm email'"
    echo "6. Gå til Project Settings → API"
    echo ""
    
    read -p "Har du gjort dette? (y/n): " ready
    if [[ $ready != "y" ]]; then
        print_warning "Fullfør Supabase-oppsettet først, kjør deretter scriptet på nytt."
        exit 0
    fi
    
    echo ""
    read -p "Supabase Project URL (https://xxxxx.supabase.co): " SUPABASE_URL
    read -p "Supabase Anon/Public Key: " SUPABASE_KEY
    read -p "Supabase Project ID: " SUPABASE_PROJECT_ID
    
    # Opprett .env fil
    cat > .env << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_KEY
VITE_SUPABASE_PROJECT_ID=$SUPABASE_PROJECT_ID
VITE_NODE_ENV=production
EOF
    
    print_success ".env fil opprettet"
}

# Setup for lokal PostgreSQL
setup_local_postgres() {
    print_header "LOKAL POSTGRESQL OPPSETT"
    
    print_info "Vi setter opp en lokal PostgreSQL database med Docker"
    echo ""
    
    # Generer sikre random passord
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    PGADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    
    read -p "Database navn [jellystream]: " DB_NAME
    DB_NAME=${DB_NAME:-jellystream}
    
    read -p "Database brukernavn [jellystream]: " DB_USER
    DB_USER=${DB_USER:-jellystream}
    
    echo ""
    print_info "Autogenerert sikkert database-passord"
    echo "Passord: $DB_PASSWORD"
    echo ""
    read -p "Vil du endre dette passordet? (y/n): " change_pwd
    if [[ $change_pwd == "y" ]]; then
        read -sp "Nytt database-passord: " DB_PASSWORD
        echo ""
    fi
    
    # Opprett .env.local fil for Docker Compose
    cat > .env.local << EOF
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_PORT=5432
PGADMIN_EMAIL=admin@jellystream.local
PGADMIN_PASSWORD=$PGADMIN_PASSWORD
PGADMIN_PORT=5050
EOF
    
    print_success ".env.local fil opprettet"
    
    # Opprett .env fil for applikasjonen
    cat > .env << EOF
# Lokal PostgreSQL deployment
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

# Dummy Supabase values (ikke i bruk for lokal deployment)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=local-dev-key
VITE_SUPABASE_PROJECT_ID=local
VITE_NODE_ENV=production
EOF
    
    print_success ".env fil opprettet"
    
    # Start Docker Compose
    print_info "Starter PostgreSQL database..."
    docker-compose --env-file .env.local up -d postgres
    
    # Vent på at databasen er klar
    echo "Venter på at databasen skal starte..."
    sleep 10
    
    print_success "PostgreSQL database kjører!"
    echo ""
    print_info "Database tilkobling:"
    echo "  Host: localhost"
    echo "  Port: 5432"
    echo "  Database: $DB_NAME"
    echo "  Brukernavn: $DB_USER"
    echo "  Passord: $DB_PASSWORD"
    echo ""
    
    read -p "Vil du starte pgAdmin (web database admin)? (y/n): " start_pgadmin
    if [[ $start_pgadmin == "y" ]]; then
        docker-compose --env-file .env.local --profile admin up -d pgadmin
        print_success "pgAdmin startet på http://localhost:5050"
        echo "  Epost: admin@jellystream.local"
        echo "  Passord: $PGADMIN_PASSWORD"
    fi
}

# Installer npm dependencies
install_dependencies() {
    print_header "INSTALLERER AVHENGIGHETER"
    
    if [ ! -d "node_modules" ]; then
        npm install
        print_success "npm packages installert"
    else
        print_info "node_modules finnes allerede, hopper over..."
    fi
}

# Bygg applikasjonen
build_app() {
    print_header "BYGGER APPLIKASJON"
    
    npm run build
    print_success "Applikasjon bygget (dist/ mappen opprettet)"
}

# Setup Nginx (valgfritt)
setup_nginx() {
    print_header "NGINX OPPSETT (VALGFRITT)"
    
    read -p "Vil du sette opp Nginx webserver? (y/n): " setup_nginx_choice
    if [[ $setup_nginx_choice != "y" ]]; then
        print_info "Hopper over Nginx-oppsett"
        return
    fi
    
    if ! command -v nginx &> /dev/null; then
        print_info "Installerer Nginx..."
        sudo apt-get update
        sudo apt-get install -y nginx
    fi
    
    read -p "Server IP eller domene [localhost]: " SERVER_NAME
    SERVER_NAME=${SERVER_NAME:-localhost}
    
    NGINX_CONFIG="/etc/nginx/sites-available/jelly-stream-viewer"
    
    sudo tee $NGINX_CONFIG > /dev/null << EOF
server {
    listen 80;
    server_name $SERVER_NAME;
    
    root $(pwd)/dist;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF
    
    sudo ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/jelly-stream-viewer
    sudo nginx -t
    sudo systemctl reload nginx
    
    print_success "Nginx konfigurert for http://$SERVER_NAME"
}

# Print ferdig melding
print_completion() {
    print_header "🎉 INSTALLASJON FULLFØRT!"
    
    if [[ $DEPLOYMENT_TYPE == "cloud" ]]; then
        echo "Supabase Cloud deployment er klar!"
        echo ""
        echo "Neste steg:"
        echo "  1. Åpne applikasjonen i nettleseren"
        echo "  2. Registrer første bruker (blir automatisk admin)"
        echo "  3. Gå til /setup og konfigurer Jellyfin"
    else
        echo "Lokal PostgreSQL deployment er klar!"
        echo ""
        echo "⚠ VIKTIG: Lokal deployment har begrenset funksjonalitet:"
        echo "  - Ingen autentisering (må implementeres manuelt)"
        echo "  - Ingen edge functions"
        echo "  - Jellyfin må konfigureres manuelt i databasen"
        echo ""
        echo "Database kjører på:"
        echo "  postgresql://localhost:5432/$DB_NAME"
        echo ""
        echo "For full funksjonalitet, vurder å bruke Supabase Cloud"
        echo "med lokal PostgreSQL for data-lagring."
    fi
    
    echo ""
    print_info "Dokumentasjon:"
    echo "  - README.md - Generell oversikt"
    echo "  - DEPLOYMENT_LOCAL.md - Lokal deployment guide"
    echo "  - docker-compose.yml - Docker konfigurasjon"
}

# Main setup flow
main() {
    clear
    print_header "🚀 JELLY STREAM VIEWER - SETUP"
    
    # Sjekk systemkrav
    check_docker
    check_node
    
    # Installer Netdata for monitoring
    install_netdata
    
    # Velg deployment type
    choose_deployment_type
    
    # Setup basert på valg
    if [[ $DEPLOYMENT_TYPE == "cloud" ]]; then
        setup_supabase_cloud
    else
        setup_local_postgres
    fi
    
    # Installer og bygg
    install_dependencies
    build_app
    
    # Nginx setup (valgfritt)
    setup_nginx
    
    # Ferdig!
    print_completion
}

# Kjør main
main
