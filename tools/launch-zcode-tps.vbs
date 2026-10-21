Option Explicit

Dim sh, fso, exe, injector, nodeExe, svc, procs, here, cfg, json, re, f
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

here = fso.GetParentFolderName(WScript.ScriptFullName)
injector = fso.BuildPath(here, "injector.mjs")
cfg = fso.BuildPath(fso.GetParentFolderName(here), "config.local.json")

exe = ""
If fso.FileExists(cfg) Then
  Set f = fso.OpenTextFile(cfg, 1)
  json = f.ReadAll
  f.Close
  Set re = New RegExp
  re.Pattern = """zcodeExe""\s*:\s*""([^""]+)"""
  If re.Test(json) Then exe = re.Execute(json)(0).SubMatches(0)
End If
If exe = "" Then exe = sh.ExpandEnvironmentStrings("%ZCODE_EXE%")
If exe = "%ZCODE_EXE%" Then exe = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\ZCode\ZCode.exe")

nodeExe = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then nodeExe = "node"

If Not fso.FileExists(exe) Then
  MsgBox "ZCode.exe not found:" & vbCrLf & exe & vbCrLf & vbCrLf & _
         "Set ZCODE_EXE or config.local.json.", 16, "ZCode TPS"
  WScript.Quit 1
End If

If Not fso.FileExists(injector) Then
  MsgBox "injector.mjs not found:" & vbCrLf & injector, 16, "ZCode TPS"
  WScript.Quit 1
End If

Set svc = GetObject("winmgmts:\\.\root\cimv2")
Set procs = svc.ExecQuery("SELECT ProcessId FROM Win32_Process WHERE Name='ZCode.exe'")
If procs.Count > 0 Then
  MsgBox "ZCode is already running." & vbCrLf & vbCrLf & _
         "Quit it completely from the tray first, then run this shortcut again.", 48, "ZCode TPS"
  WScript.Quit 1
End If

' Injector first: it polls 127.0.0.1:9222 until ZCode is up.
sh.Run """" & nodeExe & """ """ & injector & """ 9222", 0, False

' Remote debugging listens on localhost only.
sh.Run """" & exe & """ --remote-debugging-port=9222", 1, False
