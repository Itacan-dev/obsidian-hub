param([Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][string]$ExpectedHash,[Parameter(Mandatory=$true)][string]$ProposedHash,[Parameter(Mandatory=$true)][string]$ProposedBase64)
$ErrorActionPreference = 'Stop'
$stream = $null
try {
    $stream = [System.IO.File]::Open($Source,[System.IO.FileMode]::Open,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None)
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    $actual = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-','').ToLowerInvariant()
    if ($actual -ne $ExpectedHash) { throw 'Source changed before exclusive acquisition.' }
    $bytes = [Convert]::FromBase64String($ProposedBase64)
    $after = [BitConverter]::ToString($hasher.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()
    if ($after -ne $ProposedHash) { throw 'Proposed bytes changed.' }
    [Console]::Out.WriteLine('LOCKED'); [Console]::Out.Flush()
    $instruction = [Console]::ReadLine()
    if ($instruction -eq 'RETIRE') {
        $stream.Position = 0; $stream.Write($bytes,0,$bytes.Length); $stream.SetLength($bytes.Length); $stream.Flush($true)
        $stream.Position = 0
        $actual = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-','').ToLowerInvariant()
        if ($actual -ne $ProposedHash) { throw 'Source write verification failed.' }
        [Console]::Out.WriteLine('RETIRED'); [Console]::Out.Flush()
        [void][Console]::ReadLine()
    }
} finally { if ($null -ne $stream) { $stream.Dispose() } }
