#!/usr/bin/env pwsh
# ─────────────────────────────────────────────────────────────────────────
#  GhostShell — hardened Chromium launcher (Windows)
#
#  Usage (PowerShell):
#    .\GhostShell.ps1
#    .\GhostShell.ps1 -Proxy socks5://127.0.0.1:1080
#    .\GhostShell.ps1 -Timezone "Europe/Berlin" -Locale de-DE
#    .\GhostShell.ps1 -NewIdentity   # wipe the profile and rotate the relay
#    .\GhostShell.ps1 -Print      # show the command, don't launch
# ─────────────────────────────────────────────────────────────────────────
[CmdletBinding()]
param(
  [string]$Proxy      = '',
  [string]$Timezone   = '',
  [string]$Locale     = '',
  [string]$ChromePath = '',
  [string]$ProfileDir = '',
  [switch]$Print,
  [switch]$Incognito,
  [switch]$NewIdentity,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)

$ErrorActionPreference = 'Stop'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $Here
$Conf = Join-Path $Here 'ghostshell.conf'

# ── defaults ─────────────────────────────────────────────────────────────
$Cfg = @{
  CHROME_PATH             = 'auto'
  PROFILE_DIR             = (Join-Path $env:USERPROFILE '.ghostshell\profile')
  TIMEZONE                = ''
  LOCALE                  = ''
  PROXY                   = ''
  PROXY_BYPASS            = 'localhost;127.0.0.1;[::1]'
  DISABLE_QUIC            = '1'
  BLOCK_IPV6              = '1'
  DISABLE_SAFE_BROWSING   = '0'
  WINDOW_SIZE             = '1440,900'
  EXTRA_FLAGS             = ''
}

if (Test-Path $Conf) {
  foreach ($line in (Get-Content $Conf)) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#')) { continue }
    $idx = $t.IndexOf('=')
    if ($idx -lt 1) { continue }
    $k = $t.Substring(0, $idx).Trim()
    $v = $t.Substring($idx + 1)
    if ($v -match '#') { $v = ($v -split '#', 2)[0] }
    $v = $v.Trim().Trim('"')
    if ($Cfg.ContainsKey($k)) { $Cfg[$k] = $v }
  }
}

if ($Proxy)      { $Cfg.PROXY       = $Proxy }
if ($Timezone)   { $Cfg.TIMEZONE    = $Timezone }
if ($Locale)     { $Cfg.LOCALE      = $Locale }
if ($ChromePath) { $Cfg.CHROME_PATH  = $ChromePath }
if ($ProfileDir) { $Cfg.PROFILE_DIR  = $ProfileDir }

# ── locate the browser ───────────────────────────────────────────────────
function Find-Chrome {
  if ($Cfg.CHROME_PATH -ne 'auto') {
    if (Test-Path $Cfg.CHROME_PATH) { return $Cfg.CHROME_PATH }
    throw "CHROME_PATH is set but missing: $($Cfg.CHROME_PATH)"
  }
  $candidates = @(
    (Join-Path ${env:LOCALAPPDATA}  'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:PROGRAMFILES}  'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:LOCALAPPDATA}  'Chromium\Application\chrome.exe'),
    (Join-Path ${env:LOCALAPPDATA}  'BraveSoftware\Brave-Browser\Application\brave.exe'),
    (Join-Path ${env:PROGRAMFILES}  'BraveSoftware\Brave-Browser\Application\brave.exe'),
    (Join-Path ${env:PROGRAMFILES(x86)} 'Microsoft\Edge\Application\msedge.exe')
  )
  foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }

  $regKeys = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe'
  )
  foreach ($k in $regKeys) {
    try { $v = (Get-ItemProperty -Path $k -ErrorAction Stop).'(Default)'; if ($v -and (Test-Path $v)) { return $v } } catch {}
  }
  throw 'Could not find a Chromium-based browser. Set CHROME_PATH in ghostshell.conf.'
}

$Chrome = Find-Chrome

# ── profile ──────────────────────────────────────────────────────────────
$Profile = [Environment]::ExpandEnvironmentVariables($Cfg.PROFILE_DIR)
if (-not (Test-Path $Profile)) { New-Item -ItemType Directory -Path $Profile -Force | Out-Null }

