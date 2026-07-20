#
# M2_PROMPT
# Copyright (c) 2026 OA Hsiao
# SPDX-License-Identifier: MIT
#
# This source code is licensed under the MIT License found in the
# LICENSE file in the root directory of this source tree.
#

# ============================================================
# M2_PROMPT - Windows Explorer right-click menu installer
#
# Adds an HKCU (current-user, no admin) context-menu entry so that
# right-clicking a folder - or the empty space inside a folder -
# launches M2_PROMPT with that folder auto-loaded as a project,
# ready to edit.
#
#   Install (dev) :  powershell -ExecutionPolicy Bypass -File context-menu.ps1
#   Install (app) :  ... -File context-menu.ps1 -Launcher "C:\path\M2_PROMPT.exe"
#   Remove        :  ... -File context-menu.ps1 -Uninstall
#
# The NSIS installer calls this on install with -Launcher pointing at the
# freshly installed exe. For a dev checkout just double-click
# INSTALL_CONTEXT_MENU.cmd / UNINSTALL_CONTEXT_MENU.cmd.
#
# This file is PURE ASCII on purpose: the Chinese menu label is built from
# Unicode code points so no encoding (console code page / editor) can ever
# mangle it.
# ============================================================
[CmdletBinding()]
param(
  [switch]$Uninstall,
  # Program to launch. Defaults are auto-detected (see below):
  #   - M2_PROMPT.exe   next to this script (installed app), or
  #   - run-hidden.vbs  next to this script (dev checkout).
  [string]$Launcher,
  # Menu icon (.ico / .exe). Defaults to the launched program's own icon.
  [string]$Icon
)

$ErrorActionPreference = 'Stop'

$appDir  = $PSScriptRoot
$keyName = 'M2_PROMPT'

# Auto-detect the launcher when not supplied.
if (-not $Launcher) {
  $exe = Join-Path $appDir 'M2_PROMPT.exe'
  $vbs = Join-Path $appDir 'run-hidden.vbs'
  if     (Test-Path $exe) { $Launcher = $exe }   # installed app
  elseif (Test-Path $vbs) { $Launcher = $vbs }   # dev checkout
  else                    { $Launcher = $exe }   # report the missing exe below
}
if (-not $Icon) {
  $ico = Join-Path $appDir 'build\icon.ico'
  if (Test-Path $ico) { $Icon = $ico } else { $Icon = $Launcher }
}

# Menu label (Chinese "open project with M2_PROMPT") built from Unicode code
# points so this file stays pure ASCII and the text is never mangled by the
# console code page / file encoding when it is written.
#   0x7528=Yong(use)  0x958B=Kai  0x555F=Qi(open)  0x5C08=Zhuan  0x6848=An(project)
$label = (-join ([char]0x7528)) + ' M2_PROMPT ' + (-join ([char]0x958B, [char]0x555F, [char]0x5C08, [char]0x6848))

# Two entry points:
#   Directory\shell            -> right-click ON a folder      (%1 = folder)
#   Directory\Background\shell -> right-click INSIDE a folder  (%V = folder)
$targets = @(
  @{ Root = "HKCU:\Software\Classes\Directory\shell\$keyName";           Param = '%1' },
  @{ Root = "HKCU:\Software\Classes\Directory\Background\shell\$keyName"; Param = '%V' }
)

# Always remove any existing entry FIRST (dev or a previous install) so the menu
# can never keep pointing at a stale path.
foreach ($t in $targets) {
  if (Test-Path $t.Root) { Remove-Item -Path $t.Root -Recurse -Force }
}

if ($Uninstall) {
  Write-Host 'Removed the M2_PROMPT folder right-click menu.'
  return
}

if (-not (Test-Path $Launcher)) {
  throw "Launcher not found: $Launcher"
}

# A .vbs launcher is run through wscript (no console window); an .exe is launched
# directly (a packaged Electron app is already a windowed process).
$isVbs = $Launcher.ToLower().EndsWith('.vbs')

foreach ($t in $targets) {
  $root = $t.Root
  New-Item -Path $root -Force | Out-Null
  Set-ItemProperty -Path $root -Name '(default)' -Value $label
  if (Test-Path $Icon) { Set-ItemProperty -Path $root -Name 'Icon' -Value $Icon }

  New-Item -Path "$root\command" -Force | Out-Null
  if ($isVbs) {
    $cmd = 'wscript.exe //nologo "{0}" "{1}"' -f $Launcher, $t.Param
  } else {
    $cmd = '"{0}" "{1}"' -f $Launcher, $t.Param
  }
  Set-ItemProperty -Path "$root\command" -Name '(default)' -Value $cmd
}

Write-Host "Installed the M2_PROMPT folder right-click menu -> $Launcher"
Write-Host 'Right-click any folder to use it. On Windows 11, click "Show more options" first.'
