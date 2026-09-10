# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Voxr self-hosting installer and upgrader for Windows.
#
# Three modes, one file:
#
#   default    Check the host, download the stack files, write .env with every value the stack
#              requires, start the containers.
#   -Update    Upgrade an instance that already exists. Record the running images, back up,
#              refresh the stack files, pull, recreate, verify.
#   -Rollback  Put the images and the stack files of the last recorded upgrade back.
#
# Why one script and not a separate upgrader: an upgrade needs the host checks, the stack
# download, the readiness poll and the health probe that the install already carries. A second
# script either copies them or drifts from them, and the operator has two downloads and two
# checksums to verify instead of one.
#
# This file is also the procedure. Every step of the upgrade carries the command an operator
# types to do that step by hand, and the reason the step exists.
#
# Read this file before running it. The default mode writes .env, which holds every secret the
# instance has. The upgrade generates a secret only for a key the refreshed stack requires that
# .env does not hold, and rewrites no secret. The only value either
# upgrade mode ever replaces in .env is VOXR_IMAGE_TAG, and only during a rollback that moves
# off a pinned tag.
#
# Rewriting a secret in .env against volumes that already exist is the one thing this script
# could do that an operator cannot undo. A fresh POSTGRES_PASSWORD does not open the existing
# postgres-data volume, and the instance never starts again.
#
# Source:   https://voxr.dev/install.ps1
# Checksum: https://voxr.dev/install.ps1.sha256
#
# Every file this script writes uses LF line endings. Docker Compose keeps a trailing carriage
# return as part of a value, so a CRLF .env produces secrets that do not match the ones the
# containers were given.

