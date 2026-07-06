param(
    [string]$Url = "http://127.0.0.1:8000",
    [int]$Port = 9222,
    [switch]$NoLaunch
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
    $segment = [ArraySegment[byte]]::new($bytes)
    $null = $Socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

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

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$profile = Join-Path (Get-Location) ".chrome-smoke-profile"
$desktopShot = Join-Path (Get-Location) "screenshots\home-cdp-desktop.png"

New-Item -ItemType Directory -Force screenshots | Out-Null
New-Item -ItemType Directory -Force $profile | Out-Null

$chromeArgs = @(
    "--headless=new",
    "--disable-gpu",
    "--remote-debugging-port=$Port",
    "--user-data-dir=$profile",
    "--window-size=1440,1000",
    "about:blank"
)

$quotedProfile = '"' + $profile + '"'
$process = $null
if (-not $NoLaunch) {
    $chromeArgs[3] = "--user-data-dir=$quotedProfile"
    $process = Start-Process -FilePath $chrome -ArgumentList ($chromeArgs -join " ") -PassThru
}

try {
    $version = $null
    foreach ($attempt in 1..20) {
        Start-Sleep -Milliseconds 500
        try {
            $version = Invoke-RestMethod "http://127.0.0.1:$Port/json/version"
            break
        }
        catch {
            if ($process -and $process.HasExited) {
                throw "Chrome exited before DevTools became available."
            }
        }
    }
    if (-not $version) {
        throw "Chrome DevTools was not available on port $Port."
    }
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
    Send-Cdp $socket $id "Page.navigate" @{ url = $Url } | Out-Null
    Start-Sleep -Seconds 2

    $id++
    $info = Send-Cdp $socket $id "Runtime.evaluate" @{
        expression = "JSON.stringify({title:document.title,h1:document.querySelector('h1')?.innerText,links:[...document.querySelectorAll('a')].map(a=>a.innerText.trim()),overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth})"
        returnByValue = $true
    }

    $id++
    Send-Cdp $socket $id "Input.dispatchKeyEvent" @{ type = "keyDown"; key = "Tab"; code = "Tab"; windowsVirtualKeyCode = 9; nativeVirtualKeyCode = 9 } | Out-Null
    $id++
    Send-Cdp $socket $id "Input.dispatchKeyEvent" @{ type = "keyUp"; key = "Tab"; code = "Tab"; windowsVirtualKeyCode = 9; nativeVirtualKeyCode = 9 } | Out-Null
    Start-Sleep -Milliseconds 250

    $id++
    $focus1 = Send-Cdp $socket $id "Runtime.evaluate" @{
        expression = "document.activeElement?.innerText?.trim() || document.activeElement?.tagName"
        returnByValue = $true
    }

    $id++
    Send-Cdp $socket $id "Input.dispatchKeyEvent" @{ type = "keyDown"; key = "Tab"; code = "Tab"; windowsVirtualKeyCode = 9; nativeVirtualKeyCode = 9 } | Out-Null
    $id++
    Send-Cdp $socket $id "Input.dispatchKeyEvent" @{ type = "keyUp"; key = "Tab"; code = "Tab"; windowsVirtualKeyCode = 9; nativeVirtualKeyCode = 9 } | Out-Null
    Start-Sleep -Milliseconds 250

    $id++
    $focus2 = Send-Cdp $socket $id "Runtime.evaluate" @{
        expression = "document.activeElement?.innerText?.trim() || document.activeElement?.tagName"
        returnByValue = $true
    }

    $id++
    $screenshot = Send-Cdp $socket $id "Page.captureScreenshot" @{ format = "png"; captureBeyondViewport = $true }
    [IO.File]::WriteAllBytes($desktopShot, [Convert]::FromBase64String($screenshot.result.data))

    [pscustomobject]@{
        PageInfo = $info.result.result.value
        FirstTabFocus = $focus1.result.result.value
        SecondTabFocus = $focus2.result.result.value
        Screenshot = $desktopShot
    } | ConvertTo-Json -Depth 6
}
finally {
    if ($socket) {
        $socket.Dispose()
    }
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force
    }
}
