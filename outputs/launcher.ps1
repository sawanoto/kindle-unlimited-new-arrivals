$url = 'http://localhost:3000/'
$app = $PSScriptRoot
$running = $false

try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
    $running = $response.StatusCode -eq 200
} catch {}

if (-not $running) {
    Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WorkingDirectory $app -WindowStyle Hidden

    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 250
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                $running = $true
                break
            }
        } catch {}
    }
}

if ($running) {
    Start-Process $url
    exit 0
}

Add-Type -AssemblyName PresentationFramework
[System.Windows.MessageBox]::Show(
    'Could not start the app. Please check that Node.js is installed.',
    'Kindle New Arrivals'
) | Out-Null
exit 1
