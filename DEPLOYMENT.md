# EventSphere Deployment & Reverse Proxy Guide

## Quick Start

### Prerequisites
- Docker & Docker Compose installed
- Windows Firewall (or equivalent on other OS)
- Port 80 available (or modify `docker-compose.yml`)

### Deploy with One Command

```powershell
# 1. Configure firewall rules (required)
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser
.\firewall.ps1

# 2. Start the application
docker-compose up --build

# 3. Access the application
# http://localhost/
```

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│  USER BROWSER                                           │
│  • GET http://localhost/                                │
│  • POST http://localhost/events (JSON)                  │
│  • etc.                                                 │
└────────────────────────┬────────────────────────────────┘
                         │ Port 80
                         ↓
┌─────────────────────────────────────────────────────────┐
│  NGINX REVERSE PROXY (nginx:1.27-alpine)                │
│  • Listens on 0.0.0.0:80                                │
│  • Routes static files to /usr/share/nginx/html         │
│  • Routes API requests to http://app:3000               │
│  • Adds security headers to all responses               │
│  • Handles CORS preflight requests                      │
└────────────────────────┬────────────────────────────────┘
            │            │
    ┌───────┴────────────┴────────┐
    ↓                             ↓
  /static                      /api, /events,
  (HTML, CSS, JS)            /register, /health
    │                             │
    ↓                             ↓
  ┌──────────────────────────────────────────────────┐
  │  NODE.JS EXPRESS APPLICATION (app:3000)          │
  │  • Handles API logic                             │
  │  • Queries MongoDB                               │
  │  • Returns JSON responses                        │
  └──────────────────┬───────────────────────────────┘
                     │
                     ↓
  ┌──────────────────────────────────────────────────┐
  │  MONGODB (mongo:27017 - internal only)           │
  │  • Stores events, registrations                  │
  │  • Only accessible from app service              │
  └──────────────────────────────────────────────────┘
```

---

## Deployment Steps

### Step 1: Configure Firewall Rules

**Windows (PowerShell as Administrator):**

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser
.\firewall.ps1
```

This script will:
- ✅ Allow port 80 (HTTP) for public access
- ✅ Block port 3000 (Node.js) from external access
- ✅ Block port 27017 (MongoDB) from external access

**What each rule does:**

| Port | Rule | Purpose |
|------|------|---------|
| 80   | ALLOW | Nginx reverse proxy (the only public-facing service) |
| 3000 | BLOCK | Node.js backend (internal only, accessed via Nginx) |
| 27017 | BLOCK | MongoDB database (internal only, accessed by app) |

**Why three rules?**
- Defense-in-depth: Multiple barriers if one fails
- Even if Nginx crashes, backend/DB are still protected
- Explicit intent: Each rule documents what should/shouldn't be accessible

---

### Step 2: Verify Docker Environment

```powershell
# Check Docker is running
docker --version
docker-compose --version

# Verify images are available
docker images

# Expected output:
# node:20-alpine (for app FROM directive)
# nginx:1.27-alpine (for reverse proxy)
# mongo:6 (for database)
```

---

### Step 3: Configure Environment

The `.env` file is already set up for Docker:

```env
PORT=3000
MONGO_URL=mongodb://mongo:27017/eventsphere
```

**Note**: 
- `PORT=3000` is for internal Node.js listening
- `mongo` resolves to the `mongo` service in Docker network
- NOT `localhost` — uses Docker DNS

---

### Step 4: Build and Start Services

```powershell
# From EventSphere directory
cd C:\Users\thons\Desktop\EventSphere

# Build images and start containers (background)
docker-compose up --build -d

# Or run in foreground (see logs in real-time)
docker-compose up --build

# Check status
docker-compose ps
```

**Expected output:**
```
NAME            STATUS              PORTS
eventsphere-mongo-1   Up 2 seconds
eventsphere-app-1     Up 2 seconds
eventsphere-proxy-1   Up 1 second   0.0.0.0:80->80/tcp
```

---

### Step 5: Test the Deployment

#### Test 1: Access the Frontend

```powershell
# Open browser or use curl
curl http://localhost/

# Should return HTML (index.html)
# Status: 200 OK
# Content-Type: text/html
```

#### Test 2: Test API Endpoint

```powershell
# GET all events
curl http://localhost/events

# Expected response:
# [{"_id": "507f...", "title": "Event 1", ...}, ...]
# Status: 200 OK
# Content-Type: application/json
```

#### Test 3: Test API Mutation

```powershell
# Create a new event
curl -X POST http://localhost/events `
  -H "Content-Type: application/json" `
  -d '{"title": "New Event", "date": "2026-03-15", "location": "Hall A", "description": "Test event"}'

# Should return the created event with _id
# Status: 201 Created
```

