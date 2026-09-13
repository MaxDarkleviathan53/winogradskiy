# Скрипт синхронізації ресурсів з android/app/src/main/assets у ios/WinogradskyApp/www
$src = "$PSScriptRoot\..\android\app\src\main\assets"
$dest = "$PSScriptRoot\WinogradskyApp\www"

Write-Host "Синхронізація ресурсів з $src у $dest..."
Copy-Item -Path "$src\*" -Destination "$dest" -Recurse -Force
Write-Host "Синхронізацію успішно завершено!"