[CmdletBinding()]
param(
	[string]$Domain = '',
	[string]$Email = '',
	[string]$Dir = '',
	[string]$Engine = '',
	[string]$Ref = '',
	[string]$ImageTag = 'v1',
	[string]$Tls = 'bundled',
	[string]$EdgeBind = '127.0.0.1:8080',
	[string]$BackupDir = '',
	[switch]$NonInteractive,
	[switch]$DryRun,
	[switch]$NoStart,
	[switch]$Update,
	[switch]$Rollback,
	[switch]$NoVolumeBackup,
	[switch]$SkipBackupAcceptDataLoss,
	[switch]$Help,
	[Parameter(ValueFromRemainingArguments = $true)]
	[string[]]$Rest = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$VoxrRawBase = 'https://raw.githubusercontent.com/voxrapp/voxr'
$VoxrStackPath = 'deploy/self-hosting'
$VoxrHealthPath = '/_health'
$VoxrInitService = 'seaweedfs-init'
$VoxrMinimumPodmanVersion = '5.0.0'
$VoxrMinimumEngineVersion = '24.0.0'
$VoxrMinimumComposeVersion = '2.20.2'
$VoxrReadyTimeoutSeconds = 600
$VoxrReadyIntervalSeconds = 5
$VoxrReadyReportSeconds = 30
$VoxrVapidAttempts = 8

# The image that copies volumes and measures them. Pinned, because an upgrade that reaches for a
# moving tag to take its backup has one more thing that can change under it.
$VoxrHelperImage = 'alpine:3.22'

# Names inside a record directory. A record is one upgrade: what was running, what the stack files
# said, and the backup taken before the images moved. install.sh writes the same names, so either
# script reads a record the other one wrote.
$VoxrRecordPrefix = 'record-'
$VoxrImagesFile = 'images'
$VoxrTagFile = 'image-tag'
$VoxrDumpFile = 'voxr.dump'

# Free space demanded before a volume copy, as a percentage of the measured volume size. The
# tarball compresses, so this is generous on purpose. A backup that fills the disk it writes to
# takes the instance down with it.
$VoxrVolumeHeadroomPercent = 110

$VoxrExitUsage = 1
$VoxrExitPrerequisite = 2
$VoxrExitRefused = 3
$VoxrExitDownload = 4
$VoxrExitSecret = 5
$VoxrExitUnhealthy = 6
$VoxrExitBackup = 7
$VoxrExitInterrupted = 130

$VoxrStackFiles = @(
	'docker-compose.yml'
	'docker-compose.proxy.yml'
	'tunnel.compose.yml'
	'Caddyfile'
	'.env.example'
)

# The file Compose bind-mounts from the working directory, with the service that mounts it.
# Compose decides whether to recreate a container by comparing its configuration, and the
# contents of a bind-mounted file are not part of that comparison, so a changed Caddyfile survives
# docker compose up -d with the old bytes still loaded in the running container.
#
# By hand, after a refresh that changed the file:
#   docker compose restart edge
$VoxrMountedFiles = @(
	@{Name = 'Caddyfile'; Service = 'edge'}
)

# The volumes an upgrade copies, and the reason the rest are absent.
#
# postgres-data is not here because the dump supersedes it. A custom-format dump restores into the
# major version that wrote it or a newer one, a tarball of the data directory restores only into
# the major that wrote it, and taking both doubles the downtime and the disk for a strictly weaker
# artifact.
#
# valkey-data and nats-data hold queued work, not records. Losing them drops scheduled bulk
# deletions and background jobs, which is degradation rather than loss, and the upgrade never
# removes a volume.
#
# meilisearch-data rebuilds on the next API start, edge-data is one certificate request,
# edge-config is rewritten by Caddy on every start.
#
# seaweedfs-data is the one that matters. It holds every upload, avatar, report and harvest, and
# nothing else in the stack can recreate any of it.
$VoxrBackupVolumes = @(
	'seaweedfs-data'
)

# The keys a refreshed stack requires that an .env written by an older installer does not hold.
# Only keys with no state anywhere else are here. A value like POSTGRES_PASSWORD is matched by a
# password stored inside the database, so minting a new one locks the stack out of its own data
# and it is not listed. CHANGE_ME counts as absent.
$VoxrUpgradeSecretKeys = @(
	@{Name = 'VOXR_ERLANG_COOKIE'; Kind = 'hex'}
	@{Name = 'VOXR_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64'; Kind = 'base64'}
)

$VoxrSecretKeys = @(
	@{Name = 'POSTGRES_PASSWORD'; Kind = 'hex'}
	@{Name = 'MEILI_MASTER_KEY'; Kind = 'hex'}
	@{Name = 'VOXR_S3_SECRET_KEY'; Kind = 'hex'}
	@{Name = 'VOXR_SUDO_MODE_SECRET'; Kind = 'hex'}
	@{Name = 'VOXR_CONNECTION_INITIATION_SECRET'; Kind = 'hex'}
	@{Name = 'VOXR_GATEWAY_RPC_AUTH_TOKEN'; Kind = 'hex'}
	@{Name = 'VOXR_ERLANG_COOKIE'; Kind = 'hex'}
	@{Name = 'VOXR_MEDIA_PROXY_SECRET_KEY'; Kind = 'hex'}
	@{Name = 'VOXR_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64'; Kind = 'base64'}
	@{Name = 'VOXR_ADMIN_SECRET_KEY_BASE'; Kind = 'hex'}
	@{Name = 'VOXR_ADMIN_OAUTH_CLIENT_SECRET'; Kind = 'hex'}
	@{Name = 'LIVEKIT_API_SECRET'; Kind = 'hex'}
	@{Name = 'VOXR_VAPID_PUBLIC_KEY'; Kind = 'vapid_public'}
	@{Name = 'VOXR_VAPID_PRIVATE_KEY'; Kind = 'vapid_private'}
)

$VoxrNonSecretKeys = @(
	@{Name = 'VOXR_DOMAIN'; Kind = 'domain'; Value = ''}
	@{Name = 'VOXR_PUBLIC_SCHEME'; Kind = 'literal'; Value = 'https'}
	@{Name = 'VOXR_PUBLIC_PORT'; Kind = 'literal'; Value = '443'}
	@{Name = 'VOXR_VAPID_EMAIL'; Kind = 'email'; Value = ''}
	@{Name = 'VOXR_IMAGE_TAG'; Kind = 'image_tag'; Value = ''}
	@{Name = 'VOXR_S3_ACCESS_KEY'; Kind = 'literal'; Value = 'voxr'}
	@{Name = 'LIVEKIT_API_KEY'; Kind = 'literal'; Value = 'voxr'}
)

function Write-VoxrLine([string]$Message) {
	Write-Host $Message
}

function Write-VoxrProblem([string]$Message) {
	[Console]::Error.WriteLine($Message)
}

function Stop-Voxr([string]$Message, [int]$Code) {
	Write-VoxrProblem $Message
	exit $Code
}

function Show-VoxrUsage {
	Write-VoxrLine 'Usage: install.ps1 -Domain <host> -Email <address> [options]'
	Write-VoxrLine '       install.ps1 -Update [options]'
	Write-VoxrLine '       install.ps1 -Rollback [options]'
	Write-VoxrLine ''
	Write-VoxrLine 'Options:'
	Write-VoxrLine '  -Domain <host>          Hostname the instance answers on. Prompted when absent.'
	Write-VoxrLine '  -Email <address>        Address written as VOXR_VAPID_EMAIL. Prompted when absent.'
	Write-VoxrLine '  -Engine <command>       Container engine to drive. Default: docker, or podman when'
	Write-VoxrLine '                          docker is absent.'
	Write-VoxrLine '  -Dir <path>             Working directory. Default: the voxr folder in the home'
	Write-VoxrLine '                          directory, or the working directory itself when -Update or'
	Write-VoxrLine '                          -Rollback is given and it holds an instance.'
	Write-VoxrLine '  -Ref <git ref>          Ref the stack files come from. Default: the image tag, and main when that tag is v1 or latest.'
	Write-VoxrLine '  -ImageTag <tag>         Value written as VOXR_IMAGE_TAG. Default: v1.'
	Write-VoxrLine '  -Tls <bundled|proxy>    Certificate mode. Default: bundled.'
	Write-VoxrLine '  -EdgeBind <addr:port>   Plain HTTP bind under -Tls proxy. Default: 127.0.0.1:8080.'
	Write-VoxrLine '  -NonInteractive         Never prompt. A missing required value exits 1.'
	Write-VoxrLine '  -DryRun                 Print the plan. Change nothing.'
	Write-VoxrLine '  -NoStart                Write everything. Skip docker compose up -d.'
	Write-VoxrLine '  -Update                 Upgrade: record, back up, refresh, pull, recreate, verify.'
	Write-VoxrLine '  -Rollback               Restore the images and stack files of the last record.'
	Write-VoxrLine '  -BackupDir <path>       Where records go. Default: the backups folder under -Dir.'
	Write-VoxrLine '  -NoVolumeBackup         Take the database dump and skip the uploads copy.'
	Write-VoxrLine '  -SkipBackupAcceptDataLoss'
	Write-VoxrLine '                          Upgrade with no backup at all. Losable data is lost.'
	Write-VoxrLine '  -Help                   Print this text.'
	Write-VoxrLine ''
	Write-VoxrLine 'Exit codes: 0 success, 1 usage, 2 prerequisite, 3 refused, 4 download, 5 secret,'
	Write-VoxrLine '6 unhealthy, 7 backup.'
}

function Test-VoxrWindowsHost {
	if ($PSVersionTable.PSVersion.Major -lt 6) {
		return $true
	}
	return $IsWindows
}

function ConvertTo-VoxrVersion([string]$Text) {
	$match = [regex]::Match($Text, '(\d+)\.(\d+)(?:\.(\d+))?')
	if (-not $match.Success) {
		return $null
	}
	$patch = 0
	if ($match.Groups[3].Success) {
		$patch = [int]$match.Groups[3].Value
	}
	return @([int]$match.Groups[1].Value, [int]$match.Groups[2].Value, $patch)
}

function Test-VoxrVersionAtLeast([string]$Found, [string]$Minimum) {
	$left = ConvertTo-VoxrVersion $Found
	$right = ConvertTo-VoxrVersion $Minimum
	if ($null -eq $left) {
		return $false
	}
	for ($index = 0; $index -lt 3; $index++) {
		if ($left[$index] -gt $right[$index]) {
			return $true
		}
		if ($left[$index] -lt $right[$index]) {
			return $false
		}
	}
	return $true
}

# docker writes the reason a command failed to stderr and nothing else ever repeats it, so stderr
# is kept rather than discarded. The two streams stay apart because every caller reads Text as
# data, and one warning line on stderr would be one more line of JSON, one more image reference or
# one more container ID.
$script:VoxrEngine = 'docker'
$script:VoxrEngineLabel = 'Docker Engine'

function Invoke-VoxrCapture([string[]]$CommandArgs) {
	$previous = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	$out = @()
	$err = @()
	$code = 0
	try {
		$output = & $script:VoxrEngine @CommandArgs 2>&1
		$code = $LASTEXITCODE
		foreach ($item in @($output)) {
			if ($item -is [System.Management.Automation.ErrorRecord]) {
				$err += [string]$item
			} else {
				$out += [string]$item
			}
		}
	} finally {
		$ErrorActionPreference = $previous
	}
	return @{Code = $code; Text = (($out -join "`n").Trim()); Error = (($err -join "`n").Trim())}
}

function Invoke-VoxrDocker([string[]]$CommandArgs) {
	$previous = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	$code = 0
	try {
		& $script:VoxrEngine @CommandArgs
		$code = $LASTEXITCODE
	} finally {
		$ErrorActionPreference = $previous
	}
	return $code
}

# pg_dump writes a binary stream. PowerShell redirection decodes that stream as text and corrupts
# it, so the bytes go to the file through the process itself.
function Invoke-VoxrDockerToFile([string[]]$CommandArgs, [string]$OutFile, [string]$WorkingDir) {
	$errorFile = "$OutFile.stderr"
	$process = Start-Process -FilePath $script:VoxrEngine -ArgumentList $CommandArgs -RedirectStandardOutput $OutFile -RedirectStandardError $errorFile -WorkingDirectory $WorkingDir -NoNewWindow -Wait -PassThru
	$code = $process.ExitCode
	if (Test-Path -LiteralPath $errorFile) {
		Remove-Item -LiteralPath $errorFile -Force
	}
	return $code
}

function Test-VoxrWsl2 {
	$command = Get-Command wsl.exe -ErrorAction SilentlyContinue
	if ($null -eq $command) {
		return $false
	}
	$previous = $ErrorActionPreference
	$ErrorActionPreference = 'Continue'
	$code = 1
	try {
		& wsl.exe --status 2>&1 | Out-Null
		$code = $LASTEXITCODE
	} finally {
		$ErrorActionPreference = $previous
	}
	return ($code -eq 0)
}

function Invoke-VoxrPreflight {
	if ($PSVersionTable.PSVersion.Major -lt 5) {
		Stop-Voxr 'This installer needs Windows PowerShell 5.1 or PowerShell 7 or newer.' $VoxrExitPrerequisite
	}
	if (-not (Test-VoxrWindowsHost)) {
		Stop-Voxr 'This installer runs on Windows. On Linux and macOS run install.sh instead.' $VoxrExitPrerequisite
	}
	if ($PSVersionTable.PSVersion.Major -lt 6) {
		[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
	}
	if ($Engine.Length -gt 0) {
		$script:VoxrEngine = $Engine
	} elseif ($null -ne (Get-Command docker -ErrorAction SilentlyContinue)) {
		$script:VoxrEngine = 'docker'
	} elseif ($null -ne (Get-Command podman -ErrorAction SilentlyContinue)) {
		$script:VoxrEngine = 'podman'
	} else {
		Stop-Voxr 'Neither docker nor podman is on PATH. Install Docker Desktop with the WSL2 backend, or pass -Engine with the command that drives your containers.' $VoxrExitPrerequisite
	}
	if ($null -eq (Get-Command $script:VoxrEngine -ErrorAction SilentlyContinue)) {
		Stop-Voxr "$($script:VoxrEngine) is not on PATH. Pass -Engine with the command that drives your containers." $VoxrExitPrerequisite
	}
	# Every engine that speaks the Docker CLI reports itself as "<name> version X",
	# and Podman's 5.x is not Docker's 5.x, so the floor has to belong to whichever
	# one answered.
	$reported = Invoke-VoxrCapture @('--version')
	$minimumEngine = $VoxrMinimumEngineVersion
	if ($reported.Code -eq 0 -and $reported.Text -match '^\s*podman\s+version') {
		$script:VoxrEngineLabel = 'Podman'
		$minimumEngine = $VoxrMinimumPodmanVersion
	}
	$engine = Invoke-VoxrCapture @('version', '--format', '{{.Server.Version}}')
	if ($engine.Code -ne 0) {
		Stop-Voxr "$($script:VoxrEngine) does not answer. Start it and run this script again." $VoxrExitPrerequisite
	}
	$compose = Invoke-VoxrCapture @('compose', 'version', '--short')
	if ($compose.Code -ne 0) {
		Stop-Voxr 'The Docker Compose v2 plugin is missing. Docker Desktop ships it.' $VoxrExitPrerequisite
	}
	if (-not (Test-VoxrVersionAtLeast $engine.Text $minimumEngine)) {
		Stop-Voxr "$($script:VoxrEngineLabel) $($engine.Text) is older than $minimumEngine. Compose is $($compose.Text)." $VoxrExitPrerequisite
	}
	if (-not (Test-VoxrVersionAtLeast $compose.Text $VoxrMinimumComposeVersion)) {
		Stop-Voxr "Compose $($compose.Text) is older than $VoxrMinimumComposeVersion. $($script:VoxrEngineLabel) is $($engine.Text)." $VoxrExitPrerequisite
	}
	$osType = Invoke-VoxrCapture @('info', '--format', '{{.OSType}}')
	if ($osType.Code -ne 0) {
		Stop-Voxr 'The Docker daemon does not report its container platform.' $VoxrExitPrerequisite
	}
	if ($osType.Text -ne 'linux') {
		Stop-Voxr "Docker runs $($osType.Text) containers. Switch Docker Desktop to Linux containers." $VoxrExitPrerequisite
	}
	Write-VoxrLine "$($script:VoxrEngineLabel) $($engine.Text) and Compose $($compose.Text) are ready."
	if (-not (Test-VoxrWsl2)) {
		Write-VoxrLine 'WSL 2 is not present. Docker Desktop with the WSL2 backend is the supported Windows setup.'
	}
}

function Assert-VoxrDomain([string]$Value) {
	if ($Value -cmatch '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$') {
		return
	}
	Stop-Voxr "-Domain must be a lowercase hostname such as chat.example.com. Got: $Value" $VoxrExitUsage
}

function Assert-VoxrEmail([string]$Value) {
	if ($Value -match '^[^@\s]+@[^@\s]+$') {
		return
	}
	Stop-Voxr "-Email must be one address such as you@example.com. Got: $Value" $VoxrExitUsage
}

function Get-VoxrRefForTag([string]$Tag) {
	if ($Tag -eq 'v1' -or $Tag -eq 'latest') {
		return 'main'
	}
	return $Tag
}

# The images come from VOXR_IMAGE_TAG and the stack files come from a git ref. A release tags its
# images and its commit with the same CalVer string, so a pinned tag names the commit that carries
# its compose files. The moving tags v1 and latest track main.
function Assert-VoxrDerivedRef([string]$Value, [string]$EnvPath) {
	if ($Value.Length -eq 0) {
		Stop-Voxr "$EnvPath declares no VOXR_IMAGE_TAG, so no ref can be derived. Pass -Ref." $VoxrExitRefused
	}
	if ($Value -match '\s' -or $Value -match '(^|/)\.\.(/|$)') {
		Stop-Voxr "VOXR_IMAGE_TAG is $Value, which is not a git ref. Pass -Ref." $VoxrExitRefused
	}
}

function Assert-VoxrRef([string]$Value) {
	if ($Value.Length -eq 0) {
		return
	}
	if ($Value -match '\s') {
		Stop-Voxr '-Ref must not contain whitespace.' $VoxrExitUsage
	}
	if ($Value -match '(^|/)\.\.(/|$)') {
		Stop-Voxr '-Ref must not contain a parent segment.' $VoxrExitUsage
	}
}

function Assert-VoxrEdgeBind([string]$Value) {
	if ($Value -match '^\S+:\d{1,5}$') {
		return
	}
	Stop-Voxr "-EdgeBind must be an address and port such as 127.0.0.1:8080. Got: $Value" $VoxrExitUsage
}

function Read-VoxrValue([string]$Prompt) {
	for ($attempt = 0; $attempt -lt 3; $attempt++) {
		$answer = Read-Host -Prompt $Prompt
		if ($null -ne $answer) {
			$answer = $answer.Trim()
			if ($answer.Length -gt 0) {
				return $answer
			}
		}
	}
	Stop-Voxr 'Three empty answers. Nothing was written.' $VoxrExitUsage
}

function Resolve-VoxrValue([string]$Value, [string]$Prompt, [string]$Flag, [bool]$AllowPrompt) {
	if ($Value.Length -gt 0) {
		return $Value
	}
	if (-not $AllowPrompt) {
		Stop-Voxr "$Flag is required." $VoxrExitUsage
	}
	return Read-VoxrValue $Prompt
}

function New-VoxrRandomBytes([int]$Count) {
	$bytes = New-Object byte[] $Count
	$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
	try {
		$generator.GetBytes($bytes)
	} finally {
		$generator.Dispose()
	}
	return ,$bytes
}

function ConvertTo-VoxrHex([byte[]]$Bytes) {
	return [System.BitConverter]::ToString($Bytes).Replace('-', '').ToLowerInvariant()
}

function ConvertTo-VoxrBase64Url([byte[]]$Bytes) {
	$text = [System.Convert]::ToBase64String($Bytes)
	return $text.TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

# The VAPID pair is the one secret in .env that no random draw produces.
# VOXR_VAPID_PUBLIC_KEY is base64url of the 65-byte uncompressed P-256 point and
# VOXR_VAPID_PRIVATE_KEY is base64url of its 32-byte scalar. The stack requires both even when
# nobody enables browser notifications. The private key is 43 characters and the public key is 87.
#
# By hand on a host with openssl:
#   openssl ecparam -name prime256v1 -genkey -noout -out vapid.pem
#   openssl ec -in vapid.pem -outform DER | od -An -tx1 -N7 | tr -d ' \n'
#   The line above must print 30770201010420. Any other value means a short
#   scalar, so delete vapid.pem and draw again before going on.
#   openssl ec -in vapid.pem -outform DER | tail -c +8 | head -c 32 | openssl base64 -A | tr '+/' '-_' | tr -d '='
#   openssl ec -in vapid.pem -pubout -outform DER | tail -c 65 | openssl base64 -A | tr '+/' '-_' | tr -d '='
function New-VoxrVapidPair {
	for ($attempt = 0; $attempt -lt $VoxrVapidAttempts; $attempt++) {
		$key = $null
		$parameters = $null
		try {
			$curve = [System.Security.Cryptography.ECCurve]::CreateFromFriendlyName('nistP256')
			$key = [System.Security.Cryptography.ECDsa]::Create($curve)
			$parameters = $key.ExportParameters($true)
		} catch {
			Stop-Voxr 'The .NET P-256 provider is unavailable. Install .NET Framework 4.7.2 or newer, or run this script under PowerShell 7.' $VoxrExitSecret
		} finally {
			if ($null -ne $key) {
				$key.Dispose()
			}
		}
		if ($parameters.D.Length -ne 32) {
			continue
		}
		if ($parameters.Q.X.Length -ne 32) {
			continue
		}
		if ($parameters.Q.Y.Length -ne 32) {
			continue
		}
		$point = New-Object byte[] 65
		$point[0] = 4
		[System.Array]::Copy($parameters.Q.X, 0, $point, 1, 32)
		[System.Array]::Copy($parameters.Q.Y, 0, $point, 33, 32)
		$public = ConvertTo-VoxrBase64Url $point
		$private = ConvertTo-VoxrBase64Url $parameters.D
		if ($public.Length -ne 87) {
			continue
		}
		if ($private.Length -ne 43) {
			continue
		}
		return @{Public = $public; Private = $private}
	}
	Stop-Voxr "The P-256 provider returned $VoxrVapidAttempts keys of the wrong size. Nothing was written." $VoxrExitSecret
}

function ConvertTo-VoxrLfFile([string]$Path) {
	$bytes = [System.IO.File]::ReadAllBytes($Path)
	$output = New-Object System.Collections.Generic.List[byte]
	for ($index = 0; $index -lt $bytes.Length; $index++) {
		if ($bytes[$index] -eq 13) {
			if (($index + 1) -lt $bytes.Length) {
				if ($bytes[$index + 1] -eq 10) {
					continue
				}
			}
		}
		$output.Add($bytes[$index])
	}
	if ($output.Count -eq $bytes.Length) {
		return
	}
	[System.IO.File]::WriteAllBytes($Path, $output.ToArray())
}

function Set-VoxrPrivateFile([string]$Path) {
	$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
	$acl = Get-Acl -Path $Path
	$acl.SetAccessRuleProtection($true, $false)
	foreach ($rule in @($acl.Access)) {
		[void]$acl.RemoveAccessRule($rule)
	}
	$owner = New-Object System.Security.AccessControl.FileSystemAccessRule($identity.User, 'FullControl', 'Allow')
	$acl.AddAccessRule($owner)
	Set-Acl -Path $Path -AclObject $acl
}

# A record holds a copy of .env, so the directory itself is closed to everyone but the account
# that took it.
function Set-VoxrPrivateDirectory([string]$Path) {
	$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
	$acl = Get-Acl -Path $Path
	$acl.SetAccessRuleProtection($true, $false)
	foreach ($rule in @($acl.Access)) {
		[void]$acl.RemoveAccessRule($rule)
	}
	$owner = New-Object System.Security.AccessControl.FileSystemAccessRule($identity.User, 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow')
	$acl.AddAccessRule($owner)
	Set-Acl -Path $Path -AclObject $acl
}

function Remove-VoxrTemporary([string]$Path) {
	if (Test-Path -LiteralPath $Path) {
		Remove-Item -LiteralPath $Path -Force
	}
}

function New-VoxrStagingDirectory([string]$Parent) {
	$staging = Join-Path $Parent ".voxr-install.$PID"
	if (Test-Path -LiteralPath $staging) {
		Remove-Item -LiteralPath $staging -Recurse -Force
	}
	New-Item -ItemType Directory -Path $staging -Force | Out-Null
	return $staging
}

function Remove-VoxrStagingDirectory([string]$Path) {
	if ($Path.Length -gt 0 -and (Test-Path -LiteralPath $Path)) {
		Remove-Item -LiteralPath $Path -Recurse -Force
	}
}

# By hand, for one file:
#   Invoke-WebRequest -Uri https://raw.githubusercontent.com/voxrapp/voxr/main/deploy/self-hosting/docker-compose.yml -OutFile docker-compose.yml
#
# The files come from a git ref and the images come from VOXR_IMAGE_TAG. The ref is derived from
# the tag unless -Ref names one, which is the pairing rule that stops a compose file from asking for
# a variable the running images do not read.
#
# Everything lands in a staging directory first, so a failed download leaves the working directory
# on the set it already had, and so the upgrade can compare old against new before replacing.
function Get-VoxrStackFiles([string]$StagingDir, [string]$RefValue) {
	$base = "$VoxrRawBase/$RefValue/$VoxrStackPath"
	foreach ($name in $VoxrStackFiles) {
		$destination = Join-Path $StagingDir $name
		try {
			Invoke-WebRequest -Uri "$base/$name" -OutFile $destination -UseBasicParsing -MaximumRedirection 5 -TimeoutSec 120
		} catch {
			Stop-Voxr "Download failed: $base/$name. Pass -Ref to name the ref the stack files come from." $VoxrExitDownload
		}
		if ((Get-Item -LiteralPath $destination).Length -eq 0) {
			Stop-Voxr "Download returned an empty file: $name" $VoxrExitDownload
		}
		ConvertTo-VoxrLfFile $destination
		if ($name -eq 'docker-compose.yml') {
			$content = [System.IO.File]::ReadAllText($destination)
			if ($content -notmatch '(?m)^services:') {
				Stop-Voxr "docker-compose.yml from $RefValue holds no services block." $VoxrExitDownload
			}
		}
		Write-VoxrLine "Downloaded $name"
	}
}

# None of these files is part of an image, and all four are read from the working directory, so
# docker compose pull never updates any of them. That is why an upgrade refreshes them itself.
#
# A refreshed docker-compose.yml can declare a variable the running .env does not carry. Compose
# writes ${NAME:?message} for a variable the stack requires and stops with that message until .env
# sets it, and ${NAME:-default} for one that needs nothing from the operator. Every optional
# override ships commented out in .env.example, so a new required key is the only kind that asks
# for an edit.
function Move-VoxrStackFiles([string]$StagingDir, [string]$TargetDir) {
	foreach ($name in $VoxrStackFiles) {
		Move-Item -LiteralPath (Join-Path $StagingDir $name) -Destination (Join-Path $TargetDir $name) -Force
	}
}

# The same file by hand, which is what the caller of this function does in one pass:
#
#   Copy-Item .env.example .env
#
# Close .env to every account but your own, then set VOXR_DOMAIN and VOXR_VAPID_EMAIL, the two
# values only the operator knows. The five other non-secret keys in the list above ship correct in
# .env.example and need no edit.
#
# Every secret in .env.example carries the literal CHANGE_ME. A key whose name ends in _BASE64
# takes 32 random bytes as base64, every other key takes 32 random bytes as hex, and the VAPID pair
# comes from the generator above.
#
# Under -Tls proxy, COMPOSE_FILE and VOXR_EDGE_BIND already sit in .env.example as commented
# lines, so by hand they are uncommented rather than added.
function Write-VoxrEnvFile([string]$Path, [string[]]$Lines) {
	$temporary = "$Path.new"
	Remove-VoxrTemporary $temporary
	$encoding = New-Object System.Text.UTF8Encoding($false)
	[System.IO.File]::WriteAllText($temporary, '', $encoding)
	Set-VoxrPrivateFile $temporary
	$text = ($Lines -join "`n") + "`n"
	[System.IO.File]::WriteAllText($temporary, $text, $encoding)
	Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Get-VoxrEnvLines([string]$EnvPath) {
	$text = [System.IO.File]::ReadAllText($EnvPath)
	return $text.Replace("`r`n", "`n").TrimEnd("`n").Split("`n")
}

function Get-VoxrEnvValue([string]$EnvPath, [string]$Name) {
	foreach ($line in Get-VoxrEnvLines $EnvPath) {
		if ($line.StartsWith("$Name=")) {
			return $line.Substring($Name.Length + 1)
		}
	}
	return ''
}

function Get-VoxrProperty($Row, [string]$Name) {
	$property = $Row.PSObject.Properties[$Name]
	if ($null -eq $property) {
		return ''
	}
	if ($null -eq $property.Value) {
		return ''
	}
	return [string]$property.Value
}

function Get-VoxrComposeRows {
	$result = Invoke-VoxrCapture @('compose', 'ps', '--all', '--format', 'json')
	if ($result.Code -ne 0) {
		return @()
	}
	$text = $result.Text
	if ($text.Length -eq 0) {
		return @()
	}
	$rows = @()
	if ($text.StartsWith('[')) {
		$rows = @($text | ConvertFrom-Json)
		return $rows
	}
	foreach ($line in $text.Split("`n")) {
		$candidate = $line.Trim()
		if ($candidate.Length -eq 0) {
			continue
		}
		$rows += ($candidate | ConvertFrom-Json)
	}
	return $rows
}

function Measure-VoxrReadyRows($Rows) {
	$ready = 0
	foreach ($row in $Rows) {
		$service = Get-VoxrProperty $row 'Service'
		$state = Get-VoxrProperty $row 'State'
		$health = Get-VoxrProperty $row 'Health'
		if ($service -eq $VoxrInitService) {
			if ($state -eq 'exited') {
				if ((Get-VoxrProperty $row 'ExitCode') -eq '0') {
					$ready++
				}
			}
			continue
		}
		if ($state -ne 'running') {
			continue
		}
		if ($health.Length -gt 0) {
			if ($health -ne 'healthy') {
				continue
			}
		}
		$ready++
	}
	return $ready
}

# Readiness comes from Compose state, which is local and authoritative.
#
# By hand:
#   docker compose ps
#
# Every service reads running or healthy except seaweedfs-init, which reads exited (0) because it
# is a one-shot bucket initialiser.
function Wait-VoxrStack([string]$Lead) {
	Write-VoxrLine $Lead
	$deadline = (Get-Date).AddSeconds($VoxrReadyTimeoutSeconds)
	$reportAt = (Get-Date).AddSeconds($VoxrReadyReportSeconds)
	while ((Get-Date) -lt $deadline) {
		$rows = @(Get-VoxrComposeRows)
		if ($rows.Count -gt 0) {
			$ready = Measure-VoxrReadyRows $rows
			if ($ready -eq $rows.Count) {
				Write-VoxrLine "All $($rows.Count) services report healthy."
				return
			}
			if ((Get-Date) -ge $reportAt) {
				Write-VoxrLine "$ready of $($rows.Count) services are ready."
				$reportAt = (Get-Date).AddSeconds($VoxrReadyReportSeconds)
			}
		}
		Start-Sleep -Seconds $VoxrReadyIntervalSeconds
	}
	Stop-Voxr "The stack did not report healthy within $VoxrReadyTimeoutSeconds seconds. Read docker compose ps and docker compose logs." $VoxrExitUnhealthy
}

# The origin browsers use. .env states it outright when VOXR_PUBLIC_ORIGIN is set, and Compose
# otherwise builds the same string from the scheme, the domain and the port, dropping a port that
# is the default for its scheme.
#
# Compose expands a ${...} reference inside an .env value and this script does not, so a
# VOXR_PUBLIC_ORIGIN written that way is skipped rather than printed back with the braces still
# in it. The three names below say the same address, so the derived string is the right one to
# fall back to.
#
# By hand:
#   Select-String -Path .env -Pattern '^VOXR_(PUBLIC_ORIGIN|PUBLIC_SCHEME|DOMAIN|PUBLIC_PORT)='
function Get-VoxrPublicOrigin([string]$EnvPath) {
	$origin = Get-VoxrEnvValue $EnvPath 'VOXR_PUBLIC_ORIGIN'
	if ($origin.Contains('${')) {
		Write-VoxrProblem 'VOXR_PUBLIC_ORIGIN in .env holds a ${...} reference. This script does not expand those, so the address below comes from VOXR_PUBLIC_SCHEME, VOXR_DOMAIN and VOXR_PUBLIC_PORT instead.'
		$origin = ''
	}
	if ($origin.Length -gt 0) {
		return $origin.TrimEnd('/')
	}
	$originHost = Get-VoxrEnvValue $EnvPath 'VOXR_DOMAIN'
	if ($originHost.Length -eq 0) {
		return ''
	}
	$scheme = Get-VoxrEnvValue $EnvPath 'VOXR_PUBLIC_SCHEME'
	if ($scheme.Length -eq 0) {
		$scheme = 'https'
	}
	$port = Get-VoxrEnvValue $EnvPath 'VOXR_PUBLIC_PORT'
	$suffix = ''
	if ($port.Length -gt 0 -and -not (($scheme -eq 'http' -and $port -eq '80') -or ($scheme -eq 'https' -and $port -eq '443'))) {
		$suffix = ":$port"
	}
	return "${scheme}://${originHost}${suffix}"
}

# The public probe is informational. A host behind hairpin NAT cannot always reach its own
# hostname, and a false failure there would be worse than no probe. It asks the origin .env
# advertises, so an instance on a non-default port is probed where it actually answers.
function Test-VoxrPublicHealth([string]$Origin) {
	$url = "$Origin$VoxrHealthPath"
	$authority = $Origin
	$separator = $Origin.IndexOf('://')
	if ($separator -ge 0) {
		$authority = $Origin.Substring($separator + 3)
	}
	$probeHost = $authority
	$probePort = if ($Origin.StartsWith('http://')) { '80' } else { '443' }
	$colon = $authority.IndexOf(':')
	if ($colon -ge 0) {
		$probeHost = $authority.Substring(0, $colon)
		$probePort = $authority.Substring($colon + 1)
	}
	try {
		$response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
		Write-VoxrLine "$url returned $([int]$response.StatusCode)."
	} catch {
		Write-VoxrLine "$url did not answer with 200. Confirm the DNS record for $probeHost and that inbound port $probePort reaches this host."
	}
}

function Get-VoxrComposeProject([string]$TargetDir) {
	if ($null -ne $env:COMPOSE_PROJECT_NAME -and $env:COMPOSE_PROJECT_NAME.Length -gt 0) {
		return $env:COMPOSE_PROJECT_NAME
	}
	foreach ($line in [System.IO.File]::ReadAllText((Join-Path $TargetDir 'docker-compose.yml')).Split("`n")) {
		if ($line -match '^name:\s*(\S+)') {
			return $Matches[1]
		}
	}
	return ''
}

$script:VoxrComposeOut = ''
$script:VoxrComposeSelector = ''
$script:VoxrComposeErr = ''

# One read-only Compose query, with what Compose printed on stderr kept.
#
# Compose loads the whole file set and interpolates every variable in it before it answers either
# query below. A file that is not there, a file it cannot read and a required variable .env does
# not set all fail at that point, and the stderr text is the only thing that says which of them it
# was.
function Invoke-VoxrComposeQuery([string]$Selector) {
	$result = Invoke-VoxrCapture @('compose', 'config', $Selector)
	$script:VoxrComposeOut = $result.Text
	$script:VoxrComposeErr = $result.Error
	$script:VoxrComposeSelector = $Selector
	return $result.Code
}

# The two readers below parse whatever the last query returned, so each one names
# the selector it belongs to. Reading the wrong one would otherwise hand back the
# other kind of list with nothing to say it was wrong.
function Assert-VoxrComposeSelector([string]$Selector) {
	if ($script:VoxrComposeSelector -ne $Selector) {
		Stop-Voxr "Internal error: read of $Selector after a $($script:VoxrComposeSelector) query." $VoxrExitSecret
	}
}

# What Compose printed on the last query, indented one level for the caller.
function Get-VoxrComposeError([string]$Indent) {
	if ($script:VoxrComposeErr.Length -eq 0) {
		return "${Indent}nothing"
	}
	return (($script:VoxrComposeErr.Split("`n") | ForEach-Object {"$Indent$_"}) -join "`n")
}

# The image references the stack resolves to, deduplicated, from the last query. Compose expands
# them from docker-compose.yml and .env, so this is the same resolution docker compose pull
# performs. It names the images, not the versions of them.
#
# By hand:
#   docker compose config --images
function Get-VoxrComposeImages {
	Assert-VoxrComposeSelector '--images'
	$refs = @()
	foreach ($line in $script:VoxrComposeOut.Split("`n")) {
		$candidate = $line.Trim()
		if ($candidate.Length -gt 0) {
			$refs += $candidate
		}
	}
	return @($refs | Sort-Object -Unique)
}

function Get-VoxrImageId([string]$Reference) {
	$result = Invoke-VoxrCapture @('image', 'inspect', '--format', '{{.Id}}', $Reference)
	if ($result.Code -ne 0) {
		return ''
	}
	return $result.Text
}

# The image ID each container was actually created from, against the reference Compose created it
# under.
#
# docker image inspect <reference> answers a different question: what that tag points at on this
# host now. The two disagree whenever a newer image already sits under a moving tag, which is the
# state an upgrade that pulled and then failed leaves behind, and that is the state the operator
# re-runs -Update from. Reading the tag there records the image the stack is about to move to as
# the image it is moving from, and the rollback that follows puts back what is already running
# while reporting success.
#
# By hand:
#   docker compose ps -aq | xargs docker inspect --format '{{.Config.Image}} {{.Image}}'
# The text of a captured stream, indented one level for the caller, or a word
# saying there was none.
function Get-VoxrIndented([string]$Text, [string]$Indent) {
	if ([string]::IsNullOrWhiteSpace($Text)) {
		return "${Indent}nothing"
	}
	return (($Text -split "`n") | ForEach-Object {"$Indent$_"}) -join "`n"
}

function Get-VoxrRunningImageIds {
	$ids = Invoke-VoxrCapture @('compose', 'ps', '-aq')
	$map = @{}
	if ($ids.Code -ne 0) {
		Stop-Voxr "docker compose ps failed, so what is running cannot be read and the record would name no image ID at all. Compose printed:`n$(Get-VoxrIndented $ids.Error '  ')" $VoxrExitPrerequisite
	}
	if ($ids.Text.Length -eq 0) {
		return $map
	}
	foreach ($container in $ids.Text.Split("`n")) {
		$candidate = $container.Trim()
		if ($candidate.Length -eq 0) {
			continue
		}
		$row = Invoke-VoxrCapture @('inspect', '--format', '{{.Config.Image}} {{.Image}}', $candidate)
		if ($row.Code -ne 0) {
			Stop-Voxr "docker inspect failed for $candidate, so the image ID under its reference cannot be read and a rollback would have nothing to go back to. Docker printed:`n$(Get-VoxrIndented $row.Error '  ')" $VoxrExitPrerequisite
		}
		$parts = $row.Text.Trim().Split(' ')
		if ($parts.Count -lt 2) {
			continue
		}
		if (-not $map.ContainsKey($parts[0])) {
			$map[$parts[0]] = $parts[1]
		}
	}
	return $map
}

function Get-VoxrRunningImageId($Running, [string]$Reference) {
	if ($null -ne $Running -and $Running.ContainsKey($Reference)) {
		return [string]$Running[$Reference]
	}
	return ''
}

function Get-VoxrPostgresMajor([string]$Path) {
	if (-not (Test-Path -LiteralPath $Path)) {
		return ''
	}
	foreach ($line in [System.IO.File]::ReadAllText($Path).Split("`n")) {
		if ($line -match '^\s*image:\s*postgres:(\d+)') {
			return $Matches[1]
		}
	}
	return ''
}

# -Force, because Get-Item without it returns nothing for a file the filesystem marks hidden while
# Test-Path still reports that file as present, and the pair reads as a file of zero bytes.
function Get-VoxrFileLength([string]$Path) {
	$item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
	if ($null -eq $item -or $item.PSIsContainer) {
		return 0
	}
	return [long]$item.Length
}

function Test-VoxrSameFile([string]$Left, [string]$Right) {
	if (-not (Test-Path -LiteralPath $Left)) {
		return $false
	}
	if (-not (Test-Path -LiteralPath $Right)) {
		return $false
	}
	return ((Get-FileHash -LiteralPath $Left -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $Right -Algorithm SHA256).Hash)
}

# Which mounted files the refresh changes, and therefore which services need a restart rather than
# a recreate. The comparison happens while the new copies are still staged, because once they are
# in place the old bytes are gone.
function Get-VoxrChangedMounts([string]$TargetDir, [string]$StagingDir) {
	$changed = @()
	foreach ($entry in $VoxrMountedFiles) {
		$current = Join-Path $TargetDir $entry.Name
		$fresh = Join-Path $StagingDir $entry.Name
		if (-not (Test-Path -LiteralPath $current)) {
			continue
		}
		if (-not (Test-VoxrSameFile $current $fresh)) {
			$changed += $entry
		}
	}
	return @($changed)
}

# The service names the docker-compose.yml in place defines.
#
# A rollback puts back the stack files the record holds, and a record taken before a service was
# renamed names the old service. Restarting a service the file in place does not define fails, so
# the name is checked first.
#
# By hand:
#   docker compose config --services
function Get-VoxrComposeServices {
	Assert-VoxrComposeSelector '--services'
	$services = @()
	foreach ($line in $script:VoxrComposeOut.Split("`n")) {
		$candidate = $line.Trim()
		if ($candidate.Length -gt 0) {
			$services += $candidate
		}
	}
	return @($services)
}

function Restart-VoxrMounts($Entries, [string]$TargetDir) {
	if (@($Entries).Count -eq 0) {
		return
	}
	if ((Invoke-VoxrComposeQuery '--services') -ne 0) {
		Stop-Voxr "docker compose config --services failed in $TargetDir, so the services that mount a refreshed file cannot be restarted. Compose printed:`n$(Get-VoxrComposeError '  ')" $VoxrExitUnhealthy
	}
	$services = @(Get-VoxrComposeServices)
	foreach ($entry in $Entries) {
		if ($services -notcontains $entry.Service) {
			Write-VoxrLine "Skipping the restart of $($entry.Service), because the docker-compose.yml in $TargetDir defines no service by that name."
			continue
		}
		Write-VoxrLine "Restarting $($entry.Service), because $($entry.Name) is mounted into it and up -d does not reload a mounted file."
		$code = Invoke-VoxrDocker @('compose', 'restart', $entry.Service)
		if ($code -ne 0) {
			Stop-Voxr "docker compose restart $($entry.Service) failed." $VoxrExitUnhealthy
		}
	}
}

# A record is created before the upgrade touches anything, so a run that refuses or fails after
# this point still leaves one behind. Such a record describes the state the instance is already
# in, which makes a rollback to it a no-op rather than a mistake. Only the newest record is ever
# used.
function New-VoxrRecord([string]$BackupRoot) {
	if (-not (Test-Path -LiteralPath $BackupRoot)) {
		New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
	}
	Set-VoxrPrivateDirectory $BackupRoot
	$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
	$record = Join-Path $BackupRoot "$VoxrRecordPrefix$stamp"
	if (Test-Path -LiteralPath $record) {
		Stop-Voxr "$record exists already." $VoxrExitRefused
	}
	New-Item -ItemType Directory -Path $record -Force | Out-Null
	Set-VoxrPrivateDirectory $record
	return $record
}

function Get-VoxrRecordTag([string]$Record) {
	$path = Join-Path $Record $VoxrTagFile
	if (-not (Test-Path -LiteralPath $path)) {
		return ''
	}
	$lines = @(Get-Content -LiteralPath $path -TotalCount 1)
	if ($lines.Count -eq 0 -or $null -eq $lines[0]) {
		return ''
	}
	return ([string]$lines[0]).Trim()
}

function Set-VoxrEnvValue([string]$EnvPath, [string]$Name, [string]$Value) {
	$lines = @(Get-VoxrEnvLines $EnvPath)
	$written = $false
	$out = @()
	foreach ($line in $lines) {
		if ($line.StartsWith("$Name=")) {
			$out += "$Name=$Value"
			$written = $true
		} else {
			$out += $line
		}
	}
	if (-not $written) {
		$out += "$Name=$Value"
	}
	Write-VoxrEnvFile $EnvPath $out
}

# Step 0 of an upgrade: mint the values the refreshed stack requires.
#
# Compose stops on a ${NAME:?} it cannot resolve, so a key the running .env does not hold fails
# every command this script runs before it reaches the step that would have reported it. Writing
# the value first is what makes the rest of the run possible. This runs before the record, so the
# .env the record saves is the one that works.
# The keys the run would write, without writing any of them. The plan and the run
# read the same list, so a plan cannot describe a run that does something else.
function Get-VoxrMissingRequiredSecrets([string]$EnvPath) {
	$missing = @()
	foreach ($entry in $VoxrUpgradeSecretKeys) {
		$current = Get-VoxrEnvValue $EnvPath $entry.Name
		if ($current.Length -eq 0 -or $current -eq 'CHANGE_ME') {
			$missing += $entry.Name
		}
	}
	return @($missing)
}

# A plan writes nothing itself. The run it describes writes .env before it reads
# anything when a required key is absent, and saying otherwise would describe a
# different run.
function Write-VoxrPlanFooter($Missing) {
	if ($Missing.Count -gt 0) {
		Write-VoxrLine 'This plan wrote nothing. The run it describes writes the keys above into .env before anything else.'
	} else {
		Write-VoxrLine 'Nothing outside a temporary directory was written.'
	}
}

function Add-VoxrRequiredSecrets([string]$EnvPath) {
	foreach ($entry in $VoxrUpgradeSecretKeys) {
		$current = Get-VoxrEnvValue $EnvPath $entry.Name
		if ($current.Length -ne 0 -and $current -ne 'CHANGE_ME') {
			continue
		}
		$value = ''
		if ($entry.Kind -eq 'hex') {
			$value = ConvertTo-VoxrHex (New-VoxrRandomBytes 32)
		} elseif ($entry.Kind -eq 'base64') {
			$value = [System.Convert]::ToBase64String((New-VoxrRandomBytes 32))
		} else {
			Stop-Voxr "Unknown secret kind $($entry.Kind) for $($entry.Name)." $VoxrExitSecret
		}
		if ($value.Length -eq 0) {
			Stop-Voxr "Generated an empty value for $($entry.Name)." $VoxrExitSecret
		}
		Set-VoxrEnvValue $EnvPath $entry.Name $value
		Write-VoxrLine "Wrote $($entry.Name) into .env. The refreshed stack requires it and this instance held no usable value."
	}
}

function Get-VoxrNewestRecord([string]$BackupRoot) {
	if (-not (Test-Path -LiteralPath $BackupRoot)) {
		return ''
	}
	$records = @(Get-ChildItem -LiteralPath $BackupRoot -Directory -ErrorAction SilentlyContinue | Where-Object {$_.Name.StartsWith($VoxrRecordPrefix)} | Sort-Object -Property Name)
	if ($records.Count -eq 0) {
		return ''
	}
	return $records[$records.Count - 1].FullName
}

function Write-VoxrTextFile([string]$Path, [string[]]$Lines) {
	$encoding = New-Object System.Text.UTF8Encoding($false)
	$text = ($Lines -join "`n") + "`n"
	[System.IO.File]::WriteAllText($Path, $text, $encoding)
}

# Step 1 of an upgrade: record what is running before anything moves.
#
# VOXR_IMAGE_TAG defaults to v1, which tracks the latest compatible release. The tag therefore
# reads v1 before and after the upgrade, and the image ID is the only thing that tells two
# releases apart. That is what makes this record the version history the stack does not otherwise
# keep, and what makes a rollback possible on a moving tag.
#
# The reference list comes from Compose and the ID under each reference comes from the container
# running it, for the reason in Get-VoxrRunningImageIds. A reference no container carries is
# recorded as `-`, which a rollback skips, because a version that was not running is not a version
# to go back to.
#
# By hand:
#   docker compose images
# The record directory is created once both refusals above have passed, so a run
# that stops here leaves no record behind. A record with no images file would
# otherwise sort newest and take the place of the last usable one, and a rollback
# reads the newest.
function Save-VoxrVersionRecord([string]$BackupRoot, [string]$EnvPath, [string]$TargetDir) {
	$running = Get-VoxrRunningImageIds
	if ((Invoke-VoxrComposeQuery '--images') -ne 0) {
		Stop-Voxr "docker compose config --images failed in $TargetDir, so the running version cannot be recorded. Compose printed:`n$(Get-VoxrComposeError '  ')" $VoxrExitPrerequisite
	}
	$refs = @(Get-VoxrComposeImages)
	if ($refs.Count -eq 0) {
		Stop-Voxr "docker compose config --images returned nothing in $TargetDir, so the running version cannot be recorded. The stack files there declare no service with an image." $VoxrExitPrerequisite
	}
	$Record = New-VoxrRecord $BackupRoot
	Write-VoxrTextFile (Join-Path $Record $VoxrTagFile) @((Get-VoxrEnvValue $EnvPath 'VOXR_IMAGE_TAG'))
	$lines = @()
	foreach ($reference in $refs) {
		$id = Get-VoxrRunningImageId $running $reference
		if ($id.Length -eq 0) {
			$id = '-'
		}
		$lines += "$reference $id"
	}
	Write-VoxrTextFile (Join-Path $Record $VoxrImagesFile) $lines
	Write-VoxrLine "Recorded $($lines.Count) image references in $Record."
	return $Record
}

# .env and the stack files go into the record because nothing else regenerates them. .env holds
# every secret the instance was built with, so the record directory is closed to the current
# account alone, and the record belongs wherever the operator already keeps secrets.
function Save-VoxrCurrentFiles([string]$Record, [string]$TargetDir, [string]$EnvPath) {
	$envCopy = Join-Path $Record '.env'
	Copy-Item -LiteralPath $EnvPath -Destination $envCopy -Force
	Set-VoxrPrivateFile $envCopy
	foreach ($name in $VoxrStackFiles) {
		$source = Join-Path $TargetDir $name
		$length = Get-VoxrFileLength $source
		if ($length -gt 0) {
			Copy-Item -LiteralPath $source -Destination (Join-Path $Record $name) -Force
		} elseif (Test-Path -LiteralPath $source) {
			Stop-Voxr "$source is empty, so the record would hold a file a rollback could not use. Put the file back before upgrading." $VoxrExitBackup
		}
	}
}

function Test-VoxrPostgresRunning {
	$result = Invoke-VoxrCapture @('compose', 'ps', '-q', 'postgres')
	if ($result.Code -ne 0 -or $result.Text.Length -eq 0) {
		return $false
	}
	$id = $result.Text.Split("`n")[0].Trim()
	if ($id.Length -eq 0) {
		return $false
	}
	$state = Invoke-VoxrCapture @('inspect', '--format', '{{.State.Status}}', $id)
	return ($state.Code -eq 0 -and $state.Text -eq 'running')
}

function Test-VoxrDumpHeader([string]$Path) {
	$stream = [System.IO.File]::OpenRead($Path)
	try {
		$buffer = New-Object byte[] 5
		if ($stream.Read($buffer, 0, 5) -ne 5) {
			return $false
		}
		return ([System.Text.Encoding]::ASCII.GetString($buffer) -eq 'PGDMP')
	} finally {
		$stream.Dispose()
	}
}

# Step 2 of an upgrade, and the part that gates the rest.
#
# api, worker, users-shard and messages-shard apply schema changes while they start, and starting
# an older image does not undo them. The dump taken before the pull is the only way back across a
# schema change.
#
# By hand:
#   docker compose exec -T postgres pg_dump -U voxr -d voxr --format=custom > backups\voxr.dump
#
# The database and the role are both named voxr and are fixed in docker-compose.yml. Keep -T.
# Without it Docker attaches a terminal to the command and the dump arrives corrupted, which is
# why the first five bytes are checked against the custom-format magic rather than only the size.
#
# The dump runs against the live stack. pg_dump reads inside one transaction, so it sees a
# consistent database without stopping anything. The volume copy below has no equivalent and is
# why the stack stops there and not here.
#
# The volume copy measures its volume and refuses when the disk is short. This step does not,
# because the size of a custom-format dump is not knowable before pg_dump writes it. Point
# -BackupDir at a drive with room for the database.
# The bundled data stores are services in the stack file. An operator who points the stack at a
# database or an object store outside it takes those services out, and the two backup steps that
# reach into them then have nothing to reach. That is a supported shape rather than a fault, so
# each step says what it skipped and the upgrade goes on. Backing up a store outside the stack
# belongs to whoever runs it.
$script:VoxrStackServices = $null

function Test-VoxrStackDefinesService([string]$Name, [string]$TargetDir) {
	if ($null -eq $script:VoxrStackServices) {
		if ((Invoke-VoxrComposeQuery '--services') -ne 0) {
			Stop-Voxr "docker compose config --services failed in $TargetDir, so the services this stack defines cannot be read. Compose printed:`n$(Get-VoxrComposeError '  ')" $VoxrExitUnhealthy
		}
		$script:VoxrStackServices = @(Get-VoxrComposeServices)
	}
	return $script:VoxrStackServices -contains $Name
}

function Backup-VoxrDatabase([string]$Record, [string]$TargetDir) {
	if (-not (Test-VoxrStackDefinesService 'postgres' $TargetDir)) {
		Write-VoxrLine 'Skipping the database dump. This stack defines no postgres service, so its database runs outside the stack and only the operator of that database can dump it.'
		return
	}
	if (-not (Test-VoxrPostgresRunning)) {
		Write-VoxrLine 'Postgres is not running. Starting it for the dump.'
		if ((Invoke-VoxrDocker @('compose', 'up', '-d', '--wait', 'postgres')) -ne 0) {
			Stop-Voxr 'Postgres does not start, so no dump can be taken.' $VoxrExitBackup
		}
	}
	$dump = Join-Path $Record $VoxrDumpFile
	Write-VoxrLine 'Dumping the database.'
	$code = Invoke-VoxrDockerToFile @('compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'voxr', '-d', 'voxr', '--format=custom') $dump $TargetDir
	if ($code -ne 0) {
		Remove-VoxrTemporary $dump
		Stop-Voxr 'pg_dump failed. The instance is untouched.' $VoxrExitBackup
	}
	if (-not (Test-VoxrDumpHeader $dump)) {
		Remove-VoxrTemporary $dump
		Stop-Voxr 'The dump does not begin with the custom-format header. The instance is untouched.' $VoxrExitBackup
	}
	Write-VoxrLine "Dumped the database to $dump."
}

$script:VoxrVolumeError = ''

function Get-VoxrVolumeError([string]$Indent) {
	if ([string]::IsNullOrWhiteSpace($script:VoxrVolumeError)) {
		return "${Indent}nothing"
	}
	return (($script:VoxrVolumeError -split "`n") | ForEach-Object {"$Indent$_"}) -join "`n"
}

function Get-VoxrVolumeSizeKb([string]$Volume) {
	$result = Invoke-VoxrCapture @('run', '--rm', '-v', "${Volume}:/data:ro", $VoxrHelperImage, 'du', '-sk', '/data')
	$script:VoxrVolumeError = $result.Error
	if ($result.Code -ne 0) {
		return -1
	}
	$first = $result.Text.Split("`n")[0].Trim()
	if ($first -match '^(\d+)') {
		return [long]$Matches[1]
	}
	return -1
}

function Get-VoxrFreeKb([string]$Path) {
	$root = [System.IO.Path]::GetPathRoot([System.IO.Path]::GetFullPath($Path))
	$drive = New-Object System.IO.DriveInfo($root)
	return [long]($drive.AvailableFreeSpace / 1024)
}

# Step 2 continued: the volume copy.
#
# A live copy can catch a file mid-write, so the stack stops for it. The stack comes back up on
# the images it was already running before anything else happens, so a failure here leaves a
# working instance rather than a stopped one.
#
# By hand:
#   docker compose stop
#   docker run --rm -v voxr_seaweedfs-data:/data -v "${PWD}\backups:/backup" alpine tar czf /backup/seaweedfs-data.tgz -C /data .
#   docker compose up -d
function Copy-VoxrVolumes([string]$Record, [string]$Project, [string]$TargetDir) {
	if (-not (Test-VoxrStackDefinesService 'seaweedfs' $TargetDir)) {
		Write-VoxrLine 'Skipping the uploads copy. This stack defines no seaweedfs service, so its objects live outside the stack and only the operator of that store can copy them.'
		return
	}
	$present = @()
	foreach ($volume in $VoxrBackupVolumes) {
		$full = "${Project}_$volume"
		$inspect = Invoke-VoxrCapture @('volume', 'inspect', $full)
		if ($inspect.Code -ne 0) {
			Stop-Voxr "The volume $full does not exist, so the uploads cannot be copied. The stack declares that volume, so this is a project name other than $Project or a volume that was removed. Pass -NoVolumeBackup to take the database dump alone when the uploads of this instance live somewhere this script cannot reach." $VoxrExitBackup
		}
		$size = Get-VoxrVolumeSizeKb $full
		if ($size -lt 0) {
			Stop-Voxr "Cannot measure the volume $full, so the uploads copy cannot be sized. Pass -NoVolumeBackup to take the database dump alone. Docker printed:`n$(Get-VoxrVolumeError '  ')" $VoxrExitBackup
		}
		$free = Get-VoxrFreeKb $Record
		$need = [long]($size * $VoxrVolumeHeadroomPercent / 100)
		if ($free -lt $need) {
			Stop-Voxr "$full holds $([long]($size / 1024)) MB and $Record has $([long]($free / 1024)) MB free. Point -BackupDir at a drive with room, or pass -NoVolumeBackup to take the database dump alone." $VoxrExitBackup
		}
		$present += $volume
	}
	if ($present.Count -eq 0) {
		return
	}
	Write-VoxrLine 'Stopping the stack for a consistent copy of the uploads.'
	if ((Invoke-VoxrDocker @('compose', 'stop')) -ne 0) {
		Stop-Voxr 'docker compose stop failed.' $VoxrExitBackup
	}
	foreach ($volume in $present) {
		$full = "${Project}_$volume"
		Write-VoxrLine "Copying $full."
		$code = Invoke-VoxrDocker @('run', '--rm', '-v', "${full}:/data:ro", '-v', "${Record}:/backup", $VoxrHelperImage, 'tar', 'czf', "/backup/$volume.tgz", '-C', '/data', '.')
		if ($code -ne 0) {
			[void](Invoke-VoxrDocker @('compose', 'up', '-d', '--remove-orphans'))
			Stop-Voxr "Copying $full failed. The stack is started again on the images it was running." $VoxrExitBackup
		}
	}
	Write-VoxrLine 'Starting the stack again before the upgrade continues.'
	if ((Invoke-VoxrDocker @('compose', 'up', '-d', '--remove-orphans')) -ne 0) {
		Stop-Voxr 'docker compose up -d failed after the copy. Read docker compose logs.' $VoxrExitBackup
	}
}

function Backup-VoxrInstance([string]$Record, [string]$TargetDir, [string]$Project) {
	if ($SkipBackupAcceptDataLoss) {
		Write-VoxrLine 'Skipping the backup. -SkipBackupAcceptDataLoss was given, so a schema change has no way back.'
		return
	}
	Backup-VoxrDatabase $Record $TargetDir
	if ($NoVolumeBackup) {
		Write-VoxrLine 'Skipping the uploads copy. -NoVolumeBackup was given.'
		return
	}
	Copy-VoxrVolumes $Record $Project $TargetDir
}

# A newer Postgres major does not read the data directory an older major wrote, so moving between
# majors means dumping, removing the volume that holds the database, and restoring into an empty
# directory. Removing that volume is the one destructive act in the whole procedure, and it is not
# something a script should do on an operator's behalf while they read scrolling output.
#
# The refreshed file is still staged when this runs, so a refusal here leaves the instance exactly
# as it was.
function Assert-VoxrPostgresMajor([string]$TargetDir, [string]$StagingDir) {
	$old = Get-VoxrPostgresMajor (Join-Path $TargetDir 'docker-compose.yml')
	$new = Get-VoxrPostgresMajor (Join-Path $StagingDir 'docker-compose.yml')
	if ($old.Length -eq 0 -or $new.Length -eq 0 -or $old -eq $new) {
		return
	}
	Stop-Voxr "The refreshed docker-compose.yml pins postgres:$new and this instance runs postgres:$old. A major version change goes through a dump, an empty data directory and a restore, which this script does not do because it destroys the volume holding the database. Nothing was changed. The procedure is at https://voxr.dev/operator/upgrading/" $VoxrExitRefused
}

# Puts one line of .env back, and proves it touched nothing else.
#
# VOXR_IMAGE_TAG is the only key this function writes. Every other line, which is every
# secret, is compared before the new file replaces the old one, so a rewrite that lost or changed
# a secret cannot land.
function Set-VoxrImageTag([string]$EnvPath, [string]$Tag) {
	$before = Get-VoxrEnvLines $EnvPath
	$found = $false
	$after = @()
	foreach ($line in $before) {
		if ($line.StartsWith('VOXR_IMAGE_TAG=')) {
			$after += "VOXR_IMAGE_TAG=$Tag"
			$found = $true
		} else {
			$after += $line
		}
	}
	if (-not $found) {
		Stop-Voxr "$EnvPath declares no VOXR_IMAGE_TAG, so the tag cannot be put back. Set it by hand." $VoxrExitRefused
	}
	$keptBefore = @($before | Where-Object {-not $_.StartsWith('VOXR_IMAGE_TAG=')})
	$keptAfter = @($after | Where-Object {-not $_.StartsWith('VOXR_IMAGE_TAG=')})
	if ($keptBefore.Count -eq 0 -or ($keptBefore -join "`n") -ne ($keptAfter -join "`n")) {
		Stop-Voxr 'Rewriting VOXR_IMAGE_TAG would have changed another line in .env. Nothing was written.' $VoxrExitRefused
	}
	Write-VoxrEnvFile $EnvPath $after
	Write-VoxrLine "VOXR_IMAGE_TAG in .env is $Tag."
}

function Show-VoxrUpdatePlan([string]$TargetDir, [string]$EnvPath, [string]$BackupRoot) {
	Write-VoxrLine 'Plan: upgrade'
	Write-VoxrLine "  Directory:  $TargetDir"
	Write-VoxrLine "  Ref:        $Ref"
	Write-VoxrLine "  Image tag:  $(Get-VoxrEnvValue $EnvPath 'VOXR_IMAGE_TAG') from .env"
	Write-VoxrLine "  Backup dir: $BackupRoot"
	$missing = Get-VoxrMissingRequiredSecrets $EnvPath
	if ($missing.Count -gt 0) {
		Write-VoxrLine '  Writes .env: the run mints these before it reads anything, because the refreshed stack requires them'
		foreach ($name in $missing) {
			Write-VoxrLine "              $name"
		}
	}
	$running = Get-VoxrRunningImageIds
	if ((Invoke-VoxrComposeQuery '--images') -ne 0) {
		Write-VoxrLine '  Refusal:    docker compose config --images fails here, and step 1 of the upgrade reads that list'
		Write-VoxrLine '  Compose said:'
		Write-VoxrLine (Get-VoxrComposeError '    ')
		if ($missing.Count -gt 0) {
			Write-VoxrLine '  Outcome:    the run writes the keys above first, which may be what Compose is missing, so this refusal may not stand'
		} else {
			Write-VoxrLine '  Outcome:    the run stops on step 1 and changes nothing'
		}
		Write-VoxrPlanFooter $missing
		return
	}
	Write-VoxrLine '  Running now:'
	foreach ($reference in Get-VoxrComposeImages) {
		$id = Get-VoxrRunningImageId $running $reference
		if ($id.Length -eq 0) {
			$id = 'no container runs this image'
		}
		Write-VoxrLine "    $reference $id"
	}
	if ($SkipBackupAcceptDataLoss) {
		Write-VoxrLine '  Backup:     none, and a schema change would have no way back'
	} elseif ($NoVolumeBackup) {
		Write-VoxrLine '  Backup:     the database dump, .env, and the stack files'
	} else {
		Write-VoxrLine '  Backup:     the database dump, the uploads volume, .env, and the stack files'
		Write-VoxrLine '  Downtime:   the stack stops for the uploads copy, then again for the recreate'
	}
	# The dry run downloads into a temporary directory so it can name the files that actually
	# change, the services that actually restart, and a Postgres major that would stop the run. It
	# removes that directory before it returns and touches nothing in the working directory.
	$staging = New-VoxrStagingDirectory ([System.IO.Path]::GetTempPath())
	try {
		Get-VoxrStackFiles $staging $Ref
		Write-VoxrLine '  File changes:'
		$changed = 0
		foreach ($name in $VoxrStackFiles) {
			$current = Join-Path $TargetDir $name
			if (-not (Test-Path -LiteralPath $current)) {
				Write-VoxrLine "    $name is new"
				$changed++
			} elseif (Test-VoxrSameFile $current (Join-Path $staging $name)) {
				Write-VoxrLine "    $name is unchanged"
			} else {
				Write-VoxrLine "    $name changes"
				$changed++
			}
		}
		if ($changed -eq 0) {
			Write-VoxrLine "  Note:       ref $Ref moves no stack file"
		}
		$old = Get-VoxrPostgresMajor (Join-Path $TargetDir 'docker-compose.yml')
		$new = Get-VoxrPostgresMajor (Join-Path $staging 'docker-compose.yml')
		if ($old.Length -gt 0 -and $new.Length -gt 0 -and $old -ne $new) {
			Write-VoxrLine "  Refusal:    postgres moves from $old to $new, which this script does not do"
			Write-VoxrLine '  Outcome:    the run stops at that refusal and changes nothing'
			Write-VoxrPlanFooter $missing
			return
		}
		foreach ($entry in Get-VoxrChangedMounts $TargetDir $staging) {
			Write-VoxrLine "  Restart:    $($entry.Service), because $($entry.Name) changes and a mounted file survives up -d"
		}
	} finally {
		Remove-VoxrStagingDirectory $staging
	}
	Write-VoxrLine '  Commands:   docker compose pull, docker compose up -d'
	Write-VoxrPlanFooter $missing
	Write-VoxrLine 'Drop -DryRun to run this.'
}

function Show-VoxrRollbackPlan([string]$TargetDir, [string]$EnvPath, [string]$BackupRoot) {
	$record = Get-VoxrNewestRecord $BackupRoot
	if ($record.Length -eq 0) {
		Stop-Voxr "No record in $BackupRoot. A rollback needs an upgrade that recorded what was running." $VoxrExitPrerequisite
	}
	$recordedTag = Get-VoxrRecordTag $record
	$currentTag = Get-VoxrEnvValue $EnvPath 'VOXR_IMAGE_TAG'
	Write-VoxrLine 'Plan: rollback'
	Write-VoxrLine "  Directory:  $TargetDir"
	Write-VoxrLine "  Record:     $record"
	if ($recordedTag -eq $currentTag) {
		Write-VoxrLine "  Image tag:  stays $currentTag, so the recorded image IDs move back onto it"
	} else {
		Write-VoxrLine "  Image tag:  $currentTag becomes $recordedTag in .env"
	}
	Write-VoxrLine '  Images:'
	foreach ($line in Get-Content -LiteralPath (Join-Path $record $VoxrImagesFile)) {
		$parts = $line.Trim().Split(' ')
		if ($parts.Count -lt 2) {
			continue
		}
		if ($parts[1] -eq '-') {
			Write-VoxrLine "    $($parts[0]) was not recorded with an ID"
		} elseif ((Get-VoxrImageId $parts[1]).Length -gt 0) {
			Write-VoxrLine "    $($parts[0]) back to $($parts[1])"
		} else {
			Write-VoxrLine "    $($parts[0]) is gone from this host, so $($parts[1]) cannot come back"
		}
	}
	Write-VoxrLine "  Files:      restored from $record"
	Write-VoxrLine '  Database:   stays where the new release left it'
	Write-VoxrLine 'Nothing is written. Drop -DryRun to run this.'
}

# The full upgrade, in the order that leaves a working instance behind at every point it can fail.
function Invoke-VoxrUpgrade([string]$TargetDir, [string]$EnvPath, [string]$BackupRoot, [string]$Project) {
	Add-VoxrRequiredSecrets $EnvPath
	$record = Save-VoxrVersionRecord $BackupRoot $EnvPath $TargetDir
	Save-VoxrCurrentFiles $record $TargetDir $EnvPath
	Backup-VoxrInstance $record $TargetDir $Project

	$staging = New-VoxrStagingDirectory $TargetDir
	$changedMounts = @()
	try {
		Get-VoxrStackFiles $staging $Ref
		Assert-VoxrPostgresMajor $TargetDir $staging
		$changedMounts = Get-VoxrChangedMounts $TargetDir $staging
		Move-VoxrStackFiles $staging $TargetDir
	} finally {
		Remove-VoxrStagingDirectory $staging
	}
	Write-VoxrLine "Stack files in $TargetDir are at ref $Ref."

	# The pull runs while the old containers still serve, so the long part of an upgrade costs no
	# downtime.
	#
	# By hand:
	#   docker compose pull
	Write-VoxrLine 'Pulling images.'
	if ((Invoke-VoxrDocker @('compose', 'pull')) -ne 0) {
		Stop-Voxr 'docker compose pull failed. The stack files are refreshed and the instance still runs the old images.' $VoxrExitDownload
	}
	# Recreates the containers whose image or configuration changed and leaves the rest running.
	#
	# By hand:
	#   docker compose up -d --remove-orphans
	#
	# Behind your own reverse proxy every command names the overlay, which COMPOSE_FILE in .env
	# does once. An invocation without it recreates the edge from the base file, which binds 80 and
	# 443 and requests its own certificate.
	#
	# api, worker, users-shard and messages-shard each apply the database schema while they start,
	# so the upgrade is not finished until all four are back up. All four take the same Postgres
	# advisory lock around that work, so several of them starting at once is safe.
	#
	# app-proxy waits for api to report healthy and the edge waits for the Gateway, so the hostname
	# returns errors for a minute or two after this call. The api healthcheck allows 90 seconds
	# before it counts a failure.
	Write-VoxrLine 'Recreating the stack.'
	if ((Invoke-VoxrDocker @('compose', 'up', '-d', '--remove-orphans')) -ne 0) {
		Stop-Voxr 'docker compose up -d failed. Read docker compose logs.' $VoxrExitUnhealthy
	}
	Restart-VoxrMounts $changedMounts $TargetDir
	Wait-VoxrStack 'Waiting for every service to report ready.'
	$originValue = Get-VoxrPublicOrigin $EnvPath
	if ($originValue.Length -gt 0) {
		Test-VoxrPublicHealth $originValue
	}
	Write-VoxrLine "Instance upgraded in $TargetDir."
	Write-VoxrLine "The record of what it ran before is in $record."
	Write-VoxrLine "Go back with install.ps1 -Rollback -Dir $TargetDir."
	exit 0
}

# A rollback moves the images and the stack files back. The database stays where the new release
# left it, because api, worker, users-shard and messages-shard apply schema work in place while
# they start and an older image does not undo it. Across a release that changed the schema, the
# dump in the record is the only way back, and putting it back is a separate decision an operator
# makes.
#
# Two shapes, depending on what the upgrade moved:
#
#   A pinned tag moved, so the old images still carry their own tag. The tag goes back into .env
#   and Compose finds them.
#
#     By hand: set VOXR_IMAGE_TAG back, then docker compose up -d
#
#   A moving tag such as v1 stayed put and the images under it changed. The recorded image IDs are
#   still on the host until a prune removes them, so the old ID goes back onto the tag it had.
#
#     By hand: docker image tag <recorded id> ghcr.io/voxrapp/voxr-api:v1
#
# Neither shape pulls. A pull is what moved the instance forward in the first place, and running
# one here would undo the rollback in the same breath.
function Invoke-VoxrRollback([string]$TargetDir, [string]$EnvPath, [string]$BackupRoot) {
	$record = Get-VoxrNewestRecord $BackupRoot
	if ($record.Length -eq 0) {
		Stop-Voxr "No record in $BackupRoot. A rollback needs an upgrade that recorded what was running." $VoxrExitPrerequisite
	}
	$imagesPath = Join-Path $record $VoxrImagesFile
	if (-not (Test-Path -LiteralPath $imagesPath)) {
		Stop-Voxr "$record records no images." $VoxrExitPrerequisite
	}
	Write-VoxrLine "Rolling back to $record."

	$recordedTag = Get-VoxrRecordTag $record
	$currentTag = Get-VoxrEnvValue $EnvPath 'VOXR_IMAGE_TAG'
	$moved = $false
	if ($recordedTag.Length -gt 0 -and $recordedTag -ne $currentTag) {
		if ($recordedTag -match '[\s/]') {
			Stop-Voxr "The recorded image tag $recordedTag is not an image tag." $VoxrExitRefused
		}
		Set-VoxrImageTag $EnvPath $recordedTag
		$moved = $true
	} else {
		foreach ($line in Get-Content -LiteralPath $imagesPath) {
			$parts = $line.Trim().Split(' ')
			if ($parts.Count -lt 2 -or $parts[1] -eq '-') {
				continue
			}
			if ((Get-VoxrImageId $parts[1]).Length -eq 0) {
				Write-VoxrLine "$($parts[0]) is gone from this host, so it keeps the image it has now."
				continue
			}
			if ((Invoke-VoxrDocker @('image', 'tag', $parts[1], $parts[0])) -ne 0) {
				Stop-Voxr "Cannot put $($parts[1]) back on $($parts[0])." $VoxrExitRefused
			}
			$moved = $true
		}
	}
	if (-not $moved) {
		Stop-Voxr "Nothing in $record can be put back. The recorded tag is the one in .env and every recorded image has been removed from this host, which a docker image prune does." $VoxrExitPrerequisite
	}

	foreach ($name in $VoxrStackFiles) {
		$source = Join-Path $record $name
		$length = Get-VoxrFileLength $source
		if ($length -gt 0) {
			Copy-Item -LiteralPath $source -Destination (Join-Path $TargetDir $name) -Force
		} elseif (Test-Path -LiteralPath $source) {
			Stop-Voxr "$source is empty, so restoring it would replace a working file with nothing. Nothing was restored. Take the file from another record or from the ref the record names." $VoxrExitRefused
		}
	}
	Write-VoxrLine "Stack files in $TargetDir are the ones the record holds."

	Write-VoxrLine 'Recreating the stack.'
	if ((Invoke-VoxrDocker @('compose', 'up', '-d', '--remove-orphans')) -ne 0) {
		Stop-Voxr 'docker compose up -d failed. Read docker compose logs.' $VoxrExitUnhealthy
	}
	# The mounted file came back from the record, so its service restarts. Comparing it first
	# would save one restart and cost the reader a reason.
	Restart-VoxrMounts $VoxrMountedFiles $TargetDir
	Wait-VoxrStack 'Waiting for every service to report ready.'
	$originValue = Get-VoxrPublicOrigin $EnvPath
	if ($originValue.Length -gt 0) {
		Test-VoxrPublicHealth $originValue
	}
	Write-VoxrLine "Instance rolled back in $TargetDir."
	$dumpPath = Join-Path $record $VoxrDumpFile
	if ((Test-Path -LiteralPath $dumpPath) -and ((Get-Item -LiteralPath $dumpPath).Length -gt 0)) {
		Write-VoxrLine "The database did not move. Restore it from $dumpPath only when the release you left changed the schema."
	} else {
		Write-VoxrLine 'The database did not move. That record holds no dump, because the upgrade ran with -SkipBackupAcceptDataLoss, so a release that changed the schema has no way back.'
	}
	exit 0
}

function Assert-VoxrInstance([string]$TargetDir, [string]$EnvPath) {
	if (-not (Test-Path -LiteralPath $EnvPath)) {
		Stop-Voxr "No .env in $TargetDir. That directory holds no instance. Run install.ps1 with neither -Update nor -Rollback to set one up." $VoxrExitPrerequisite
	}
	$compose = Join-Path $TargetDir 'docker-compose.yml'
	if (-not (Test-Path -LiteralPath $compose)) {
		Stop-Voxr "No docker-compose.yml in $TargetDir. That directory does not hold an instance." $VoxrExitPrerequisite
	}
	if ((Get-VoxrFileLength $compose) -eq 0) {
		Stop-Voxr "$compose is empty. A redirect that captured a failed download leaves that, and Compose refuses an empty compose file. Put the file back from a backup or from the record of the last upgrade, then run this again." $VoxrExitPrerequisite
	}
}

# Compose reads COMPOSE_FILE from .env and loads every file it names before it answers anything, so
# one file the directory does not hold fails every docker compose command run in it. What Compose
# prints for that is a single stat line that names neither COMPOSE_FILE nor .env.
#
# Two of the files this script downloads sit in .env.example as a COMPOSE_FILE line to uncomment,
# so an instance set up before this script existed can hold the line and not the file. An upgrade
# reads the running images before it refreshes the stack files, so such an instance stops on the
# first step and no re-run gets any further.
#
# The line stays. Without the file it names the edge container binds 80 and 443 and requests its
# own certificate.
#
# By hand:
#   Select-String COMPOSE_FILE .env
# A value as Compose reads it: no surrounding quotes and no trailing blanks.
# Get-VoxrEnvLines already drops a carriage return. Reading it any other way
# invents a filename the operator cannot see and refuses a run that would have
# worked.
function Get-VoxrEnvScalar([string]$EnvPath, [string]$Name) {
	$raw = (Get-VoxrEnvValue $EnvPath $Name).TrimEnd()
	if ($raw.Length -ge 2) {
		if (($raw[0] -eq '"' -and $raw[-1] -eq '"') -or ($raw[0] -eq "'" -and $raw[-1] -eq "'")) {
			return $raw.Substring(1, $raw.Length - 2)
		}
	}
	return $raw
}

function Assert-VoxrComposeFiles([string]$TargetDir, [string]$EnvPath) {
	$value = ''
	$source = 'the environment'
	if ($null -ne $env:COMPOSE_FILE) {
		$value = [string]$env:COMPOSE_FILE
	}
	if ($value.Length -eq 0) {
		$value = Get-VoxrEnvScalar $EnvPath 'COMPOSE_FILE'
		$source = $EnvPath
	}
	if ($value.Length -eq 0) {
		return
	}
	$separator = ''
	if ($null -ne $env:COMPOSE_PATH_SEPARATOR) {
		$separator = [string]$env:COMPOSE_PATH_SEPARATOR
	}
	if ($separator.Length -eq 0) {
		$separator = Get-VoxrEnvScalar $EnvPath 'COMPOSE_PATH_SEPARATOR'
	}
	if ($separator.Length -eq 0) {
		$separator = [System.IO.Path]::PathSeparator
	}
	foreach ($name in $value.Split([string[]]$separator, [System.StringSplitOptions]::None)) {
		if ($name.Length -eq 0) {
			continue
		}
		$path = $name
		if (-not [System.IO.Path]::IsPathRooted($path)) {
			$path = Join-Path $TargetDir $name
		}
		if (Test-Path -LiteralPath $path) {
			continue
		}
		if ($VoxrStackFiles -contains $name) {
			Stop-Voxr "COMPOSE_FILE from $source names $name and $path is not there, so every docker compose command in $TargetDir fails and this run stops before it changes anything. This script downloads $name, and an instance set up before it existed does not hold that file yet. Put it in place and run this again:`n  Invoke-WebRequest -Uri $VoxrRawBase/$Ref/$VoxrStackPath/$name -OutFile $path -UseBasicParsing`nLeave the COMPOSE_FILE line as it is. Without $name the edge container binds 80 and 443 and requests its own certificate." $VoxrExitPrerequisite
		}
		Stop-Voxr "COMPOSE_FILE from $source names $name and $path is not there, so every docker compose command in $TargetDir fails. This script does not download $name. Put that file back, or take it out of the COMPOSE_FILE line." $VoxrExitPrerequisite
	}
}

function Invoke-VoxrInstall {
	if ($Help) {
		Show-VoxrUsage
		exit 0
	}
	if ($Rest.Count -gt 0) {
		Write-VoxrProblem "Unknown argument: $($Rest[0])"
		Show-VoxrUsage
		exit $VoxrExitUsage
	}
	if ($Tls -ne 'bundled' -and $Tls -ne 'proxy') {
		Stop-Voxr "-Tls takes bundled or proxy. Got: $Tls" $VoxrExitUsage
	}
	Assert-VoxrRef $Ref
	Assert-VoxrEdgeBind $EdgeBind
	if ($ImageTag.Length -eq 0) {
		Stop-Voxr '-ImageTag must not be empty.' $VoxrExitUsage
	}
	if ($Update -and $Rollback) {
		Stop-Voxr '-Update and -Rollback do not combine.' $VoxrExitUsage
	}
	if ($NoStart -and ($Update -or $Rollback)) {
		Stop-Voxr '-NoStart belongs to an install. An upgrade that does not recreate is not an upgrade.' $VoxrExitUsage
	}
	if ($SkipBackupAcceptDataLoss -and -not $Update) {
		Stop-Voxr '-SkipBackupAcceptDataLoss belongs to -Update.' $VoxrExitUsage
	}
	if ($NoVolumeBackup -and -not $Update) {
		Stop-Voxr '-NoVolumeBackup belongs to -Update.' $VoxrExitUsage
	}
	if ($SkipBackupAcceptDataLoss -and $NoVolumeBackup) {
		Stop-Voxr '-SkipBackupAcceptDataLoss already skips the volume copy.' $VoxrExitUsage
	}

	Invoke-VoxrPreflight

	$targetPath = $Dir
	$adoptedCwd = $false
	if ($targetPath.Length -eq 0) {
		$here = (Get-Location).Path
		$hereEnv = Join-Path $here '.env'
		$hereIsVoxr = (Test-Path -LiteralPath $hereEnv) -and (@(Get-VoxrEnvLines $hereEnv | Where-Object {$_.StartsWith('VOXR_')}).Count -gt 0)
		if (($Update -or $Rollback) -and (Get-VoxrFileLength (Join-Path $here 'docker-compose.yml')) -gt 0 -and $hereIsVoxr) {
			$targetPath = $here
			$adoptedCwd = $true
		} else {
			$targetPath = Join-Path $HOME 'voxr'
		}
	}
	$targetDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($targetPath)
	$envPath = Join-Path $targetDir '.env'
	$backupPath = $BackupDir
	if ($backupPath.Length -eq 0) {
		$backupPath = Join-Path $targetDir 'backups'
	}
	$backupRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($backupPath)
	if ($adoptedCwd) {
		Write-VoxrLine "Acting on the instance in $targetDir, the working directory. Pass -Dir to name another."
	}

	if ($Update -or $Rollback) {
		Assert-VoxrInstance $targetDir $envPath
		if ($Ref.Length -eq 0) {
			$script:Ref = Get-VoxrRefForTag (Get-VoxrEnvValue $envPath 'VOXR_IMAGE_TAG')
			Assert-VoxrDerivedRef $Ref $envPath
		}
		Assert-VoxrComposeFiles $targetDir $envPath
		$project = Get-VoxrComposeProject $targetDir
		if ($project.Length -eq 0) {
			Stop-Voxr "docker-compose.yml in $targetDir declares no project name, so the volume names cannot be derived." $VoxrExitPrerequisite
		}
		Push-Location -LiteralPath $targetDir
		try {
			if ($DryRun) {
				if ($Rollback) {
					Show-VoxrRollbackPlan $targetDir $envPath $backupRoot
				} else {
					Show-VoxrUpdatePlan $targetDir $envPath $backupRoot
				}
				exit 0
			}
			if ($Rollback) {
				Invoke-VoxrRollback $targetDir $envPath $backupRoot
			}
			Invoke-VoxrUpgrade $targetDir $envPath $backupRoot $project
		} finally {
			Pop-Location
		}
		return
	}

	$allowPrompt = $true
	if ($NonInteractive) {
		$allowPrompt = $false
	}
	if ($DryRun) {
		$allowPrompt = $false
	}
	if ([Console]::IsInputRedirected) {
		$allowPrompt = $false
	}

	$domainValue = Resolve-VoxrValue $Domain 'Hostname the instance answers on' '-Domain' $allowPrompt
	$emailValue = Resolve-VoxrValue $Email 'Address to write as VOXR_VAPID_EMAIL' '-Email' $allowPrompt
	Assert-VoxrDomain $domainValue
	Assert-VoxrEmail $emailValue

	if ($Ref.Length -eq 0) {
		$script:Ref = Get-VoxrRefForTag $ImageTag
		Assert-VoxrDerivedRef $Ref $envPath
	}

	if ($DryRun) {
		Write-VoxrLine 'Plan:'
		Write-VoxrLine "  Directory:  $targetDir"
		Write-VoxrLine "  Ref:        $Ref"
		Write-VoxrLine "  Image tag:  $ImageTag"
		Write-VoxrLine "  TLS mode:   $Tls"
		if ($Tls -eq 'proxy') {
			Write-VoxrLine "  Edge bind:  $EdgeBind"
		}
		Write-VoxrLine "  Domain:     $domainValue"
		Write-VoxrLine "  Email:      $emailValue"
		Write-VoxrLine "  Files:      $($VoxrStackFiles -join ', ')"
		Write-VoxrLine "  Secrets:    $($VoxrSecretKeys.Count) generated into .env"
		Write-VoxrLine 'Nothing was written.'
		exit 0
	}

	if (-not (Test-Path -LiteralPath $targetDir)) {
		New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
	}
	if (Test-Path -LiteralPath $envPath) {
		Stop-Voxr "$envPath already exists. Run this script with -Update to upgrade the instance and keep every secret." $VoxrExitRefused
	}

	$staging = New-VoxrStagingDirectory $targetDir
	try {
		Get-VoxrStackFiles $staging $Ref
		Move-VoxrStackFiles $staging $targetDir
	} finally {
		Remove-VoxrStagingDirectory $staging
	}

	Push-Location -LiteralPath $targetDir
	try {
		$vapid = New-VoxrVapidPair
		$lines = @()
		foreach ($entry in $VoxrNonSecretKeys) {
			$value = ''
			if ($entry.Kind -eq 'literal') {
				$value = $entry.Value
			} elseif ($entry.Kind -eq 'domain') {
				$value = $domainValue
			} elseif ($entry.Kind -eq 'email') {
				$value = $emailValue
			} elseif ($entry.Kind -eq 'image_tag') {
				$value = $ImageTag
			} else {
				Stop-Voxr "Unknown source for $($entry.Name)." $VoxrExitUsage
			}
			$lines += "$($entry.Name)=$value"
		}
		if ($Tls -eq 'proxy') {
			$lines += 'COMPOSE_FILE=docker-compose.yml:docker-compose.proxy.yml'
			$lines += "VOXR_EDGE_BIND=$EdgeBind"
		}
		foreach ($entry in $VoxrSecretKeys) {
			$value = ''
			if ($entry.Kind -eq 'hex') {
				$value = ConvertTo-VoxrHex (New-VoxrRandomBytes 32)
			} elseif ($entry.Kind -eq 'base64') {
				$value = [System.Convert]::ToBase64String((New-VoxrRandomBytes 32))
			} elseif ($entry.Kind -eq 'vapid_public') {
				$value = $vapid.Public
			} elseif ($entry.Kind -eq 'vapid_private') {
				$value = $vapid.Private
			} else {
				Stop-Voxr "Unknown generator for $($entry.Name)." $VoxrExitSecret
			}
			$lines += "$($entry.Name)=$value"
		}
		Write-VoxrEnvFile $envPath $lines
		Write-VoxrLine "Wrote $envPath with $($lines.Count) values, readable by the current account only."

		if ($NoStart) {
			Write-VoxrLine "Run docker compose up -d in $targetDir to start the instance."
			Write-VoxrLine "Secrets live in $envPath. Back that file up."
			exit 0
		}

		if ((Invoke-VoxrDocker @('compose', 'up', '-d')) -ne 0) {
			Stop-Voxr 'docker compose up -d failed.' $VoxrExitUnhealthy
		}
		Wait-VoxrStack 'Waiting for the stack to report healthy. The first start pulls images and takes several minutes.'
		$readyOrigin = Get-VoxrPublicOrigin $envPath
		if ($readyOrigin.Length -eq 0) {
			$readyOrigin = "https://$domainValue"
		}
		Test-VoxrPublicHealth $readyOrigin
		Write-VoxrLine "Instance ready at $readyOrigin"
		Write-VoxrLine 'Open it and create the first admin account. Finish the setup wizard in the same sitting.'
		Write-VoxrLine "Secrets live in $envPath. Back that file up."
	} finally {
		Pop-Location
	}
}

try {
	Invoke-VoxrInstall
} catch [System.Management.Automation.PipelineStoppedException] {
	Write-VoxrProblem 'Interrupted.'
	exit $VoxrExitInterrupted
}
