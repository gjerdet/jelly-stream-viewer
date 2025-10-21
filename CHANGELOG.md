# Changelog

## v2.0.0 - Lokal Deployment Arkitektur (2025-10-21)

### 🔥 Breaking Changes
- **Fjernet edge function proxy**: Frontend snakker nå direkte med Jellyfin server
- **Krever lokal deployment**: Jellyfin og frontend må være på samme nettverk

### ✨ Nye Funksjoner
- Direkte HTTP-kommunikasjon med Jellyfin (raskere, enklere)
- Ny `useJellyfinDirect` hook for lokal API-tilgang
- Forbedret feilhåndtering med detaljerte HTTP-statuskoder
- Automatisk konfigurasjon via `/setup` ved første gangs bruk

### 🗑️ Fjernet
- `supabase/functions/jellyfin-proxy/` - ikke lenger nødvendig
- `supabase/functions/jellyfin-setup/` - erstattet med direkte database-skriving
- `supabase/functions/jellyfin-search-subtitles/` - nå direkte API-kall
- `supabase/functions/jellyfin-download-subtitle/` - nå direkte API-kall

### 📝 Dokumentasjon
- Ny `ARCHITECTURE.md` - detaljert arkitekturoversikt
- Oppdatert `README.md` med lokal deployment-instruksjoner
- Ny `CHANGELOG.md` for versjonssporing

### 🔄 Migrering fra v1.x

**Hvis du oppgraderer fra tidligere versjon:**

1. **Stopp applikasjonen**:
   ```bash
   sudo systemctl stop jelly-stream  # hvis du bruker systemd
   ```

2. **Oppdater kode**:
   ```bash
   git pull origin main
   npm install
   npm run build
   ```

3. **Verifiser Jellyfin URL**:
   - Logg inn som admin
   - Gå til Admin → Server Settings
   - Sørg for at Jellyfin URL er satt til lokal IP: `http://192.168.1.X:8096`

4. **Start applikasjonen**:
   ```bash
   sudo systemctl start jelly-stream
   # eller
   sudo systemctl restart nginx
   ```

5. **Test funksjonalitet**:
   - Verifiser at media laster
   - Test avspilling
   - Sjekk søk og favoritter

### 🐛 Kjente Problemer
- Jellyseerr-integrasjon bruker fortsatt edge functions (planlagt oppdatering)
- CORS kan kreve konfigurasjon på Jellyfin-serveren i noen tilfeller

---

## v1.x - Eldre Versjoner

Se git history for tidligere endringer.