# ── new identity ─────────────────────────────────────────────────────────
# Wipe the isolated profile: fresh fingerprint seed, no cookies, no history.
# A running GhostShell relay gets the same treatment — cookie jar dropped,
# proxy rotation forced — so browser + relay start from zero together.
if ($NewIdentity) {
  Get-ChildItem -Force -Path $Profile -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  $relayPort = if ($env:GHOSTSHELL_RELAY_PORT) { $env:GHOSTSHELL_RELAY_PORT } else { '8787' }
  try {
    Invoke-RestMethod -Method Post -TimeoutSec 2 `
      -Uri "http://127.0.0.1:$relayPort/api/identity" | Out-Null
    Write-Host 'ghostshell  ·  new identity: profile wiped, relay rotated'
  } catch {
    Write-Host 'ghostshell  ·  new identity: profile wiped (relay not running)'
  }
}

$FirstRun = Join-Path $Profile 'First Run'
if (-not (Test-Path $FirstRun)) { New-Item -ItemType File -Path $FirstRun -Force | Out-Null }

# ── flags ────────────────────────────────────────────────────────────────
$DisableFeatures = @(
  'OptimizationHints', 'OptimizationHintsFetching', 'OptimizationTargetPrediction',
  'OptimizationGuidePushNotification', 'MediaRouter', 'Translate',
  'AutofillServerCommunication', 'NetworkTimeServiceQuerying',
  'InterestFeedContentSuggestions', 'CalculateNativeWinOcclusion',
  'PrivacySandboxSettings4', 'FirstPartySets', 'StorageAccessAPI',
  'AsyncDns', 'DirectSockets', 'WebBluetooth', 'IdleDetection',
  'DigitalGoodsApi', 'FedCm', 'AcceptCHFrame'
) -join ','

$EnableFeatures = 'WebRtcHideLocalIpsWithMdns'

$Flags = [System.Collections.Generic.List[string]]::new()
$Flags.AddRange([string[]]@(
  "--user-data-dir=$Profile",
  '--no-first-run',
  '--no-default-browser-check',
  '--no-pings',
  '--disable-sync',
  '--disable-breakpad',
  '--disable-component-update',
  '--disable-background-networking',
  '--disable-domain-reliability',
  '--disable-client-side-phishing-detection',
  '--metrics-recording-only',
  '--disable-blink-features=AutomationControlled',
  '--exclude-switches=enable-automation',
  '--force-color-profile=srgb',
  "--window-size=$($Cfg.WINDOW_SIZE)",
  '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
  "--disable-features=$DisableFeatures",
  "--enable-features=$EnableFeatures"
))

if ($Cfg.DISABLE_QUIC -eq '1') { $Flags.Add('--disable-quic') }
if ($Cfg.BLOCK_IPV6  -eq '1') { $Flags.Add('--disable-ipv6') }
if ($Cfg.DISABLE_SAFE_BROWSING -eq '1') {
  $Flags.Add('--disable-features=SafeBrowsing')
  $Flags.Add('--safebrowsing-disable-auto-update')
}
if ($Cfg.LOCALE) { $Flags.Add("--lang=$($Cfg.LOCALE)") }
if ($Cfg.PROXY) {
  $Flags.Add("--proxy-server=$($Cfg.PROXY)")
  if ($Cfg.PROXY_BYPASS) { $Flags.Add("--proxy-bypass-list=$($Cfg.PROXY_BYPASS)") }
}
if ($Incognito) { $Flags.Add('--incognito') }
if ($Cfg.EXTRA_FLAGS) { foreach ($f in ($Cfg.EXTRA_FLAGS -split '\s+')) { if ($f) { $Flags.Add($f) } } }
if ($Rest) { foreach ($f in $Rest) { if ($f) { $Flags.Add($f) } } }

# Windows Chrome reads the OS timezone, not TZ. We set TZ anyway (harmless,
# and honoured by Chromium on some builds), but the reliable fix for JS is
# the GhostShell extension, which overrides Intl/Date directly.
if ($Cfg.TIMEZONE) { $env:TZ = $Cfg.TIMEZONE }

# ── run ──────────────────────────────────────────────────────────────────
if ($Print) {
  "TZ=$($env:TZ)"
  '"{0}" {1}' -f $Chrome, (($Flags | ForEach-Object { '"{0}"' -f $_ }) -join ' ')
  exit 0
}

Write-Host 'ghostshell' -ForegroundColor Cyan -NoNewline
Write-Host "  ·  $([System.IO.Path]::GetFileName($Chrome))"
Write-Host "  profile   $Profile"
if ($Cfg.PROXY) { Write-Host "  proxy     $($Cfg.PROXY)" } else { Write-Host '  proxy     system (VPN)' }
if ($Cfg.TIMEZONE) { Write-Host "  timezone  $($Cfg.TIMEZONE)"
  Write-Host '             (Windows Chrome reads the OS clock for non-JS surfaces; the extension handles JS)' -ForegroundColor DarkGray }
if ($Cfg.LOCALE) { Write-Host "  locale    $($Cfg.LOCALE)" }
Write-Host ''

Start-Process -FilePath $Chrome -ArgumentList $Flags
