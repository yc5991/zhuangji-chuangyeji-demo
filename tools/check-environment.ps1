[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskEnvironmentPath = Join-Path $taskProjectRoot '.local\environment.json'

# Read machine-specific paths without putting them in the shared project settings.
if (-not (Test-Path -LiteralPath $taskEnvironmentPath)) {
    throw 'Missing .local/environment.json. Copy tools/environment.example.json and fill in the installed tool paths.'
}
$taskEnvironment = Get-Content -LiteralPath $taskEnvironmentPath -Raw -Encoding UTF8 | ConvertFrom-Json
$taskChecks = @(
    [pscustomobject]@{ Tool = 'Cocos Creator'; Ready = Test-Path -LiteralPath $taskEnvironment.creatorExecutable; Path = $taskEnvironment.creatorExecutable }
    [pscustomobject]@{ Tool = 'WeChat developer tools'; Ready = Test-Path -LiteralPath $taskEnvironment.wechatExecutable; Path = $taskEnvironment.wechatExecutable }
    [pscustomobject]@{ Tool = 'WeChat command line'; Ready = Test-Path -LiteralPath $taskEnvironment.wechatCli; Path = $taskEnvironment.wechatCli }
)

# Check the command-line tools used for source control and development utilities.
foreach ($taskToolName in @('git', 'node', 'npm.cmd')) {
    $taskCommand = Get-Command $taskToolName -ErrorAction SilentlyContinue
    $taskChecks += [pscustomobject]@{ Tool = $taskToolName; Ready = [bool]$taskCommand; Path = if ($taskCommand) { $taskCommand.Source } else { $null } }
}
$taskChecks | Format-Table -AutoSize
if ($taskChecks.Ready -contains $false) {
    throw 'One or more required local tools are missing.'
}

# An installation check does not imply that account login or real-device preview has passed.
Write-Output 'Local tool paths are ready. Figma connection and WeChat device preview require separate checks.'
