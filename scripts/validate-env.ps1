Write-Host "=== Validating Environment Versions for Arch Smart ===" -ForegroundColor Cyan
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""


# Simplified check approach for better output readability
Write-Host "Node.js: " -NoNewline -ForegroundColor Yellow
try { node -v } catch { Write-Host "Not Found" -ForegroundColor Red }

Write-Host "Python:  " -NoNewline -ForegroundColor Yellow
try { python --version } catch { Write-Host "Not Found" -ForegroundColor Red }

Write-Host "Docker:  " -NoNewline -ForegroundColor Yellow
try { docker --version } catch { Write-Host "Not Found" -ForegroundColor Red }

Write-Host "Git:     " -NoNewline -ForegroundColor Yellow
try { git --version } catch { Write-Host "Not Found" -ForegroundColor Red }

Write-Host ""
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Validations completed." -ForegroundColor Cyan
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
