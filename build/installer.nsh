; ============================================================
; M2_PROMPT - custom NSIS hooks for electron-builder
;
;   customInstall   : after files are copied, (re)register the Explorer
;                     right-click "open project in M2_PROMPT" menu so it points
;                     at the freshly INSTALLED M2_PROMPT.exe. The helper removes
;                     any previous entry (dev checkout or older install) first,
;                     guaranteeing the menu never points at a stale path.
;   customUnInstall : remove the right-click menu registry keys.
;
; electron-builder automatically !includes this file (build/installer.nsh) into
; the generated installer script when it exists - no config needed.
;
; This file is intentionally PURE ASCII. The Chinese menu label is produced from
; Unicode code points inside context-menu.ps1, so no non-ASCII bytes ever live
; in this .nsh (avoids mojibake).
; ============================================================

!macro customInstall
  DetailPrint "Registering the M2_PROMPT Explorer right-click menu..."
  ; context-menu.ps1 is shipped next to the exe (extraFiles). It deletes any
  ; existing M2_PROMPT menu keys, then writes new ones pointing at -Launcher.
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\context-menu.ps1" -Launcher "$INSTDIR\M2_PROMPT.exe" -Icon "$INSTDIR\M2_PROMPT.exe"'
  Pop $0
  DetailPrint "Context-menu registration exit code: $0"
!macroend

!macro customUnInstall
  DetailPrint "Removing the M2_PROMPT Explorer right-click menu..."
  ; Delete the HKCU keys directly. Key paths are ASCII, so this is encoding safe
  ; and does not depend on the helper script still being present.
  DeleteRegKey HKCU "Software\Classes\Directory\shell\M2_PROMPT"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\M2_PROMPT"
!macroend
