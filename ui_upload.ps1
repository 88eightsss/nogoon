Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty, 'Open'
)
$dialog = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)

if ($dialog) {
    # Find the filename edit box
    $editCond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Edit
    )
    $editBox = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $editCond)
    $valuePattern = $editBox.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $valuePattern.SetValue('C:\Users\jtshi\Downloads\nogoon-v7.aab')
    Start-Sleep -Milliseconds 500

    # Find and click the Open button
    $btnNameCond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::NameProperty, 'Open'
    )
    $btnTypeCond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
        [System.Windows.Automation.ControlType]::Button
    )
    $andCond = New-Object System.Windows.Automation.AndCondition($btnNameCond, $btnTypeCond)
    $btn = $dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $andCond)
    $invokePattern = $btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invokePattern.Invoke()
} else {
    Write-Host "Dialog not found"
}
