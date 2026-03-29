#!/usr/bin/env osascript

# Quick fix for task hanging at 50% - Open Settings to Accounts

tell application "Aperant"
	activate
end tell

delay 0.5

tell application "System Events"
	tell process "Aperant"
		click menu bar item 1 of menu bar 1
		delay 0.2
		click menu item "Settings..." of menu 1
	end tell
end tell

display dialog "✅ Settings opened!

Please check the Accounts tab:
1. Verify your API keys are filled in
2. Test each account connection
3. Remove any duplicate or invalid accounts

Then try running your task again." buttons {"OK"} default button 1
