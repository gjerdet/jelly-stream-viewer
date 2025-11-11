# Architecture Overview

## System Design

Jelly Stream Viewer is a modern web application built on Lovable Cloud, providing a beautiful interface for Jellyfin media servers.

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        Client (Browser)                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           React Application (Frontend)                │  │
│  │                                                        │  │
│  │  • React 18 + TypeScript                             │  │
│  │  • Vite for bundling                                  │  │
│  │  • Tailwind CSS + shadcn/ui                          │  │
│  │  • React Router for navigation                        │  │
│  │  • TanStack Query for state management               │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                            │
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Jellyfin   │   │   Lovable    │   │  Jellyseerr  │
│    Server    │   │    Cloud     │   │  (Optional)  │
│              │   │              │   │              │
│ • Streaming  │   │ • Database   │   │ • Requests   │
│ • Metadata   │   │ • Auth       │   │ • Discovery  │
│ • Images     │   │ • Edge Fn    │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
```

## Component Breakdown

### Frontend Layer

The frontend is a Single Page Application (SPA) built with React and TypeScript.

#### Core Technologies
- **React 18**: Component-based UI
- **TypeScript**: Type-safe code
- **Vite**: Fast development and build tool
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Pre-built UI components
- **React Router**: Client-side routing
- **TanStack Query**: Server state management

#### Key Components

**Pages**
- `Index.tsx` - Home page with featured content
- `Browse.tsx` - Browse media by type
- `Detail.tsx` - Media detail view
- `Player.tsx` - Video player
- `Search.tsx` - Search functionality
- `Admin.tsx` - Admin dashboard
- `Login.tsx` / `Register.tsx` - Authentication

**Features**
- `MediaCard` - Display media items
- `MediaGrid` - Grid layout for media
- `FeaturedCarousel` - Hero carousel
- `VersionManager` - Update management
- `UpdateManager` - Update tracking with real-time progress
- `UserManagement` - Admin user controls
- `SystemLogs` - Log viewer

#### Custom Hooks

**Authentication & Users**
- `useAuth()` - Authentication state
- `useUserRole()` - User role checking
- `useJellyfinUsers()` - Jellyfin user data

**Media & Content**
- `useJellyfinApi()` - Jellyfin API calls
- `useJellyfinDirect()` - Direct Jellyfin access
- `useJellyseerr()` - Content requests

**System**
- `useServerSettings()` - Server configuration
- `useSiteSettings()` - Site customization
- `useHealthCheck()` - Server health monitoring
- `useVersions()` - Version management

### Backend Layer (Lovable Cloud)

Lovable Cloud provides the backend infrastructure powered by Supabase.

#### Database (PostgreSQL)

**User Management**
```sql
profiles              -- User profile data
user_roles            -- Role assignments (admin/user)
```

**Configuration**
```sql
server_settings       -- Jellyfin & Jellyseerr config
site_settings         -- Site customization
```

**User Data**
```sql
user_favorites        -- Favorited items
watch_history         -- Viewing history with progress
user_likes            -- Liked content
```

**Content Requests**
```sql
jellyseerr_requests   -- Content request management
```

**System**
```sql
news_posts            -- Announcements
app_versions          -- Version tracking
update_status         -- Update progress with realtime
```

#### Security Model

**Row-Level Security (RLS)**

Every table has RLS policies enforcing access control:

```sql
-- Example: Users can only see their own favorites
CREATE POLICY "Users can view their own favorites"
  ON user_favorites
  FOR SELECT
  USING (auth.uid() = user_id);

-- Example: Admins can manage users
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));
```

**Role System**

Roles are managed through a dedicated `user_roles` table:
- Prevents privilege escalation
- Uses `has_role()` function in policies
- First registered user becomes admin
- Admins can assign roles to other users

#### Edge Functions

Serverless functions running on Deno:

**Jellyfin Integration**
- `jellyfin-authenticate` - Jellyfin user auth
- `jellyfin-proxy` - API proxy (deprecated)
- `jellyfin-stream` - Stream proxy (deprecated)

**Jellyseerr Integration**
- `jellyseerr-discover` - Discover content
- `jellyseerr-search` - Search TMDB
- `jellyseerr-request` - Submit requests
- `jellyseerr-movie-details` - Movie info
- `jellyseerr-tv-details` - TV show info
- `jellyseerr-season-details` - Season info

**System Functions**
- `check-updates` - Check GitHub for updates
- `trigger-update` - Trigger update process
- `fetch-system-logs` - Retrieve system logs
- `server-stats` - Server monitoring

**Real-time Updates**

The `update_status` table uses Postgres real-time subscriptions:

```typescript
const channel = supabase
  .channel('update-status-changes')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'update_status'
  }, (payload) => {
    // Update UI in real-time
  })
  .subscribe();
