Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinClick {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint type;
        public MOUSEINPUT mi;
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct MOUSEINPUT {
        public int dx, dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT p);
    [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] inp, int sz);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string cls, string title);
    [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string cls, string title);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    public delegate bool EnumProc(IntPtr hwnd, IntPtr lp);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X, Y; }

    public static void Click(int screenX, int screenY) {
        SetCursorPos(screenX, screenY);
        System.Threading.Thread.Sleep(100);
        // MOUSEEVENTF_LEFTDOWN = 0x0002, MOUSEEVENTF_LEFTUP = 0x0004
        INPUT[] inp = new INPUT[2];
        inp[0].type = 0; // INPUT_MOUSE
        inp[0].mi.dwFlags = 0x0002; // MOUSEEVENTF_LEFTDOWN
        inp[1].type = 0;
        inp[1].mi.dwFlags = 0x0004; // MOUSEEVENTF_LEFTUP
        SendInput(2, inp, Marshal.SizeOf(typeof(INPUT)));
    }
}
"@

$log = "C:\Users\jtshi\nogoon\sendclick_log.txt"
"$(Get-Date) Starting..." | Out-File $log

# Find Chrome window with Play Console
$chromeHwnd = [IntPtr]::Zero
[WinClick]::EnumWindows({
    param($hwnd, $lp)
    $title = New-Object System.Text.StringBuilder 256
    $cls = New-Object System.Text.StringBuilder 64
    [WinClick]::GetWindowText($hwnd, $title, 256) | Out-Null
    [WinClick]::GetClassName($hwnd, $cls, 64) | Out-Null
    if ($cls.ToString() -eq 'Chrome_WidgetWin_1' -and $title.ToString() -like '*Prepare release*') {
        $Script:chromeHwnd = $hwnd
        return $false
    }
    return $true
}, [IntPtr]::Zero) | Out-Null

if ($chromeHwnd -eq [IntPtr]::Zero) {
    # Try any Chrome window
    [WinClick]::EnumWindows({
        param($hwnd, $lp)
        $cls = New-Object System.Text.StringBuilder 64
        [WinClick]::GetClassName($hwnd, $cls, 64) | Out-Null
        if ($cls.ToString() -eq 'Chrome_WidgetWin_1') {
            $Script:chromeHwnd = $hwnd
            return $false
        }
        return $true
    }, [IntPtr]::Zero) | Out-Null
}

if ($chromeHwnd -eq [IntPtr]::Zero) {
    "Chrome window not found!" | Out-File $log -Append; exit 1
}

$r = New-Object WinClick+RECT
[WinClick]::GetWindowRect($chromeHwnd, [ref]$r) | Out-Null
"Chrome window rect: L=$($r.Left) T=$($r.Top) R=$($r.Right) B=$($r.Bottom)" | Out-File $log -Append

# Bring Chrome to front
[WinClick]::SetForegroundWindow($chromeHwnd) | Out-Null
Start-Sleep -Milliseconds 300

# Viewport origin: window_left + 0, window_top + toolbar_height
# Toolbar height (tabs+addressbar+bookmarks) is typically ~93px but let's use 93
$toolbarH = 93
$viewportX = $r.Left
$viewportY = $r.Top + $toolbarH

# Button viewport coords from JS: cx=371, cy=413
$btnClientX = 371
$btnClientY = 413

$screenX = $viewportX + $btnClientX
$screenY = $viewportY + $btnClientY

"Clicking at screen coords: X=$screenX Y=$screenY" | Out-File $log -Append

[WinClick]::Click($screenX, $screenY)
Start-Sleep -Milliseconds 200

"Done." | Out-File $log -Append
