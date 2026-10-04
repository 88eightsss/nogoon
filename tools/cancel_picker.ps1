Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$allCond = [System.Windows.Automation.Condition]::TrueCondition
$windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $allCond)

foreach ($w in $windows) {
    "Window: '$($w.Current.Name)' Class: '$($w.Current.ClassName)'" | Out-File C:\Users\jtshi\nogoon\picker_log.txt -Append
}

# Try to find dialog named "Open"
$nameCond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty, 'Open'
)
$dialog = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $nameCond)

if ($dialog) {
    "Found dialog: $($dialog.Current.Name) $($dialog.Current.ClassName)" | Out-File C:\Users\jtshi\nogoon\picker_log.txt -Append
    # Click Cancel
    $cancelCond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::NameProperty, 'Cancel'
    )
    $cancelBtn = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cancelCond)
    if ($cancelBtn) {
        "Found Cancel button" | Out-File C:\Users\jtshi\nogoon\picker_log.txt -Append
        $cancelBtn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    } else {
        "Cancel button not found" | Out-File C:\Users\jtshi\nogoon\picker_log.txt -Append
    }
} else {
    "Dialog not found" | Out-File C:\Users\jtshi\nogoon\picker_log.txt -Append
}
