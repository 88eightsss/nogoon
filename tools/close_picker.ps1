Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public class WinAPI {
    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string cls, string title);
    [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lp);
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc cb, IntPtr lp);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
}
"@

$log = "C:\Users\jtshi\nogoon\close_log.txt"
"Searching for file dialog..." | Out-File $log

$WM_COMMAND = 0x0111
$IDCANCEL = 2

# Search all top-level windows for class #32770 (standard Windows dialog)
$found = $false
[WinAPI]::EnumWindows({
    param($hwnd, $lp)
    $cls = New-Object System.Text.StringBuilder 256
    $title = New-Object System.Text.StringBuilder 256
    [WinAPI]::GetClassName($hwnd, $cls, 256) | Out-Null
    [WinAPI]::GetWindowText($hwnd, $title, 256) | Out-Null
    if ([WinAPI]::IsWindowVisible($hwnd)) {
        "Window: '$($title.ToString())' Class: '$($cls.ToString())' Handle: $hwnd" | Out-File $log -Append
    }
    return $true
}, [IntPtr]::Zero) | Out-Null

# Try direct FindWindow for standard dialog
$dlg = [WinAPI]::FindWindow("#32770", "Open")
if ($dlg -ne [IntPtr]::Zero) {
    "Found #32770 'Open' dialog: $dlg" | Out-File $log -Append
    # Find Cancel button (IDCANCEL = 2)
    $cancelBtn = [WinAPI]::FindWindowEx($dlg, [IntPtr]::Zero, "Button", "Cancel")
    if ($cancelBtn -ne [IntPtr]::Zero) {
        "Found Cancel button: $cancelBtn, clicking..." | Out-File $log -Append
        [WinAPI]::SendMessage($dlg, $WM_COMMAND, [IntPtr]$IDCANCEL, [IntPtr]::Zero) | Out-Null
    } else {
        "No Cancel button found, sending WM_COMMAND IDCANCEL directly" | Out-File $log -Append
        [WinAPI]::SendMessage($dlg, $WM_COMMAND, [IntPtr]$IDCANCEL, [IntPtr]::Zero) | Out-Null
    }
} else {
    "No #32770 'Open' dialog found at top level" | Out-File $log -Append
    # Try without title
    $dlg2 = [WinAPI]::FindWindow("#32770", $null)
    if ($dlg2 -ne [IntPtr]::Zero) {
        "Found #32770 dialog (any title): $dlg2" | Out-File $log -Append
        [WinAPI]::SendMessage($dlg2, $WM_COMMAND, [IntPtr]$IDCANCEL, [IntPtr]::Zero) | Out-Null
    } else {
        "No #32770 dialog found at all" | Out-File $log -Append
    }
}

"Done." | Out-File $log -Append
