#!/bin/bash

# Jelly Stream Startup Health Check Script
# Kjør dette scriptet etter systemstart for å verifisere alle tjenester

set -e

# Farger
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Jelly Stream Health Check ===${NC}"
echo "Sjekker alle tjenester..."
echo ""

# Antall feil
ERRORS=0
WARNINGS=0

# Sjekk systemd-tjenester
check_service() {
    local SERVICE=$1
    local DISPLAY_NAME=$2
    
    if systemctl is-active --quiet "$SERVICE" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $DISPLAY_NAME kjører"
        return 0
    else
        echo -e "${RED}✗${NC} $DISPLAY_NAME IKKE AKTIV"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Sjekk port
check_port() {
    local PORT=$1
    local NAME=$2
    
    if nc -z localhost "$PORT" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Port $PORT ($NAME) åpen"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Port $PORT ($NAME) ikke tilgjengelig"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

echo -e "${BLUE}[1/3] Systemd-tjenester${NC}"
echo "─────────────────────────────────────"
check_service "jelly-stream-preview" "Preview (Web UI)"
check_service "jelly-git-pull" "Git Pull Server"
check_service "jelly-transcode" "Transcode Server"
echo ""

echo -e "${BLUE}[2/3] Porter${NC}"
echo "─────────────────────────────────────"
check_port 4173 "Preview"
check_port 3002 "Git Pull"
check_port 3001 "Transcode"
check_port 19999 "Netdata" || true  # Netdata er valgfri
echo ""

echo -e "${BLUE}[3/3] Systemstatus${NC}"
echo "─────────────────────────────────────"

# Sjekk disk
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓${NC} Disk: ${DISK_USAGE}% brukt"
elif [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠${NC} Disk: ${DISK_USAGE}% brukt (vurder opprydding)"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${RED}✗${NC} Disk: ${DISK_USAGE}% brukt (KRITISK!)"
    ERRORS=$((ERRORS + 1))
fi

# Sjekk minne
MEM_USAGE=$(free | awk '/Mem:/ {printf "%.0f", $3/$2 * 100}')
if [ "$MEM_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓${NC} Minne: ${MEM_USAGE}% brukt"
elif [ "$MEM_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠${NC} Minne: ${MEM_USAGE}% brukt"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${RED}✗${NC} Minne: ${MEM_USAGE}% brukt (KRITISK!)"
    ERRORS=$((ERRORS + 1))
fi

# Sjekk CPU load
LOAD=$(cat /proc/loadavg | awk '{print $1}')
CORES=$(nproc)
LOAD_INT=$(echo "$LOAD" | cut -d. -f1)
if [ "$LOAD_INT" -lt "$CORES" ]; then
    echo -e "${GREEN}✓${NC} CPU load: $LOAD (${CORES} kjerner)"
else
    echo -e "${YELLOW}⚠${NC} CPU load: $LOAD (høy for ${CORES} kjerner)"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "─────────────────────────────────────"

# Oppsummering
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ Alt ser bra ut! Systemet er klart.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS advarsler funnet, men ingen kritiske feil.${NC}"
    exit 0
else
    echo -e "${RED}✗ $ERRORS feil og $WARNINGS advarsler funnet!${NC}"
    echo ""
    echo "Forslag:"
    echo "  - Sjekk logger: sudo journalctl -u <tjeneste> -n 50"
    echo "  - Restart tjeneste: sudo systemctl restart <tjeneste>"
    echo "  - Kjør oppsett: sudo bash setup-preview-service.sh"
    exit 1
fi
