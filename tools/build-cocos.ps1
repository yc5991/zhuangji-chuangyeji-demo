[CmdletBinding()]
param(
    [ValidateSet('web-desktop', 'wechatgame')]
    [string]$Platform = 'web-desktop',
    [string]$AppId,
    [string]$ScenePath = 'assets/scenes/Bootstrap.scene',
    [switch]$Release
)

$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskEnvironmentPath = Join-Path $taskProjectRoot '.local\environment.json'

# Read the installed editor path and keep account-specific settings local.
if (-not (Test-Path -LiteralPath $taskEnvironmentPath)) { throw 'Missing .local/environment.json.' }
$taskEnvironment = Get-Content -LiteralPath $taskEnvironmentPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not (Test-Path -LiteralPath $taskEnvironment.creatorExecutable)) { throw 'Cocos Creator executable was not found.' }
if (-not (Test-Path -LiteralPath (Join-Path $taskProjectRoot 'package.json'))) { throw 'The Cocos project has not been initialized.' }

# WeChat builds use a supplied project AppID rather than silently adopting a demo account.
$taskBuildOptions = [ordered]@{ platform = $Platform; debug = -not $Release.IsPresent; outputName = $Platform }

# Select a real imported scene explicitly so an empty editor history cannot leave startScene undefined.
$taskSceneFile = Join-Path $taskProjectRoot $ScenePath
$taskSceneMetaFile = $taskSceneFile + '.meta'
if (-not (Test-Path -LiteralPath $taskSceneFile) -or -not (Test-Path -LiteralPath $taskSceneMetaFile)) { throw 'The selected scene or its .meta file is missing.' }
$taskSceneMeta = Get-Content -LiteralPath $taskSceneMetaFile -Raw -Encoding UTF8 | ConvertFrom-Json
$taskSceneUrl = 'db://' + $ScenePath.Replace('\', '/')
$taskBuildOptions.startScene = $taskSceneMeta.uuid
$taskBuildOptions.scenes = @(@{ uuid = $taskSceneMeta.uuid; url = $taskSceneUrl })
if ($Platform -eq 'wechatgame') {
    if (-not $AppId) { $AppId = $taskEnvironment.wechatAppId }
    if ($AppId -notmatch '^wx[0-9a-fA-F]{16}$') { throw 'Provide the game AppID with -AppId or .local/environment.json.' }
    $taskBuildOptions.packages = @{ wechatgame = @{ appid = $AppId; orientation = 'portrait' } }
}

# Use a configuration file so build options are passed intact through Windows argument parsing.
$taskBuildDirectory = Join-Path $taskProjectRoot '.local\build'
New-Item -ItemType Directory -Path $taskBuildDirectory -Force | Out-Null
$taskConfigPath = Join-Path $taskBuildDirectory ($Platform + '.json')
$taskConfigJson = $taskBuildOptions | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($taskConfigPath, $taskConfigJson, [Text.UTF8Encoding]::new($false))
$taskStdoutPath = Join-Path $taskBuildDirectory ($Platform + '.stdout.log')
$taskStderrPath = Join-Path $taskBuildDirectory ($Platform + '.stderr.log')
$taskArguments = @('--project', ('"' + $taskProjectRoot + '"'), '--build', ('"configPath=' + $taskConfigPath + '"'))
$taskProcess = Start-Process -FilePath $taskEnvironment.creatorExecutable -ArgumentList $taskArguments -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput $taskStdoutPath -RedirectStandardError $taskStderrPath

# Cocos documents exit code 36 as build success; keep the logs available on failure.
if ($taskProcess.ExitCode -ne 36) {
    throw "Cocos build returned $($taskProcess.ExitCode). Inspect $taskStdoutPath and $taskStderrPath."
}
Write-Output "Build complete: $(Join-Path $taskProjectRoot ('build\' + $Platform))"