#### Test 4: Test CORS Headers

```powershell
# Browser DevTools Console:
fetch('http://localhost/events')
  .then(r => r.json())
  .then(d => console.log('Events:', d))
  .catch(e => console.error('Error:', e))

# Should succeed (CORS headers present)
# No CORS errors in console
```

#### Test 5: Verify Security Headers

```powershell
curl -i http://localhost/

# Look for security headers in response:
# X-Content-Type-Options: nosniff
# X-Frame-Options: SAMEORIGIN
# X-XSS-Protection: 1; mode=block
```

---

## Docker Compose File Structure

```yaml
version: '3.8'

services:
  # MongoDB database (internal only, no port exposure)
  mongo:
    image: mongo:6
    restart: unless-stopped
    volumes:
      - mongo-data:/data/db  # Data persists between restarts

  # Node.js Express backend (internal only, no port exposure)
  app:
    build: .  # Builds from Dockerfile in current directory
    restart: unless-stopped
    environment:
      - PORT=3000  # Internal listening port
      - MONGO_URL=mongodb://mongo:27017/eventsphere
    depends_on:
      - mongo  # Waits for mongo to start first
    command: npm start  # Production command

  # Nginx reverse proxy (ONLY public-facing service)
  proxy:
    image: nginx:1.27-alpine
    restart: unless-stopped
    depends_on:
      - app  # Waits for app to start
    ports:
      - "80:80"  # Host port 80 -> container port 80
    volumes:
      - ./client:/usr/share/nginx/html:ro  # Static files (read-only)
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro  # Config (read-only)

volumes:
  mongo-data:  # Named volume for persistent data
    driver: local
```

**Key Point:** Only the `proxy` service has `ports` mapping. The others are internal-only.

---

## Nginx Configuration Overview

### Location Blocks (Request Routing)

| Path Pattern | Handler | Purpose | Cache |
|--------------|---------|---------|-------|
| `/` | Static files | Serve HTML/CSS/JS | 1 hour |
| `/events` | Proxy to app:3000 | API endpoint | No cache |
| `/register` | Proxy to app:3000 | API endpoint | No cache |
| `/registrations` | Proxy to app:3000 | API endpoint | No cache |
| `/health` | Proxy to app:3000 | Health check | No cache |
| `/.*` (hidden) | DENY | Block secret files | N/A |

### Request Headers Added by Nginx

```
X-Real-IP: <client-ip>
X-Forwarded-For: <client-ip>
X-Forwarded-Proto: http
```

These tell Node.js the real client IP (for logging, rate limiting, etc.).

---

## Managing the Deployment

### View Logs

```powershell
# All services
docker-compose logs

# Specific service
docker-compose logs proxy
docker-compose logs app
docker-compose logs mongo

# Follow logs (live)
docker-compose logs -f proxy

# Last 50 lines
docker-compose logs --tail=50 app
```

### Stop Services

```powershell
# Stop but keep containers
docker-compose stop

# Stop and remove containers (volumes persist)
docker-compose down

# Stop, remove containers, AND delete volumes
docker-compose down -v
```

### Restart Services

```powershell
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart proxy

# Rebuild and restart
docker-compose up --build -d
```

### Execute Commands in Container

```powershell
# Seed the database with sample data
docker-compose exec app npm run seed

# Interactive shell in app container
docker-compose exec app sh

# Interactive shell in mongo container
docker-compose exec mongo mongosh
```

### Health Checks

```powershell
# Does the app respond to health check?
curl http://localhost/health

# Expected: {"status": "ok"}
```

---

## Troubleshooting

### Problem: Port 80 Already in Use

```powershell
# Find what's using port 80
netstat -ano | findstr :80

# Kill the process
taskkill /PID <pid> /F

# Or change docker-compose.yml port:
# ports:
#   - "8080:80"  # Host port 8080 -> container port 80
# Then access http://localhost:8080/
```

### Problem: Nginx Can't Find Files

```powershell
# Check volume mount in docker-compose.yml:
volumes:
  - ./client:/usr/share/nginx/html:ro

# Verify files exist
dir client/
# Should show: index.html, css/, js/

# Check nginx logs
docker-compose logs proxy
```

### Problem: API Requests Fail

```powershell
# Test app is running
curl http://localhost:3000/events
# Should fail (port 3000 blocked by firewall)

# Check app logs
docker-compose logs app

# Verify app can reach MongoDB
docker-compose exec app npm run seed
```

### Problem: CORS Errors in Browser Console

```
Access to XMLHttpRequest at 'http://localhost/events' from origin 'http://localhost' 
has been blocked by CORS policy
```

**Solution:** Check nginx.conf has:
```nginx
add_header 'Access-Control-Allow-Origin' '*' always;
add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
```

