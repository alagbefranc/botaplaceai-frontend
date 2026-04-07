# Admin Portal Subdomain Setup

This guide explains how to set up `admin.botaplaceai.com` to serve the admin portal.

## Overview

The admin portal is located at `/admin` in the Next.js app. To serve it from a subdomain (`admin.botaplaceai.com`), you have two options:

### Option 1: Vercel/Netlify Rewrites (Recommended)

If deploying to Vercel or Netlify, use rewrites to route the subdomain to the `/admin` path.

#### Vercel Configuration

Add to `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/:path*",
      "has": [
        {
          "type": "host",
          "value": "admin.botaplaceai.com"
        }
      ],
      "destination": "/admin/:path*"
    }
  ]
}
```

#### Netlify Configuration

Add to `netlify.toml`:

```toml
[[redirects]]
  from = "/*"
  to = "/admin/:splat"
  status = 200
  conditions = {Host = ["admin.botaplaceai.com"]}
```

### Option 2: Next.js Middleware Rewrite

The app already supports subdomain routing via middleware. Add this to `middleware.ts`:

```typescript
// At the top of the middleware function
const hostname = request.headers.get("host") || "";

// Check if this is the admin subdomain
if (hostname.startsWith("admin.")) {
  // Rewrite to /admin path
  const url = request.nextUrl.clone();
  if (!url.pathname.startsWith("/admin")) {
    url.pathname = `/admin${url.pathname}`;
    return NextResponse.rewrite(url);
  }
}
```

## DNS Configuration

1. Go to your DNS provider (Cloudflare, Route53, etc.)
2. Add a CNAME record:
   - **Name:** `admin`
   - **Value:** Your main domain or deployment URL (e.g., `botaplaceai.com` or `your-app.vercel.app`)
   - **TTL:** Auto or 300

## SSL Certificate

If using Vercel/Netlify, SSL is automatic. For custom deployments:
- Ensure your SSL certificate covers `*.botaplaceai.com` (wildcard) or specifically `admin.botaplaceai.com`

## Admin Portal Pages

The admin portal includes:

| Path | Description |
|------|-------------|
| `/admin` | Dashboard with stats overview |
| `/admin/monitoring` | Real-time system health & active sessions |
| `/admin/users` | User & organization management |
| `/admin/database` | Database management (coming soon) |
| `/admin/security` | API keys & access controls (coming soon) |
| `/admin/settings` | Platform configuration (coming soon) |

## Access Control

The admin layout (`app/admin/layout.tsx`) checks if the user has `role: "admin"` or `role: "super_admin"` in the `users` table. Currently, it allows all authenticated users for development. To restrict access:

1. Update the user's role in Supabase:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

2. Modify `app/admin/layout.tsx` to enforce role check:
```typescript
if (userData?.role !== "admin" && userData?.role !== "super_admin") {
  setIsAdmin(false);
  // This will show "Access Denied"
}
```

## Testing Locally

To test subdomain routing locally:

1. Add to `/etc/hosts` (Mac/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):
```
127.0.0.1 admin.localhost
```

2. Access `http://admin.localhost:3000`

Or simply access `http://localhost:3000/admin` directly.
