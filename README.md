# EventSphere

Minimal full-stack campus event registration app.

## Tech stack

- Node.js + Express
- MongoDB (via Mongoose)
- HTML, CSS, vanilla JavaScript

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` based on `.env.example` and set:

- `PORT` – port for the HTTP server
- `MONGO_URL` – MongoDB connection string

3. Run in development:

```bash
npm run dev
```

4. Run in production:

```bash
npm start
```

The app serves the frontend from the `client` folder and the JSON API under:

- `GET /events`
- `GET /events/:id`
- `POST /events`
- `PUT /events/:id`
- `DELETE /events/:id`
- `POST /register/:eventId`
- `GET /registrations/:eventId`

## Docker Deployment

> 📘 **For detailed architecture, routing flow, and production deployment instructions**, see [DEPLOYMENT.md](DEPLOYMENT.md) and [NGINX_ARCHITECTURE.md](NGINX_ARCHITECTURE.md).

### Quick Start (Recommended)

**1. Configure firewall rules** (Windows PowerShell as Administrator):

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser
.\firewall.ps1
```

This script:
- ✅ Allows port **80** (HTTP) for public access via Nginx
- ✅ Blocks port **3000** (Node.js) from external access
- ✅ Blocks port **27017** (MongoDB) from external access

**2. Start the application:**

```bash
docker-compose up --build
```

**3. Access the application:**

```
http://localhost/
```

The system is now accessible via **port 80 only** through a reverse proxy layer.

---

### Architecture: Reverse Proxy Pattern

EventSphere uses **Nginx as a reverse proxy** to provide:

```
┌─────────────────────────────────────────┐
│  Port 80 (HTTP) - Public Entry Point    │
│           ↓                             │
│  Nginx Reverse Proxy                    │
│  ├─ Static Files (/, /css, /js)         │
│  └─ API Routes (/events, /register)     │
│           ↓                  ↓          │
│     ┌─────────────┐    ┌──────────┐    │
│     │ Static HTML │    │Node.js   │    │
│     │ Assets      │    │API       │    │
│     │(Cached 1h)  │    │(No cache)│    │
│     └─────────────┘    └──────────┘    │
│                              ↓          │
│                        ┌──────────┐     │
│                        │ MongoDB  │     │
│                        │(Internal)│     │
│                        └──────────┘     │
└─────────────────────────────────────────┘
```

**Benefits:**
- **Single entry point**: All traffic flows through port 80
- **Security isolation**: Backend services hidden from direct access
- **Routing intelligence**: Nginx decides frontend vs API handling
- **Header management**: Security headers applied consistently
- **CORS handling**: Cross-origin requests properly managed

---

### Port Exposure Decisions

| Port | Service | External | Justification |
|------|---------|----------|---------------|
| **80** | Nginx (proxy) | ✅ YES | Users access the web application here |
| **3000** | Node.js (app) | ❌ NO | Only Nginx connects internally; prevents bypass attacks |
| **27017** | MongoDB (db) | ❌ NO | Databases must NEVER be internet-accessible |

The firewall rules enforce these decisions, providing defense-in-depth security.

---

### Using Docker Compose (Current Setup)

```yaml
version: '3.8'

services:
  # MongoDB (internal, no port exposed)
  mongo:
    image: mongo:6
    restart: unless-stopped
    volumes:
      - mongo-data:/data/db

  # Node.js Express API (internal, no port exposed)
  app:
    build: .
    restart: unless-stopped
    environment:
      - PORT=3000
      - MONGO_URL=mongodb://mongo:27017/eventsphere
    depends_on:
      - mongo
    command: npm start

  # Nginx Reverse Proxy (port 80 ONLY)
  proxy:
    image: nginx:1.27-alpine
    restart: unless-stopped
    depends_on:
      - app
    ports:
      - "80:80"  # ← Only exposed port
    volumes:
      - ./client:/usr/share/nginx/html:ro
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro

volumes:
  mongo-data:
    driver: local
```

**Key insight:** Only the `proxy` service has a `ports` binding. The others are entirely internal.

---

### Managing the Deployment

**View logs:**
```bash
docker-compose logs -f proxy        # Nginx logs
docker-compose logs -f app          # Node.js logs
docker-compose logs -f mongo        # MongoDB logs
```

**Seed sample data:**
```bash
docker-compose exec app npm run seed
```

**Stop services:**
```bash
docker-compose down           # Stop (preserve volumes)
docker-compose down -v        # Stop + delete volumes
```

**Restart services:**
```bash
docker-compose restart proxy   # Reload config
docker-compose restart app     # Restart backend
```

---

### HTTP Routing Flow

All requests enter through **port 80 → Nginx**:

#### Request: `GET /`
```
Browser → Port 80 → Nginx
         ↓ (matches location /)
         Serve static file: /usr/share/nginx/html/index.html
         ↓ (with cache headers)
         Browser renders HTML
```

#### Request: `POST /events` (JSON)
```
JavaScript → Port 80 → Nginx
           ↓ (matches location ~ ^/(events|register|...))
           Proxy to http://app:3000
           ↓ (Express handler)
           Query MongoDB
           ↓
           Return JSON + CORS headers
           ↓
           Browser processes response
```

#### Request: `OPTIONS /events` (CORS preflight)
```
Browser → Port 80 → Nginx
        ↓ (detects $request_method = OPTIONS)
        ← Return 204 with CORS headers (no backend call)
        Browser allows the actual request
```

See [NGINX_ARCHITECTURE.md](NGINX_ARCHITECTURE.md) for detailed routing documentation.

---

### Nginx Server Block Configuration

The `nginx/nginx.conf` file demonstrates structured proxy configuration:

```nginx
# Route 1: Frontend Static Files
location / {
  root /usr/share/nginx/html;
  try_files $uri $uri/ /index.html;  # SPA routing fallback
  expires 1h;                        # Cache for 1 hour
  add_header Cache-Control "public, max-age=3600";
}

# Route 2: API Endpoints
location ~ ^/(events|register|registrations|health) {
  proxy_pass http://eventsphere_app;     # Forward to Node.js
  proxy_http_version 1.1;
  proxy_set_header Connection "";        # Connection pooling
  proxy_set_header X-Real-IP $remote_addr;  # Forward client IP
  
  add_header 'Access-Control-Allow-Origin' '*' always;  # CORS
  add_header 'Cache-Control' 'no-cache, no-store' always;  # No cache
}

# Route 3: Security (Block sensitive files)
location ~ /(node_modules|\.env|package\.json) {
  deny all;
  access_log off;
}
```

Each location block clearly documents:
- **What it handles** (path pattern)
- **Where it routes** (static files vs backend)
- **Headers applied** (CORS, cache control, security)
- **Purpose** (why this routing exists)

---

### Production Checklist

- [ ] Add HTTPS (TLS certificate on port 443)
- [ ] Change CORS from `*` to specific domain(s)
- [ ] Enable MongoDB authentication
- [ ] Add rate limiting to prevent DDoS
- [ ] Enable gzip compression in Nginx
- [ ] Set up monitoring/logging aggregation
- [ ] Configure database backups
- [ ] Remove development mounts from docker-compose.yml

See [DEPLOYMENT.md](DEPLOYMENT.md#production-hardening) for implementation details.

---

### Plain Docker (Advanced)

Build the image manually:

```bash
docker build -t eventsphere .
```

Run with existing MongoDB:

```bash
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e MONGO_URL=mongodb://host.docker.internal:27017/eventsphere \
  eventsphere
```

Note: This exposes port 3000 directly (no reverse proxy).

