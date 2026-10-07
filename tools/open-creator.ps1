[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot

# Open this project with its locally configured Cocos Creator installation.
$taskEnvironment = Get-Content -LiteralPath (Join-Path $taskProjectRoot '.local\environment.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not (Test-Path -LiteralPath $taskEnvironment.creatorExecutable)) { throw 'Cocos Creator executable was not found.' }
& $taskEnvironment.creatorExecutable --project $taskProjectRoot
