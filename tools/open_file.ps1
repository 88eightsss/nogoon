Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinAPI3 {
    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string cls, string title);
    [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
    [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, string l);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumChildProc cb, IntPtr lp);
    public delegate bool EnumChildProc(IntPtr hWnd, IntPtr lParam);
}
"@

$log = "C:\Users\jtshi\nogoon\open_file_log.txt"
$WM_SETTEXT   = 0x000C
$WM_COMMAND   = 0x0111
$IDOK         = 1
$FILE         = "C:\Users\jtshi\nogoon\nogoon-v7.aab"

"$(Get-Date) Waiting for Open dialog..." | Out-File $log

# Poll for the dialog up to 60 seconds
$dlg = [IntPtr]::Zero
for ($i = 0; $i -lt 60; $i++) {
    $dlg = [WinAPI3]::FindWindow("#32770", "Open")
    if ($dlg -ne [IntPtr]::Zero) {
        "$(Get-Date) Found dialog handle=$dlg after $i s" | Out-File $log -Append
        break
    }
    Start-Sleep 1
}

if ($dlg -eq [IntPtr]::Zero) {
    "$(Get-Date) Dialog not found after 60s, giving up." | Out-File $log -Append
    exit 1
}

[WinAPI3]::SetForegroundWindow($dlg) | Out-Null
Start-Sleep -Milliseconds 300

# Enumerate all child windows to find the filename edit box
$children = [System.Collections.Generic.List[string]]::new()
[WinAPI3]::EnumChildWindows($dlg, {
    param($hwnd, $lp)
    $cls = New-Object System.Text.StringBuilder 128
    [WinAPI3]::GetClassName($hwnd, $cls, 128) | Out-Null
    $children.Add("$hwnd|$($cls.ToString())")
    return $true
}, [IntPtr]::Zero) | Out-Null
$children | Out-File $log -Append

# Strategy: find the Edit inside ComboBoxEx32 > ComboBox chain (standard Windows file dialog)
$editHandle = [IntPtr]::Zero
$cbex = [WinAPI3]::FindWindowEx($dlg, [IntPtr]::Zero, "ComboBoxEx32", $null)
if ($cbex -ne [IntPtr]::Zero) {
    "Found ComboBoxEx32: $cbex" | Out-File $log -Append
    $cb = [WinAPI3]::FindWindowEx($cbex, [IntPtr]::Zero, "ComboBox", $null)
    if ($cb -ne [IntPtr]::Zero) {
        "Found ComboBox: $cb" | Out-File $log -Append
        $editHandle = [WinAPI3]::FindWindowEx($cb, [IntPtr]::Zero, "Edit", $null)
        if ($editHandle -ne [IntPtr]::Zero) {
            "Found Edit inside ComboBox: $editHandle" | Out-File $log -Append
        }
    }
}

# Fallback: direct Edit child of dialog
if ($editHandle -eq [IntPtr]::Zero) {
    $editHandle = [WinAPI3]::FindWindowEx($dlg, [IntPtr]::Zero, "Edit", $null)
    if ($editHandle -ne [IntPtr]::Zero) {
        "Found Edit directly in dialog: $editHandle" | Out-File $log -Append
    }
}

if ($editHandle -ne [IntPtr]::Zero) {
    "Setting filename to: $FILE" | Out-File $log -Append
    [WinAPI3]::SendMessage($editHandle, $WM_SETTEXT, [IntPtr]::Zero, $FILE) | Out-Null
    Start-Sleep -Milliseconds 500
    "Sending IDOK to dialog..." | Out-File $log -Append
    [WinAPI3]::SendMessage($dlg, $WM_COMMAND, [IntPtr]$IDOK, [IntPtr]::Zero) | Out-Null
    "$(Get-Date) Done - IDOK sent." | Out-File $log -Append
} else {
    "No Edit control found. Dumping children for inspection." | Out-File $log -Append
    $children | ForEach-Object { "  $_" | Out-File $log -Append }
    "Sending IDOK directly without setting filename..." | Out-File $log -Append
    [WinAPI3]::SendMessage($dlg, $WM_COMMAND, [IntPtr]$IDOK, [IntPtr]::Zero) | Out-Null
}
