# ═══════════════════════════════════════════════════════════════════════════════
# EventSphere Firewall Configuration Script (Windows)
# ═══════════════════════════════════════════════════════════════════════════════
#
# This script configures Windows Firewall rules for the EventSphere containerized
# application. It ensures:
#   - Port 80 (HTTP) is open for public access via Nginx
#   - Port 3000 (Node.js backend) is blocked from external access
#   - Port 27017 (MongoDB) is blocked from external access
#
# USAGE:
#   1. Open PowerShell as Administrator
#   2. Run: Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser
#   3. Run: .\firewall.ps1
#
# ═══════════════════════════════════════════════════════════════════════════════

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "ERROR: This script must run as Administrator" -ForegroundColor Red
    Write-Host "Please open PowerShell as Administrator and try again" -ForegroundColor Yellow
    exit 1
}

Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "EventSphere Firewall Configuration" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Color definitions
$successColor = "Green"
$warningColor = "Yellow"
$errorColor = "Red"
$infoColor = "Cyan"

# ═══════════════════════════════════════════════════════════════════════════════
# RULE 1: Allow HTTP (Port 80) - INBOUND
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "[1/4] Configuring: Allow HTTP (Port 80) - Required for public access" -ForegroundColor $infoColor

$ruleName = "Allow HTTP (EventSphere)"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "  ✓ Rule already exists" -ForegroundColor $warningColor
    Write-Host "  ℹ Removing old rule and creating fresh..." -ForegroundColor $infoColor
    Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
}

try {
    New-NetFirewallRule `
        -DisplayName "Allow HTTP (EventSphere)" `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort 80 `
        -Profile Domain,Private,Public `
        -Description "Allow inbound HTTP traffic for EventSphere Nginx reverse proxy" `
        -Enabled $True `
        -ErrorAction Stop | Out-Null
    
    Write-Host "  ✓ Rule created successfully" -ForegroundColor $successColor
    Write-Host "    Port 80 (HTTP) is now open to all network adapters" -ForegroundColor Gray
    Write-Host "    Allows: External clients → Nginx reverse proxy" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed to create rule: $_" -ForegroundColor $errorColor
    exit 1
}

Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
# RULE 2: Block Node.js Backend (Port 3000) - INBOUND
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "[2/4] Configuring: Block Node.js Backend (Port 3000) - Security" -ForegroundColor $infoColor

$ruleName = "Block Node.js Backend (EventSphere)"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "  ✓ Rule already exists" -ForegroundColor $warningColor
    Write-Host "  ℹ Removing old rule and creating fresh..." -ForegroundColor $infoColor
    Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
}

try {
    New-NetFirewallRule `
        -DisplayName "Block Node.js Backend (EventSphere)" `
        -Direction Inbound `
        -Action Block `
        -Protocol TCP `
        -LocalPort 3000 `
        -Profile Domain,Private,Public `
        -Description "Block direct access to Node.js backend; traffic must route through Nginx" `
        -Enabled $True `
        -ErrorAction Stop | Out-Null
    
    Write-Host "  ✓ Rule created successfully" -ForegroundColor $successColor
    Write-Host "    Port 3000 (Node.js) is now blocked from external access" -ForegroundColor Gray
    Write-Host "    Reason: Force all traffic through Nginx proxy for security & routing" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed to create rule: $_" -ForegroundColor $errorColor
    exit 1
}

Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
# RULE 3: Block MongoDB (Port 27017) - INBOUND
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "[3/4] Configuring: Block MongoDB (Port 27017) - Security" -ForegroundColor $infoColor

$ruleName = "Block MongoDB (EventSphere)"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "  ✓ Rule already exists" -ForegroundColor $warningColor
    Write-Host "  ℹ Removing old rule and creating fresh..." -ForegroundColor $infoColor
    Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
}

try {
    New-NetFirewallRule `
        -DisplayName "Block MongoDB (EventSphere)" `
        -Direction Inbound `
        -Action Block `
        -Protocol TCP `
        -LocalPort 27017 `
        -Profile Domain,Private,Public `
        -Description "Block all direct access to MongoDB database; CRITICAL SECURITY RULE" `
        -Enabled $True `
        -ErrorAction Stop | Out-Null
    
    Write-Host "  ✓ Rule created successfully" -ForegroundColor $successColor
    Write-Host "    Port 27017 (MongoDB) is now blocked from external access" -ForegroundColor Gray
    Write-Host "    Reason: Database should NEVER be directly accessible from the internet" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed to create rule: $_" -ForegroundColor $errorColor
    exit 1
}

Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY & VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

