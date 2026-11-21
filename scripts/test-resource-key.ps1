# Windows PowerShell 7. Run as the TEST release owner. The private key stays in CNG.
# The default invocation only reads the public key. Use -Create for initial enrollment.
param([switch]$Create)
$ErrorActionPreference = 'Stop'
$name = 'UVEL-TEST-WGT-ECDSA-P256-v1'
$provider = [System.Security.Cryptography.CngProvider]::MicrosoftSoftwareKeyStorageProvider
if ([System.Security.Cryptography.CngKey]::Exists($name, $provider)) {
    $key = [System.Security.Cryptography.CngKey]::Open($name, $provider)
} elseif ($Create) {
    $options = [System.Security.Cryptography.CngKeyCreationParameters]::new()
    $options.Provider = $provider
    $options.KeyUsage = [System.Security.Cryptography.CngKeyUsages]::Signing
    $options.ExportPolicy = [System.Security.Cryptography.CngExportPolicies]::None
    $key = [System.Security.Cryptography.CngKey]::Create([System.Security.Cryptography.CngAlgorithm]::ECDsaP256, $name, $options)
} else { throw 'No enrolled TEST release key for this Windows user.' }
try {
    if ($key.IsMachineKey -or $key.Algorithm.Algorithm -ne 'ECDSA_P256' -or $key.ExportPolicy -ne 'None') {
        throw 'The TEST signing key must be a non-exportable user-owned P-256 key.'
    }
    $ecdsa = [System.Security.Cryptography.ECDsaCng]::new($key)
    try {
        $public = $ecdsa.ExportParameters($false)
        [ordered]@{
            spki = [Convert]::ToBase64String($ecdsa.ExportSubjectPublicKeyInfo())
            sec1 = '04' + [Convert]::ToHexString($public.Q.X).ToLowerInvariant() + [Convert]::ToHexString($public.Q.Y).ToLowerInvariant()
        } | ConvertTo-Json -Compress
    } finally { $ecdsa.Dispose() }
} finally { $key.Dispose() }