---

## Production Hardening

### 1. Enable HTTPS

```nginx
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  
  ssl_certificate /etc/nginx/certs/cert.pem;
  ssl_certificate_key /etc/nginx/certs/key.pem;
  
  # Redirect HTTP to HTTPS
  return 301 https://$server_name$request_uri;
}

# Also add HTTP-to-HTTPS redirect server block:
server {
  listen 80;
  return 301 https://$server_name$request_uri;
}
```

### 2. Restrict CORS to Known Domains

```nginx
# Instead of '*', specify your domain:
map $http_origin $cors_origin {
  default "";
  "~^https://yourdomain\.com$" $http_origin;
  "~^https://www\.yourdomain\.com$" $http_origin;
}

add_header 'Access-Control-Allow-Origin' $cors_origin always;
```

### 3. Add Rate Limiting

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=frontend:10m rate=50r/s;

location ~ ^/(events|register|registrations) {
  limit_req zone=api burst=20 nodelay;
  # ... proxy settings
}

location / {
  limit_req zone=frontend burst=100 nodelay;
  # ... static file settings
}
```

### 4. Enable gzip Compression

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1000;
gzip_types text/plain text/css text/xml text/javascript 
           application/json application/javascript application/xml+rss;
gzip_disable "MSIE [1-6]\.";
```

### 5. Add Security Headers (Already Done)

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
```

### 6. Enable MongoDB Authentication

**Create admin user:**
```bash
docker-compose exec mongo mongosh

# Inside mongosh:
db.createUser({
  user: "eventsphere_user",
  pwd: "secure_password_here",
  roles: [{ role: "readWrite", db: "eventsphere" }]
})
```

**Update docker-compose.yml:**
```yaml
mongo:
  environment:
    - MONGO_INITDB_ROOT_USERNAME=admin
    - MONGO_INITDB_ROOT_PASSWORD=admin_password
```

**Update .env:**
```env
MONGO_URL=mongodb://eventsphere_user:secure_password_here@mongo:27017/eventsphere?authSource=admin
```

### 7. Container Security

```yaml
# In docker-compose.yml, add to app service:
services:
  app:
    security_opt:
      - no-new-privileges:true
    read_only: true  # If possible
    user: "node"  # Don't run as root

  proxy:
    security_opt:
      - no-new-privileges:true
    user: "nginx"  # Nginx runs as non-root by default

  mongo:
    security_opt:
      - no-new-privileges:true
```

---

## Monitoring

### Key Metrics to Watch

1. **Response Time**: Slow API responses indicate backend issues
2. **Error Rate**: 5xx errors indicate app crashes
3. **Throughput**: How many requests per second?
4. **CPU/Memory**: Container resource usage

### View Metrics

```powershell
# Real-time stats
docker stats

# Shows container CPU%, memory use, network I/O
```

### Set Up Logging

```powershell
# View Nginx access logs
docker-compose logs -f proxy

# Example log entry:
# 127.0.0.1 - - [27/Feb/2026:15:42:30 +0000] "GET /events HTTP/1.1" 200 542
#
# Fields: client IP, -, -, timestamp, method, path, protocol, status, response size
```

---

## Scaling Tips

### Multiple Backend Instances

```nginx
# upstream definition in nginx.conf
upstream eventsphere_app {
  server app1:3000;
  server app2:3000;
  server app3:3000;
  keepalive 32;
}
```

### With Docker Compose

```yaml
# Start multiple app instances
docker-compose up -d --scale app=3

# Nginx automatically load-balances across them
```

---

## Summary: Port Exposure Decision Table

| Port | Service | External? | Public? | Why |
|------|---------|-----------|---------|-----|
| **80** | Nginx (proxy) | ✓ YES | ✓ YES | Users access here |
| **3000** | Node.js (app) | ✗ NO | ✗ NO | Only Nginx connects (internal) |
| **27017** | MongoDB (db) | ✗ NO | ✗ NO | Only app connects (internal) |

**Firewall Reflects This:**
- Port 80: `ALLOW` (users need it)
- Port 3000: `BLOCK` (app is internal)
- Port 27017: `BLOCK` (database is internal)

---

## Files Reference

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Orchestrates all services |
| `nginx/nginx.conf` | Reverse proxy routing rules |
| `Dockerfile` | Builds the app image |
| `.env` | Environment configuration |
| `firewall.ps1` | Sets up Windows Firewall rules |
| `NGINX_ARCHITECTURE.md` | Detailed architecture docs |
| `DEPLOYMENT.md` | This file |

---

**Last Updated**: February 27, 2026  
**Author**: GitHub Copilot  
**Environment**: Docker Compose on Windows 10/11
