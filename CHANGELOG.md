# Changelog

All notable changes to Jelly Stream Viewer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 🔄 Real-time update progress tracking with WebSocket subscriptions
- 📊 Update status table with live progress updates
- 📝 Detailed update logs viewer with expandable dialog
- 🔍 Search and filter functionality for system logs
- 📈 Progress bars for update installations
- 🎯 Update system improvements for self-hosted deployments

### Changed
- 📖 Complete documentation overhaul - all docs now in English
- 🏗️ Updated ARCHITECTURE.md to reflect Lovable Cloud deployment
- 📚 Modernized DEPLOYMENT.md with current best practices
- 🔒 Enhanced SECURITY.md with comprehensive security guidelines
- 🗑️ Removed outdated VERSIONING.md and DEPLOYMENT_LOCAL.md

### Fixed
- 🐛 Update manager now properly shows webhook configuration requirements
- 🔧 System logs now work correctly with Lovable Cloud deployment

---

## [2.0.0] - 2024-01-20

### 🔥 Breaking Changes
- **Removed edge function proxy**: Frontend now communicates directly with Jellyfin server
- **Requires local deployment**: Jellyfin and frontend must be on the same network

### ✨ Added
- Direct HTTP communication with Jellyfin (faster, simpler)
- New `useJellyfinDirect` hook for local API access
- Improved error handling with detailed HTTP status codes
- Automatic configuration via `/setup` on first use
- Setup wizard for initial configuration
- News and announcements system
- User management for administrators
- Content request system with Jellyseerr integration
- Watch history tracking
- Favorites and likes functionality
- Chromecast support
- Subtitle support with multiple options
- Server health monitoring dashboard
- Version management system

### 🗑️ Removed
- `supabase/functions/jellyfin-proxy/` - no longer necessary
- `supabase/functions/jellyfin-setup/` - replaced with direct database writes
- `supabase/functions/jellyfin-search-subtitles/` - now direct API calls
- `supabase/functions/jellyfin-download-subtitle/` - now direct API calls

### 📝 Documentation
- New `ARCHITECTURE.md` - detailed architecture overview
- Updated `README.md` with deployment instructions
- New `CHANGELOG.md` for version tracking
- New `SECURITY.md` for security best practices
- Comprehensive deployment guides

### 🔄 Migration from v1.x

**If upgrading from previous version:**

1. **Stop the application**:
   ```bash
   sudo systemctl stop jelly-stream  # if using systemd
   ```

2. **Update code**:
   ```bash
   git pull origin main
   npm install
   npm run build
   ```

3. **Verify Jellyfin URL**:
   - Log in as admin
   - Go to Admin → Server Settings
   - Ensure Jellyfin URL is set to local IP: `http://192.168.1.X:8096`

4. **Run database migrations**:
   - Check `supabase/migrations/` for new files
   - Run new migrations in Supabase SQL Editor
   - Or run complete `supabase/setup.sql` again (safe with IF NOT EXISTS)

5. **Start the application**:
   ```bash
   sudo systemctl start jelly-stream
   # or
   sudo systemctl restart nginx
   ```

6. **Test functionality**:
   - Verify media loads correctly
   - Test video playback
   - Check search and favorites

### 🐛 Known Issues
- Jellyseerr integration still uses edge functions (planned update)
- CORS may require configuration on Jellyfin server in some cases

---

## [1.x] - Legacy Versions

See git history for previous changes.

### Security Improvements
- 🔒 Row-Level Security (RLS) on all database tables
- 🔒 Role-based access control system
- 🔒 Secure API key storage
- 🔒 JWT-based authentication
- 🔒 Input validation on all edge functions

### Performance Improvements
- ⚡ Direct Jellyfin streaming (no proxy overhead)
- ⚡ Optimized database queries
- ⚡ Frontend code splitting
- ⚡ Image lazy loading
- ⚡ Query result caching

---

## Legend

- ✨ New features
- 🐛 Bug fixes
- 🔒 Security improvements
- ⚡ Performance improvements
- 📝 Documentation updates
- 🗑️ Removed features
- 🔥 Breaking changes
- 🔄 Changed features
- 📊 Data/Database changes
- 🎨 UI/UX improvements
- 🔧 Configuration changes

---

## Contributing

When adding entries to the changelog:
1. Add unreleased changes under `[Unreleased]` section
2. Use appropriate emoji from the legend
3. Be descriptive but concise
4. Link to issues/PRs when relevant
5. Group changes by category (Added, Changed, Fixed, etc.)

## Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality (backwards compatible)
- **PATCH** version for backwards compatible bug fixes

---

**For security vulnerabilities, please see SECURITY.md**
