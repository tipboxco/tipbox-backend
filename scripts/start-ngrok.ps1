# Ngrok Başlatma Script'i
# Kullanım: .\scripts\start-ngrok.ps1

param(
    [string]$Domain = "",
    [int]$Port = 3000
)

Write-Host "`n=== NGROK BASLATILIYOR ===" -ForegroundColor Cyan

# Ngrok'un yüklü olup olmadığını kontrol et
$ngrokPath = Get-Command ngrok -ErrorAction SilentlyContinue

if (-not $ngrokPath) {
    Write-Host "❌ Ngrok bulunamadi!" -ForegroundColor Red
    Write-Host "`nKurulum:" -ForegroundColor Yellow
    Write-Host "1. https://ngrok.com/download adresinden indir" -ForegroundColor White
    Write-Host "2. ZIP'i cikar ve PATH'e ekle" -ForegroundColor White
    Write-Host "3. veya: choco install ngrok" -ForegroundColor White
    exit 1
}

Write-Host "✅ Ngrok bulundu: $($ngrokPath.Source)" -ForegroundColor Green

# Auth token kontrolü
$ngrokConfig = "$env:USERPROFILE\.ngrok2\ngrok.yml"
if (-not (Test-Path $ngrokConfig)) {
    Write-Host "⚠️  Ngrok config dosyasi bulunamadi" -ForegroundColor Yellow
    Write-Host "`nAuth token eklemek icin:" -ForegroundColor Yellow
    Write-Host "ngrok config add-authtoken YOUR_AUTH_TOKEN" -ForegroundColor Cyan
    Write-Host "`nToken'i buradan alabilirsiniz: https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor White
}

# Backend'in çalışıp çalışmadığını kontrol et
Write-Host "`nBackend kontrol ediliyor..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$Port/api" -Method GET -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✅ Backend calisiyor (Port $Port)" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend calismiyor veya erisilemiyor (Port $Port)" -ForegroundColor Red
    Write-Host "`nBackend'i baslatmak icin:" -ForegroundColor Yellow
    Write-Host "docker-compose up" -ForegroundColor Cyan
    exit 1
}

# Ngrok'u başlat
Write-Host "`nNgrok baslatiliyor..." -ForegroundColor Yellow

if ($Domain) {
    Write-Host "Domain: $Domain" -ForegroundColor Cyan
    Write-Host "Port: $Port" -ForegroundColor Cyan
    Write-Host "`nNgrok URL'i:" -ForegroundColor Yellow
    Write-Host "https://$Domain" -ForegroundColor Green
    Write-Host "`nMobil uygulamada bu URL'i kullanin!" -ForegroundColor Yellow
    Write-Host "`nNgrok web interface: http://localhost:4040" -ForegroundColor Gray
    Write-Host "`nDurdurmak icin: Ctrl+C" -ForegroundColor Gray
    Write-Host "`n" -ForegroundColor White
    
    ngrok http $Port --domain=$Domain
} else {
    Write-Host "Port: $Port" -ForegroundColor Cyan
    Write-Host "`n⚠️  Statik domain belirtilmedi, gecici URL kullanilacak" -ForegroundColor Yellow
    Write-Host "`nNgrok URL'i terminal ciktisinda gorunecek" -ForegroundColor White
    Write-Host "Ngrok web interface: http://localhost:4040" -ForegroundColor Gray
    Write-Host "`nDurdurmak icin: Ctrl+C" -ForegroundColor Gray
    Write-Host "`n" -ForegroundColor White
    
    ngrok http $Port
}

