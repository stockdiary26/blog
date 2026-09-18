$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskOutput = Join-Path $taskRoot ('dist\cafe24-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,6))
$taskStage = Join-Path $taskOutput 'www'
New-Item -ItemType Directory -Force $taskStage | Out-Null
Get-ChildItem -LiteralPath (Join-Path $taskRoot 'cafe24') -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $taskStage -Recurse -Force }
foreach ($taskName in @('_private\admin.json','_private\setup-key.json','_private\login-attempts.json','_private\store.lock','router.php')) {
  $taskFile=Join-Path $taskStage $taskName
  if (Test-Path -LiteralPath $taskFile) { Remove-Item -LiteralPath $taskFile -Force }
}
$taskRandom=New-Object byte[] 24
$taskRng=[Security.Cryptography.RandomNumberGenerator]::Create()
$taskRng.GetBytes($taskRandom); $taskRng.Dispose()
$taskKey=[Convert]::ToBase64String($taskRandom).TrimEnd('=').Replace('+','-').Replace('/','_')
$taskUtf8=New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $taskStage '_private\setup-key.json'),(@{key=$taskKey}|ConvertTo-Json),$taskUtf8)
[IO.File]::WriteAllText((Join-Path $taskOutput 'INITIAL-SETUP.txt'),"Initial administrator setup code: $taskKey",$taskUtf8)
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($taskStage,(Join-Path $taskOutput 'cafe24-blog.zip'))
Write-Host "Deployment ZIP and private setup code: $taskOutput"
