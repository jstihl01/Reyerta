param(
    [string]$Url = "http://127.0.0.1:8000",
    [int]$Port = 9226
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

function Dispatch-Key {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [ref]$Id,
        [string]$Code,
        [string]$Key
    )

    $Id.Value++
    Send-Cdp $Socket $Id.Value "Input.dispatchKeyEvent" @{
        type = "keyDown"
        code = $Code
        key = $Key
        windowsVirtualKeyCode = [int][char]$Key.ToUpperInvariant()
        nativeVirtualKeyCode = [int][char]$Key.ToUpperInvariant()
    } | Out-Null
}

function Release-Key {
    param(
        [System.Net.WebSockets.ClientWebSocket]$Socket,
        [ref]$Id,
        [string]$Code,
        [string]$Key
    )

    $Id.Value++
    Send-Cdp $Socket $Id.Value "Input.dispatchKeyEvent" @{
        type = "keyUp"
        code = $Code
        key = $Key
        windowsVirtualKeyCode = [int][char]$Key.ToUpperInvariant()
        nativeVirtualKeyCode = [int][char]$Key.ToUpperInvariant()
    } | Out-Null
}

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$profile = Join-Path (Get-Location) ".chrome-local-smoke-profile"
$screenshots = Join-Path (Get-Location) "screenshots"

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
    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

    $id = 1
    Send-Cdp $socket $id "Page.enable" | Out-Null
    $id++
    Send-Cdp $socket $id "Runtime.enable" | Out-Null
    $id++
    Send-Cdp $socket $id "Page.navigate" @{ url = "$Url/usuarios/login/" } | Out-Null
    Start-Sleep -Seconds 1

    $username = "smoke_local"
    $password = "ClaveSegura123"
    $id++
    Send-Cdp $socket $id "Runtime.evaluate" @{
        expression = "fetch('/usuarios/registro/', {credentials:'same-origin'}).then(()=>true)"
        returnByValue = $true
        awaitPromise = $true
    } | Out-Null
    $id++
    Send-Cdp $socket $id "Page.navigate" @{ url = "$Url/local/" } | Out-Null
    Start-Sleep -Seconds 1

    $id++
    $redirectInfo = Send-Cdp $socket $id "Runtime.evaluate" @{
        expression = "location.pathname"
        returnByValue = $true
    }

    if ($redirectInfo.result.result.value -ne "/local/") {
        $id++
        Send-Cdp $socket $id "Page.navigate" @{ url = "$Url/usuarios/registro/" } | Out-Null
        Start-Sleep -Seconds 1
        $id++
        Send-Cdp $socket $id "Runtime.evaluate" @{
            expression = "document.querySelector('#id_username').value='$username'+Date.now();document.querySelector('#id_password1').value='$password';document.querySelector('#id_password2').value='$password';document.querySelector('form').requestSubmit();"
            returnByValue = $true
        } | Out-Null
        Start-Sleep -Seconds 2
        $id++
        Send-Cdp $socket $id "Page.navigate" @{ url = "$Url/local/" } | Out-Null
        Start-Sleep -Seconds 1
    }

    Dispatch-Key $socket ([ref]$id) "KeyD" "d"
    Start-Sleep -Milliseconds 250
    Dispatch-Key $socket ([ref]$id) "KeyJ" "j"
    Start-Sleep -Milliseconds 250
    Release-Key $socket ([ref]$id) "KeyJ" "j"
    Dispatch-Key $socket ([ref]$id) "KeyL" "l"
    Start-Sleep -Milliseconds 250
    Release-Key $socket ([ref]$id) "KeyL" "l"
    Release-Key $socket ([ref]$id) "KeyD" "d"
    Start-Sleep -Milliseconds 350

    $id++
    $info = Send-Cdp $socket $id "Runtime.evaluate" @{
        expression = "JSON.stringify({path:location.pathname, readout:document.querySelector('#input-readout')?.innerText, canvasBlank:(()=>{const c=document.querySelector('#fight-canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let sum=0;for(let i=0;i<d.length;i+=997){sum+=d[i]+d[i+1]+d[i+2]+d[i+3]}return sum===0})(), overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth})"
        returnByValue = $true
    }

    $id++
    $screenshot = Send-Cdp $socket $id "Page.captureScreenshot" @{ format = "png"; captureBeyondViewport = $true }
    [IO.File]::WriteAllBytes((Join-Path $screenshots "local-fight-input-smoke.png"), [Convert]::FromBase64String($screenshot.result.data))

    [pscustomobject]@{
        Info = $info.result.result.value
    } | ConvertTo-Json -Depth 4
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
