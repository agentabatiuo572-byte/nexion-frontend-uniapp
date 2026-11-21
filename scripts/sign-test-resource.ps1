# PowerShell 7, Android TEST resource release. Inputs come from an approved, reproducible TEST build.
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$HostApk,
    [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$HostSha256,
    [Parameter(Mandatory)][string]$HostResources,
    [Parameter(Mandatory)][string]$Resources,
    [Parameter(Mandatory)][string]$ApkSignerJar,
    [Parameter(Mandatory)][string]$Aapt2,
    [Parameter(Mandatory)][string]$Java,
    [Parameter(Mandatory)][string]$OutputDirectory,
    [ValidatePattern('^[a-f0-9]{64}$')][string]$DebugDeviceJsSha256
)
$ErrorActionPreference = 'Stop'
$trust = Get-Content -Raw -LiteralPath "$PSScriptRoot/../src/services/test-resource-trust.json" | ConvertFrom-Json
$pub = & "$PSScriptRoot/test-resource-key.ps1" | ConvertFrom-Json
if ($pub.sec1 -cne $trust.publicKey) { throw 'The enrolled key does not match the public key pinned in the App.' }
$HostApk = (Resolve-Path -LiteralPath $HostApk).Path
$HostResources = (Resolve-Path -LiteralPath $HostResources).Path
$Resources = (Resolve-Path -LiteralPath $Resources).Path
if ((Get-FileHash -LiteralPath $HostApk).Hash.ToLowerInvariant() -cne $HostSha256) { throw 'The baseline APK does not match its approved TEST receipt.' }
$verified = & $Java -jar $ApkSignerJar verify --print-certs $HostApk
$certificates = @($verified | Select-String '^Signer #\d+ certificate SHA-256 digest: (.+)$')
# Enroll a reviewed, TEST-exclusive product-host certificate here when that host exists.
$productTestCertificate = ''
$sharedProductionCertificate = '38066bdb885ce8b52e29af497a32972c21ffcc421f122198fad02a21d02666e1'
$cert = if ($DebugDeviceJsSha256) { 'd75c1fa2b9ae867ce688a8adc6deac7cd6ba96f43a751fd10a200fa5974ac636' } else { $productTestCertificate }
if ($cert -cnotmatch '^[0-9a-f]{64}$' -or $cert -ceq $sharedProductionCertificate) {
    throw 'Product-host resource signing is on hold until a TEST-exclusive Android certificate is enrolled.'
}
if ($LASTEXITCODE -ne 0 -or $certificates.Count -ne 1 -or $certificates[0].Matches[0].Groups[1].Value -cne $cert) {
    throw 'The host APK must carry the approved Android TEST signing identity.'
}
$package = (& $Aapt2 dump badging $HostApk | Select-String '^package:' | Select-Object -First 1).Line
if ($LASTEXITCODE -ne 0 -or $package -notmatch "^package: name='([^']+)' versionCode='([0-9]+)'") { throw 'Cannot identify the Android host.' }
$androidPackage = $Matches[1]
$nativeBuild = [int]$Matches[2]
$base = Get-Content -LiteralPath "$HostResources/manifest.json" -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable
$manifest = Get-Content -LiteralPath "$Resources/manifest.json" -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable
$id = $trust.appId
if ($DebugDeviceJsSha256) {
    $id = 'HBuilder'
    if ($androidPackage -cne 'io.dcloud.HBuilder' -or $nativeBuild -ne 1532 -or $HostSha256 -cne 'dc7d73c33a14a15c77795d9e950c31fee705d976cf03f091194c60e868b19b39' -or
        $base.plus.'uni-app'.compilerVersion -cne '5.32' -or $manifest.id -cnotin @('','HBuilder') -or $base.id -cnotin @('','HBuilder') -or
        (Get-FileHash -LiteralPath "$HostResources/app-service.js").Hash.ToLowerInvariant() -cne $DebugDeviceJsSha256) {
        throw 'The Samsung debug host, runtime, or live device resource digest does not match the TEST baseline.'
    }
    $base.id = $id
    $manifest.id = $id
} elseif ($androidPackage -cne 'ai.uvel.app' -or $manifest.id -cne $id -or $base.id -cne $id) { throw 'The resource application ID does not match TEST.' }
$versionName = [string]$manifest.version.name
$resourceBuild = [int]$manifest.version.code
if ($versionName -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$' -or $resourceBuild -le [int]$base.version.code) { throw 'The release needs a newer numeric resource build.' }

# Bind the frozen build directory to the signed APK rather than trusting a directory name.
if (!$DebugDeviceJsSha256) {
$apk = [IO.Compression.ZipFile]::OpenRead($HostApk)
try {
    $prefix = 'assets/apps/' + $trust.appId + '/www/'
    foreach ($name in @('app-service.js','app-config-service.js','uni-app-view.umd.js','__uniappview.html')) {
        $member = $apk.GetEntry($prefix + $name)
        if (!$member) { throw "The host APK does not include $name." }
        $stream = $member.Open()
        try { $digest = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($stream)) }
        finally { $stream.Dispose() }
        if ((Get-FileHash -LiteralPath (Join-Path $HostResources $name)).Hash -cne $digest) { throw "The baseline differs from the signed APK at $name." }
    }
    $manifestEntry = $apk.GetEntry($prefix + 'manifest.json')
    if (!$manifestEntry) { throw 'Missing signed host manifest.' }
    $reader = [IO.StreamReader]::new($manifestEntry.Open(),[Text.Encoding]::UTF8)
    try { $apkManifest = $reader.ReadToEnd() | ConvertFrom-Json -AsHashtable } finally { $reader.Dispose() }
    if ($apkManifest.id -cne $base.id -or [int]$apkManifest.version.code -ne [int]$base.version.code -or $apkManifest.plus.compilerVersion -ne $base.plus.compilerVersion) {
        throw 'The baseline resource manifest does not identify this signed host.'
    }
} finally { $apk.Dispose() }
}

