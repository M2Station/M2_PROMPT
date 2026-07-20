'
' M2_PROMPT
' Copyright (c) 2026 OA Hsiao
' SPDX-License-Identifier: MIT
'
' This source code is licensed under the MIT License found in the
' LICENSE file in the root directory of this source tree.
'
' ============================================================
' M2_PROMPT - launch the dev app with NO visible console window.
'
' Used by the Explorer right-click menu in a dev checkout: the menu points at
'   wscript.exe //nologo "run-hidden.vbs" "%1"
' so the M2_PROMPT.cmd launcher (npm / Electron) runs hidden and the folder
' passed as the first argument is forwarded to the app to auto-open as a
' project. Installed builds launch M2_PROMPT.exe directly and do not use this.
' ============================================================
Option Explicit
Dim sh, fso, scriptDir, launcher, arg
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
launcher = """" & scriptDir & "\M2_PROMPT.cmd" & """"
arg = ""
If WScript.Arguments.Count > 0 Then
  arg = " """ & WScript.Arguments(0) & """"
End If
' Window style 0 = hidden, do not wait for the launcher to finish.
sh.Run launcher & arg, 0, False
