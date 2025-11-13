# Jelly Stream Viewer

A modern web application for streaming from Jellyfin media servers with a beautiful, responsive interface.

## 🌟 Features

- 🎬 **Stream Movies & TV Shows** - Direct streaming from Jellyfin
- 📱 **Mobile Responsive** - Works great on all devices
- 🔐 **User Authentication** - Secure login with role-based access
- ⭐ **Favorites & Watch History** - Keep track of your content
- 📺 **Chromecast Support** - Cast to your TV
- 🌐 **Subtitle Support** - Multiple subtitle options
- 🎯 **Jellyseerr Integration** - Request content with admin approval
- 📰 **News Feed** - Stay updated with announcements
- 👥 **User Management** - Admin panel for user control
- 🔄 **Auto-Updates** - Built-in update tracking and management
- 📊 **Statistics** - View your watching habits

## 🏗️ Architecture

This application is built on **Lovable Cloud** and uses:

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend**: Lovable Cloud (Supabase)
  - PostgreSQL database with Row-Level Security (RLS)
  - Edge Functions for server-side logic
  - Real-time subscriptions
- **Media Server**: Direct integration with Jellyfin
- **Optional**: Jellyseerr for content requests

### How It Works

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ├──────────────────────┐
       │                      │
       ▼                      ▼
┌─────────────┐        ┌────────────┐
│   Jellyfin  │        │  Lovable   │
│    Server   │        │   Cloud    │
│             │        │            │
│  • Video    │        │  • Auth    │
│  • Metadata │        │  • DB      │
│  • Images   │        │  • Edge Fn │
└─────────────┘        └────────────┘
```

## 🚀 Getting Started

### Prerequisites

- A **Jellyfin media server** (with API access)
- (Optional) A **Jellyseerr** instance for content requests
- A modern web browser

### First-Time Setup

1. **Register an Account**
   - Navigate to the application
   - Click "Register" and create your account
   - The first registered user automatically becomes an admin

2. **Configure Jellyfin Connection**
   - Log in with your new account
   - Go to **Admin → Servers** tab
   - Enter your Jellyfin server details:
     - Server URL (e.g., `http://192.168.1.100:8096`)
     - API Key (generate in Jellyfin Dashboard → Advanced → API Keys)

3. **(Optional) Configure Jellyseerr**
   - In the same Servers tab
   - Enter Jellyseerr URL and API Key
   - This enables content request functionality

4. **Start Watching!**
   - Browse your media library
   - Add favorites
   - Start streaming

## 👥 User Roles

### Admin
- Full access to all features
- User management
- Server configuration
- Content request approval
- News posting

### User
- Browse and watch content
- Manage favorites and watch history
- Request content (if Jellyseerr is configured)
- View news

## 🔧 Admin Features

### Server Configuration
- Jellyfin server URL and API key
- Jellyseerr integration settings
- GitHub repository settings (for self-hosted deployments)

### User Management
- View all users
- Change user roles
- View user activity

### Content Requests
- Approve or reject user requests
- View request status
- Automatic Jellyseerr integration

### News & Announcements
- Create news posts
- Pin important announcements
- Publish/unpublish posts

### System Monitoring
- Server health checks
- Update management
- System logs (for self-hosted)

## 🔄 Update System

The application includes built-in update tracking:

1. **Check for Updates**
   - Admin → Versions tab
   - Click "Check for Updates"
   - View latest version info from GitHub

2. **Install Updates** (Self-Hosted Only)
   - Click "Install Update"
   - Watch real-time progress
   - View detailed logs
   - Auto-reload when complete

*Note: Update installation requires webhook configuration for self-hosted deployments.*

## 🔒 Security

### Authentication
- Secure JWT-based authentication via Lovable Cloud
- Password hashing and encryption
- Session management
- Auto-refresh tokens

### Database Security
- Row-Level Security (RLS) on all tables
- Users can only access their own data
- Admins have elevated permissions via `has_role()` function
- API keys stored securely with admin-only access

### Best Practices
- Use strong passwords
- Secure your Jellyfin API keys
- Keep the application updated
- Use HTTPS in production

## 🛠️ Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/gjerdet/jelly-stream-viewer.git
cd jelly-stream-viewer

# Install dependencies
npm install

# Set up environment variables
# Create a .env file with your Lovable Cloud credentials

# Start development server
npm run dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## 📁 Project Structure

```
jelly-stream-viewer/
├── src/
│   ├── components/        # React components
│   │   ├── ui/           # shadcn/ui components
│   │   └── ...           # Feature components
│   ├── pages/            # Page components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   └── integrations/     # External integrations
│       └── supabase/     # Lovable Cloud client
│
├── supabase/             # Backend configuration
│   ├── functions/        # Edge Functions
│   └── setup.sql         # Database schema
│
├── public/               # Static assets
└── docs/                 # Documentation
```

## 🔍 Troubleshooting

### Cannot Connect to Jellyfin

**Check:**
- Jellyfin server is running
- Server URL is correct (include http:// or https://)
- API key is valid
- Server is accessible from your network

### Authentication Issues

**Check:**
- Lovable Cloud backend is accessible
- Browser cookies are enabled
- No browser extensions blocking requests

### Video Won't Play

**Check:**
- Jellyfin server can transcode the media
- Browser supports the video codec
- Network connection is stable
- CORS is properly configured on Jellyfin

### Content Requests Not Working

**Check:**
- Jellyseerr URL and API key are correct
- Jellyseerr is accessible
- User has permission to request content

## 📝 Database Schema

The application uses these main tables:

- `profiles` - User profile information
- `user_roles` - Role assignments (admin/user)
- `server_settings` - Jellyfin and Jellyseerr configuration
- `site_settings` - Site customization
- `user_favorites` - User's favorite items
- `watch_history` - Viewing history with progress
- `user_likes` - Liked content
- `jellyseerr_requests` - Content requests
- `news_posts` - News and announcements
- `app_versions` - Version management
- `update_status` - Update progress tracking

All tables have Row-Level Security (RLS) policies enforcing proper access control.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with:
- [React](https://react.dev/)
- [Lovable](https://lovable.dev/)
- [Jellyfin](https://jellyfin.org/)
- [Jellyseerr](https://github.com/Fallenbagel/jellyseerr)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

## 📞 Support

For issues or questions:
- Create a [GitHub Issue](https://github.com/yourusername/jelly-stream-viewer/issues)
- Check existing documentation
- Review closed issues for solutions

---

**Made with ❤️ for Jellyfin users**