$wgtManifest = $manifest | ConvertTo-Json -Depth 80 -Compress
$base.Remove('version')
$manifest.Remove('version')
if (($base | ConvertTo-Json -Depth 80 -Compress) -cne ($manifest | ConvertTo-Json -Depth 80 -Compress)) {
    throw 'Native configuration or compiler changed. Build a new host APK.'
}
function Read-Outputs([string]$root) {
    $files = [Collections.Generic.SortedDictionary[string,string]]::new([StringComparer]::Ordinal)
    foreach ($item in Get-ChildItem -LiteralPath $root -Force -Recurse) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked build inputs are not accepted.' }
        if (!$item.PSIsContainer) {
            $name = [IO.Path]::GetRelativePath($root,$item.FullName).Replace('\','/')
            $files.Add($name,$item.FullName)
        }
    }
    return ,$files
}
$old = Read-Outputs $HostResources
$new = Read-Outputs $Resources
$runtimePaths = @($old.Keys; $new.Keys) | Sort-Object -Unique -CaseSensitive
foreach ($name in $runtimePaths) {
    # This signer only emits Android artifacts. The iOS compiler output never enters an Android WGT.
    if ($name -cmatch '^uni_modules/[^/]+/utssdk/app-ios/') { continue }
    if ($name -cmatch '^(uni_modules/|__uniapp[^/]*$|uni-app-view\.umd\.js$)') {
        if (!$old.ContainsKey($name) -or !$new.ContainsKey($name) -or
            (Get-FileHash -LiteralPath $old[$name]).Hash -cne (Get-FileHash -LiteralPath $new[$name]).Hash) {
            throw "Native module or runtime changed at $name. Build a new host APK."
        }
    }
}

