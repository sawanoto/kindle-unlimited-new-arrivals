Option Explicit

Dim shell, fso, appDir, url, running, attempt
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
url = "http://localhost:3000/"
running = ServerIsReady(url)

If Not running Then
    shell.Run "cmd.exe /c cd /d """ & appDir & """ && node.exe server.js", 0, False

    For attempt = 1 To 30
        WScript.Sleep 250
        If ServerIsReady(url) Then
            running = True
            Exit For
        End If
    Next
End If

If running Then
    shell.Run url, 1, False
Else
    MsgBox "Could not start the app. Please check that Node.js is installed.", 16, "Kindle New Arrivals"
End If

Function ServerIsReady(address)
    Dim request
    On Error Resume Next
    Err.Clear
    Set request = CreateObject("WinHttp.WinHttpRequest.5.1")
    request.SetTimeouts 500, 500, 500, 500
    request.Open "GET", address, False
    request.Send
    ServerIsReady = (Err.Number = 0 And request.Status = 200)
    Err.Clear
    On Error GoTo 0
End Function
