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

    $selectorState = $null
    foreach ($attempt in 1..30) {
        Start-Sleep -Milliseconds 200
        $id++
        $candidate = Send-Cdp $socket $id "Runtime.evaluate" @{
            expression = "JSON.stringify(window.__reyertaLocalFight?.getState?.() || null)"
            returnByValue = $true
        }
        if ($candidate.result.result.value -and $candidate.result.result.value -ne "null") {
            $selectorState = $candidate
            break
        }
    }

    if (-not $selectorState) {
        throw "Local fight diagnostics were not available."
    }

    $selector = $selectorState.result.result.value | ConvertFrom-Json
    if ($selector.gamePhase -ne "select") {
        throw "Expected character select phase but got $($selector.gamePhase)."
    }

    $id++
    Send-Cdp $socket $id "Runtime.evaluate" @{
        expression = "document.querySelector('.messages')?.remove()"
        returnByValue = $true
    } | Out-Null

    $id++
    $selectorScreenshot = Send-Cdp $socket $id "Page.captureScreenshot" @{ format = "png"; captureBeyondViewport = $true }
    [IO.File]::WriteAllBytes((Join-Path $screenshots "local-character-select-smoke.png"), [Convert]::FromBase64String($selectorScreenshot.result.data))

    $id++
    Send-Cdp $socket $id "Runtime.evaluate" @{
        expression = "window.__reyertaLocalFight.selectCharacter('rizo')"
        returnByValue = $true
    } | Out-Null

    $initialState = $null
    foreach ($attempt in 1..30) {
        Start-Sleep -Milliseconds 200
        $id++
        $candidate = Send-Cdp $socket $id "Runtime.evaluate" @{
            expression = "JSON.stringify(window.__reyertaLocalFight?.getState?.() || null)"
            returnByValue = $true
        }
        if ($candidate.result.result.value -and $candidate.result.result.value -ne "null") {
            $state = $candidate.result.result.value | ConvertFrom-Json
            if ($state.player -and $state.player.id -eq "rizo" -and $state.cpu.id -eq "nara") {
                $initialState = $candidate
                break
            }
        }
    }

    if (-not $initialState) {
        throw "Local fight did not start with Rizo vs Nara."
    }

    Start-Sleep -Seconds 1

    Dispatch-Key $socket ([ref]$id) "KeyD" "d"
    foreach ($step in 1..12) {
        Start-Sleep -Milliseconds 140
        $id++
        $distanceInfo = Send-Cdp $socket $id "Runtime.evaluate" @{
            expression = "Math.abs(window.__reyertaLocalFight.getState().cpu.x - window.__reyertaLocalFight.getState().player.x)"
            returnByValue = $true
        }
        if ($distanceInfo.result.result.value -lt 170) {
            break
        }
    }
    Release-Key $socket ([ref]$id) "KeyD" "d"

    foreach ($attack in @("KeyJ", "KeyK", "KeyJ")) {
        $key = $attack.Substring(3).ToLowerInvariant()
        Dispatch-Key $socket ([ref]$id) $attack $key
        Start-Sleep -Milliseconds 120
        Release-Key $socket ([ref]$id) $attack $key
        Start-Sleep -Milliseconds 420
    }

    Dispatch-Key $socket ([ref]$id) "KeyL" "l"
    Start-Sleep -Milliseconds 180
    Release-Key $socket ([ref]$id) "KeyL" "l"
    Start-Sleep -Milliseconds 350

    $id++
    $info = Send-Cdp $socket $id "Runtime.evaluate" @{
        expression = "JSON.stringify({path:location.pathname, readout:document.querySelector('#input-readout')?.innerText, state:window.__reyertaLocalFight.getState(), canvasBlank:(()=>{const c=document.querySelector('#fight-canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let sum=0;for(let i=0;i<d.length;i+=997){sum+=d[i]+d[i+1]+d[i+2]+d[i+3]}return sum===0})(), overflowX:document.documentElement.scrollWidth>document.documentElement.clientWidth})"
        returnByValue = $true
    }

    $initial = $initialState.result.result.value | ConvertFrom-Json
    $result = $info.result.result.value | ConvertFrom-Json
    if ($result.path -ne "/local/") {
        throw "Expected /local/ but got $($result.path)."
    }
    if ($result.canvasBlank) {
        throw "Fight canvas is blank."
    }
    if ($result.overflowX) {
        throw "Page has horizontal overflow."
    }
    if ($result.state.gamePhase -ne "fight" -and $result.state.gamePhase -ne "ended") {
        throw "Expected fight or ended phase but got $($result.state.gamePhase)."
    }
    if ($result.state.player.id -ne "rizo" -or $result.state.cpu.id -ne "nara") {
        throw "Expected Rizo vs Nara, got $($result.state.player.id) vs $($result.state.cpu.id)."
    }
    if ($result.state.player.x -le $initial.player.x) {
        throw "Player did not move forward."
    }
    if (($result.state.player.health -ge $initial.player.health) -and ($result.state.cpu.health -ge $initial.cpu.health)) {
        throw "No combat damage was registered."
    }

    $id++
    Send-Cdp $socket $id "Runtime.evaluate" @{
        expression = "document.querySelector('.messages')?.remove()"
        returnByValue = $true
    } | Out-Null

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