[void][IO.Directory]::CreateDirectory($OutputDirectory)
$tmp = Join-Path $OutputDirectory ('.' + [Guid]::NewGuid() + '.wgt')
try {
    $zip = [IO.Compression.ZipFile]::Open($tmp,[IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($entry in $new.GetEnumerator()) {
            # Native sources are compared above and are never installed from WGT.
            if ($entry.Key.StartsWith('uni_modules/')) { continue }
            if ($DebugDeviceJsSha256 -and $entry.Key -ceq 'manifest.json') {
                $member = $zip.CreateEntry('manifest.json')
                $member.LastWriteTime = [DateTimeOffset]'2000-01-01T00:00:00Z'
                $stream = $member.Open()
                try { $stream.Write([Text.Encoding]::UTF8.GetBytes($wgtManifest)) } finally { $stream.Dispose() }
                continue
            }
            if ($entry.Key -cnotmatch '^[\w./@+ -]+\.(js|css|html|json|png|webp|jpg|jpeg|gif|svg|ico|woff2?|ttf|otf|wav|mp3|md|txt)$' -or
                $entry.Key -cmatch '(^|/)\.|(^|/)(AndroidManifest\.xml|Info\.plist)$') { throw "Unexpected resource: $($entry.Key)" }
            $member = $zip.CreateEntry($entry.Key,[IO.Compression.CompressionLevel]::Optimal)
            $member.LastWriteTime = [DateTimeOffset]'2000-01-01T00:00:00Z'
            $source = [IO.File]::OpenRead($entry.Value)
            try {
                $stream = $member.Open()
                try { $source.CopyTo($stream) } finally { $stream.Dispose() }
            } finally { $source.Dispose() }
        }
    } finally { $zip.Dispose() }
    $size = (Get-Item -LiteralPath $tmp).Length
    if ($size -lt 1 -or $size -gt 32MB) { throw 'WGT exceeds the TEST transfer limit.' }
    $hash = (Get-FileHash -LiteralPath $tmp).Hash.ToLowerInvariant()
    $payload = @('uvel-test-resource-v1','android',$id,$versionName,$resourceBuild,$nativeBuild,$nativeBuild,$size,$hash) -join [char]10
    $key = [Security.Cryptography.CngKey]::Open('UVEL-TEST-WGT-ECDSA-P256-v1',[Security.Cryptography.CngProvider]::MicrosoftSoftwareKeyStorageProvider)
    try {
        $signer = [Security.Cryptography.ECDsaCng]::new($key)
        try {
            $signature = $signer.SignData([Text.Encoding]::UTF8.GetBytes($payload),[Security.Cryptography.HashAlgorithmName]::SHA256,
                [Security.Cryptography.DSASignatureFormat]::IeeeP1363FixedFieldConcatenation)
        } finally { $signer.Dispose() }
    } finally { $key.Dispose() }
    $record = [ordered]@{
        artifactId="android-resource-$hash"; platform='android'; updateType='resource'; appId=$id; versionName=$versionName; latestBuild=$resourceBuild
        minNativeBuild=$nativeBuild; maxNativeBuild=$nativeBuild; sizeBytes=$size; sha256=$hash; signature=[Convert]::ToHexString($signature).ToLowerInvariant()
        downloadUrl=($trust.origin + '/app-updates/android/' + $hash + '.wgt')
    }
    $destination = Join-Path $OutputDirectory ($hash + '.wgt')
    if (!(Test-Path -LiteralPath $destination)) { [IO.File]::Move($tmp,$destination) }
    elseif ((Get-FileHash -LiteralPath $destination).Hash.ToLowerInvariant() -cne $hash) { throw 'Existing content-addressed output has an invalid digest.' }
    $json = $record | ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $OutputDirectory ($hash + '.json')),$json)
    $json
} finally {
    if (Test-Path -LiteralPath $tmp) { [IO.File]::Delete($tmp) }
}
