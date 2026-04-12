[CmdletBinding()]
param (

    [Parameter(HelpMessage = "The path to the Microsoft Edge executable.", Mandatory = $true)]
    [string]
    $EdgePath,

    [Parameter(HelpMessage = "The port number to use for the Edge DevTools Protocol connection.", Mandatory = $false)]
    [ValidateRange(1, 65535)]
    [int]
    $Port = 9222,

    [Parameter(HelpMessage = "The web address to open a page.", Mandatory = $false)]
    [string]
    $Url = "about:blank",

    [Parameter(HelpMessage = "Profile name to use when launching Edge. If not specified, the default profile will be used.")]
    [string]
    $ProfileName,

    [Parameter(HelpMessage = "No window will be opened, but Edge will start with the specified port for remote debugging. This is useful for scenarios where you want to attach a debugger without opening a new browser window.")]
    [switch]
    $Headless
)

# Start Microsoft Edge with the specified port for remote debugging.
# --remote-allow-origins=* keeps CDP origin checks permissive for tooling scenarios.
# --no-first-run and --profile-directory --no-default-browser-check ensure a clean profile.
$EdgeArgs = "--remote-debugging-port=$Port --remote-allow-origins=* --no-first-run --no-default-browser-check"
if ($ProfileName) {
    $EdgeArgs += " --profile-directory=$ProfileName"
}
if ($Url) {
    $EdgeArgs += " $Url"
}
elseif (-not $Headless) {
    $EdgeArgs += " --no-startup-window"
}
if ($Headless) {
    $EdgeArgs += " --headless=new"
}

# Start Microsoft Edge with the constructed arguments
Start-Process -FilePath $EdgePath -ArgumentList $EdgeArgs