Write-Host "[4/4] Verifying rules..." -ForegroundColor $infoColor
Write-Host ""

$rules = Get-NetFirewallRule -DisplayName "*EventSphere*" | Select-Object DisplayName, Direction, Action, Enabled

if ($rules.Count -eq 0) {
    Write-Host "  ⚠ No rules found (unexpected)" -ForegroundColor $errorColor
    exit 1
}

Write-Host "  ✓ Rules configured:" -ForegroundColor $successColor
$rules | ForEach-Object {
    Write-Host "    • $_" -ForegroundColor Gray
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

Write-Host ""
Write-Host "✓ Port 80 (HTTP):    ALLOWED  → Nginx listens here" -ForegroundColor $successColor
Write-Host "✓ Port 3000 (Node):  BLOCKED  → Forces traffic through Nginx" -ForegroundColor $successColor
Write-Host "✓ Port 27017 (DB):   BLOCKED  → Database unreachable from internet" -ForegroundColor $successColor
Write-Host ""

Write-Host "PORT EXPOSURE JUSTIFICATION:" -ForegroundColor $infoColor
Write-Host ""
Write-Host "✓ Port 80 is OPEN because:" -ForegroundColor $warningColor
Write-Host "  - Users need to access the web application" -ForegroundColor Gray
Write-Host "  - Nginx reverse proxy listens here" -ForegroundColor Gray
Write-Host "  - Only port users interact with directly" -ForegroundColor Gray
Write-Host "  - Should be upgraded to HTTPS (port 443) in production" -ForegroundColor Gray
Write-Host ""

Write-Host "✓ Port 3000 is BLOCKED because:" -ForegroundColor $successColor
Write-Host "  - Node.js backend should not be directly accessible" -ForegroundColor Gray
Write-Host "  - Nginx is the single entry point (security boundary)" -ForegroundColor Gray
Write-Host "  - Allows Nginx to apply security headers, CORS, etc." -ForegroundColor Gray
Write-Host "  - Only accessible within Docker network (app → nginx)" -ForegroundColor Gray
Write-Host ""

Write-Host "✓ Port 27017 is BLOCKED because:" -ForegroundColor $successColor
Write-Host "  - Databases must NEVER be directly accessible from the internet" -ForegroundColor Gray
Write-Host "  - Prevents data theft and injection attacks" -ForegroundColor Gray
Write-Host "  - Only Node.js backend can access it (internal Docker network)" -ForegroundColor Gray
Write-Host "  - No authentication configured for demo (internal-only is sufficient)" -ForegroundColor Gray
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "NEXT STEPS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Start the application:" -ForegroundColor $infoColor
Write-Host "   cd C:\Users\thons\Desktop\EventSphere" -ForegroundColor Gray
Write-Host "   docker-compose up --build" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Access the application:" -ForegroundColor $infoColor
Write-Host "   http://localhost/" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test CORS requests:" -ForegroundColor $infoColor
Write-Host "   Browser console: fetch('http://localhost/events').then(r => r.json())" -ForegroundColor Gray
Write-Host ""
Write-Host "4. For production, also:" -ForegroundColor $warningColor
Write-Host "   - Add HTTPS (port 443) with TLS certificate" -ForegroundColor Gray
Write-Host "   - Change CORS from '*' to specific domain" -ForegroundColor Gray
Write-Host "   - Enable MongoDB authentication" -ForegroundColor Gray
Write-Host "   - Add rate limiting to prevent DDoS" -ForegroundColor Gray
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Configuration Complete!" -ForegroundColor $successColor
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
