Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$log = "C:\Users\jtshi\nogoon\picker_log2.txt"
"Starting..." | Out-File $log

$root = [System.Windows.Automation.AutomationElement]::RootElement

# Find Chrome window with the Play Console
$nameCond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty,
    'Prepare release | Nogoon - Google Chrome'
)
$chrome = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $nameCond)

if (-not $chrome) {
    "Chrome window not found, trying partial match..." | Out-File $log -Append
    # Try all Chrome windows
    $classCond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ClassNameProperty,
        'Chrome_WidgetWin_1'
    )
    $chromes = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $classCond)
    "Found $($chromes.Count) Chrome windows" | Out-File $log -Append
    foreach ($c in $chromes) {
        "  Chrome: '$($c.Current.Name)'" | Out-File $log -Append
    }
    $chrome = $chromes | Where-Object { $_.Current.Name -like '*Prepare*' } | Select-Object -First 1
}

if ($chrome) {
    "Found Chrome: $($chrome.Current.Name)" | Out-File $log -Append

    # Search all descendants for a dialog or edit box
    $allCond = [System.Windows.Automation.Condition]::TrueCondition
    $allDesc = $chrome.FindAll([System.Windows.Automation.TreeScope]::Descendants, $allCond)
    "Total descendants: $($allDesc.Count)" | Out-File $log -Append

    # Look for windows with dialog class
    foreach ($el in $allDesc) {
        $cls = $el.Current.ClassName
        $name = $el.Current.Name
        if ($cls -eq '#32770' -or $name -eq 'Open' -or $cls -like '*Dialog*') {
            "  Possible dialog: Name='$name' Class='$cls' Type='$($el.Current.ControlType.ProgrammaticName)'" | Out-File $log -Append
        }
    }
} else {
    "Chrome window not found at all" | Out-File $log -Append
}
