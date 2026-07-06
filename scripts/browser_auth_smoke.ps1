param(
    [string]$Url = "http://127.0.0.1:8000",
    [int]$Port = 9225
)

$ErrorActionPreference = "Stop"

function Send-Cdp {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [int]$Id,
        [string]$Method,
        [hashtable]$Params = @{}
    )

    $payload = @{ id = $Id; method = $Method; params = $Params } | ConvertTo-Json -Depth 12 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $null = $Socket.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

    while ($true) {
        $chunks = New-Object System.Collections.Generic.List[byte]
        do {
            $buffer = [byte[]]::new(65536)
            $result = $Socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
            if ($result.Count -gt 0) {
                $chunks.AddRange([ArraySegment[byte]]::new($buffer, 0, $result.Count))
            }
        } while (-not $result.EndOfMessage)

        $text = [System.Text.Encoding]::UTF8.GetString($chunks.ToArray())
        if (-not [string]::IsNullOrWhiteSpace($text)) {
            $message = $text | ConvertFrom-Json
            if ($message.id -eq $Id) {
                return $message
            }
        }
    }
}

function Wait-For-DevTools {
    param([int]$Port, [System.Diagnostics.Process]$Process)

    foreach ($attempt in 1..30) {
        Start-Sleep -Milliseconds 500
        try {
            return Invoke-RestMethod "http://127.0.0.1:$Port/json/version"
        }
        catch {
            if ($Process.HasExited) {
                throw "Chrome exited before DevTools became available."
            }
        }
    }

    throw "Chrome DevTools was not available on port $Port."
}

function Save-Screenshot {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [ref]$Id,
        [string]$Path
    )

    $Id.Value++
    $screenshot = Send-Cdp $Socket $Id.Value "Page.captureScreenshot" @{ format = "png"; captureBeyondViewport = $true }
    [IO.File]::WriteAllBytes($Path, [Convert]::FromBase64String($screenshot.result.data))
}

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$profile = Join-Path (Get-Location) ".chrome-auth-smoke-profile"
$screenshots = Join-Path (Get-Location) "screenshots"
$userName = "smoke_$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
$password = "ClaveSegura123"

New-Item -ItemType Directory -Force $screenshots | Out-Null
New-Item -ItemType Directory -Force $profile | Out-Null

$chromeArgs = @(
    "--headless=new",
    "--disable-gpu",
    "--remote-debugging-port=$Port",
    "--user-data-dir=""$profile""",
    "--window-size=1440,1000",
    "about:blank"
)

$process = Start-Process -FilePath $chrome -ArgumentList ($chromeArgs -join " ") -PassThru

try {
    Wait-For-DevTools $Port $process | Out-Null
    $targets = Invoke-RestMethod "http://127.0.0.1:$Port/json/list"
    $target = $targets | Where-Object { $_.type -eq "page" } | Select-Object -First 1
    if (-not $target) {
        throw "No page target was available on port $Port."
    }

    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

    $id = 1
    Send-Cdp $socket $id "Page.enable" | Out-Null
    $id++
    Send-Cdp $socket $id "Runtime.enable" | Out-Null

    $id++
    Send-Cdp $socket $id "Page.navigate" @{ url = "$Url/usuarios/registro/" } | Out-Null
    Start-Sleep -Seconds 2

    Save-Screenshot $socket ([ref]$id) (Join-Path $screenshots "auth-registro.png")

    $id++
    Send-Cdp $socket $id "Runtime.evaluate" @{
        expression = "document.querySelector('#id_username').value='$userName';document.querySelector('#id_email').value='$userName@example.com';document.querySelector('#id_password1').value='$password';document.querySelector('#id_password2').value='$password';document.querySelector('form').requestSubmit();"
        returnByValue = $true
    } | Out-Null
    Start-Sleep -Seconds 2

    Save-Screenshot $socket ([ref]$id) (Join-Path $screenshots "auth-home-logged-in.png")

    $id++
    $homeInfo = Send-Cdp $socket $id "Runtime.evaluate" @{
        expression = "JSON.stringify({url:location.pathname,h1:document.querySelector('h1')?.innerText,body:document.body.innerText,overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth})"
        returnByValue = $true
    }

    $id++
    Send-Cdp $socket $id "Page.navigate" @{ url = "$Url/local/" } | Out-Null
    Start-Sleep -Seconds 1

    Save-Screenshot $socket ([ref]$id) (Join-Path $screenshots "auth-local-placeholder.png")

    $id++
    $localInfo = Send-Cdp $socket $id "Runtime.evaluate" @{
        expression = "JSON.stringify({url:location.pathname,h1:document.querySelector('h1')?.innerText,body:document.body.innerText,overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth})"
        returnByValue = $true
    }

    [pscustomobject]@{
        User = $userName
        HomeInfo = $homeInfo.result.result.value
        LocalInfo = $localInfo.result.result.value
    } | ConvertTo-Json -Depth 6
}
finally {
    if ($socket) {
        $socket.Dispose()
    }
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
    Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue
}
