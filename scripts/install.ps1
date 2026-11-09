# Installs DOC CLI from the npm registry after checking Node.js.
$ErrorActionPreference = 'Stop'
$package = 'doc-cli-assistant'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js 22.13 or newer is required. Install it from https://nodejs.org and run this script again.'
  exit 1
}

$version = [version](node -p "process.versions.node")
if ($version -lt [version]'22.13.0') {
  Write-Host "Found Node.js $version. Version 22.13 or newer is required."
  exit 1
}

Write-Host "This will run: npm install -g $package"
$answer = Read-Host 'Continue? [y/N]'
if ($answer -notin @('y', 'Y', 'yes')) {
  Write-Host 'Cancelled. Nothing was changed.'
  exit 0
}

npm install -g $package
Write-Host 'Installed. Open a new terminal and run: doc-cli doctor'