```

### External Integrations

#### Jellyfin Server

Direct communication with Jellyfin API:

**Authentication**
```typescript
// Uses X-Emby-Token header
headers: {
  'X-Emby-Token': apiKey
}
```

**Key Endpoints Used**
- `/Users` - User management
- `/Items` - Media library
- `/Videos/{id}/stream` - Video streaming
- `/System/Info` - Server info
- `/Items/{id}/Images` - Media images

#### Jellyseerr (Optional)

Integration for content requests:

**Features**
- Search TMDB database
- Request movies and TV shows
- Season-specific TV requests
- Admin approval workflow

## Data Flow

### 1. User Authentication

```
User → Login Page
  ↓
  Submit Credentials
  ↓
  Lovable Cloud Auth
  ↓
  JWT Token
  ↓
  Store in localStorage
  ↓
  Check user_roles table
  ↓
  Load user profile
  ↓
  Redirect to Home
```

### 2. Media Browsing

```
User → Browse Page
  ↓
  Request Media List
  ↓
  Get Jellyfin URL & API Key from server_settings
  ↓
  Direct API Call to Jellyfin
  ↓
  Receive Media Data
  ↓
  Render Media Grid
```

### 3. Video Playback

```
User → Click Play
  ↓
  Navigate to Player
  ↓
  Get Stream URL from Jellyfin
  ↓
  Initialize Video Element
  ↓
  Track Progress
  ↓
  Save to watch_history (every 30s)
```

### 4. Content Request

```
User → Search Content
  ↓
  Call jellyseerr-search Edge Function
  ↓
  Edge Function → Jellyseerr API
  ↓
  Display Results
  ↓
  User Selects Item
  ↓
  Submit Request
  ↓
  Save to jellyseerr_requests
  ↓
  Admin Receives Notification
  ↓
  Admin Approves/Rejects
  ↓
  Update Request Status
```

### 5. System Updates

```
Admin → Check for Updates
  ↓
  Call check-updates Edge Function
  ↓
  Compare installed_commit_sha with GitHub
  ↓
  Display Update Info
  ↓
  Admin Clicks Install
  ↓
  Call trigger-update Edge Function
  ↓
  Create entry in update_status table
  ↓
  Real-time subscription sends progress updates
  ↓
  Edge Function sends webhook to update server
  ↓
  Update server pulls code, builds, restarts
  ↓
  Updates update_status with progress
  ↓
  UI shows real-time progress
  ↓
  Auto-reload on completion
```

## State Management

### Client State
- **React State**: Component-local state
- **TanStack Query**: Server state caching
  - Automatic refetching
  - Background updates
  - Optimistic updates
  - Error handling

### Server State
- **Database**: Persistent data
- **localStorage**: Auth tokens, user preferences
- **sessionStorage**: Temporary data

## Performance Optimizations

### Frontend
- Code splitting by route
- Lazy loading of components
- Image lazy loading
- Virtual scrolling for large lists
- Debounced search
- Query result caching

### Backend
- Database indexing on frequently queried columns
- RLS policy optimization
- Edge Function response caching
- Real-time subscriptions for live updates

### Media Streaming
- Direct Jellyfin streaming (no proxy)
- Jellyfin handles transcoding
- Resume from last position
- Chromecast support

## Security Considerations

### Authentication
- JWT-based authentication
- Secure token storage
- Auto-refresh mechanism
- Session timeout

### Database
- Row-Level Security on all tables
- Role-based access control
- Prepared statements (SQL injection prevention)
- Input validation

### API Keys
- Jellyfin and Jellyseerr API keys stored in database
- Only accessible by admins
- Never exposed to client

### CORS
- Properly configured for Jellyfin access
- Edge Functions handle cross-origin requests

## Deployment

### Lovable Cloud (Recommended)
- Automatic deployment from GitHub
- Built-in CI/CD
- Managed database and auth
- Global CDN
- Automatic SSL

### Self-Hosted (Advanced)
- Requires webhook server for updates
- Manual edge function deployment
- Own Supabase instance or Lovable Cloud
- Nginx or similar web server
- SSL certificate management

## Monitoring & Debugging

### Built-in Tools
- System Logs viewer in Admin panel
- Health Check dashboard
- Server monitoring
- Update progress tracking

### External Tools
- Browser DevTools for frontend debugging
- Lovable Cloud backend panel for logs
- Supabase dashboard for database queries
- Jellyfin logs for media server issues

## Future Enhancements

Potential improvements:
- [ ] Offline support with service workers
- [ ] Progressive Web App (PWA)
- [ ] Download for offline viewing
- [ ] Advanced search filters
- [ ] Playlist creation
- [ ] Social features (ratings, reviews)
- [ ] Multi-language support
- [ ] Jellyfin plugin for tighter integration
- [ ] Mobile apps (React Native)
- [ ] Watch party features

## Conclusion

This architecture provides:
- **Scalability**: Cloud-native, serverless backend
- **Security**: RLS, role-based access, secure storage
- **Performance**: Direct streaming, caching, optimizations
- **Maintainability**: TypeScript, modular code, clear separation
- **User Experience**: Real-time updates, responsive design, intuitive UI
