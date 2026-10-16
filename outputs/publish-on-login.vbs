Option Explicit
Dim shell, fso, appDir, nodePath
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodePath = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
shell.CurrentDirectory = appDir
shell.Run """" & nodePath & """ """ & appDir & "\publish-on-login.js"" --startup", 0, False
