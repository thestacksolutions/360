@echo off
title Offline Server
REM Starting local server on http://localhost:5502...
echo Application started. Closing this window will stop the application.

:: 1. Open Chrome
start chrome "http://localhost:5502/first-floor-view-07.html"

:: 2. Start the Error-Proof Server
powershell.exe -Command "$l = New-Object System.Net.HttpListener; $l.Prefixes.Add('http://localhost:5502/'); $l.Start(); while($l.IsListening) { $c = $l.GetContext(); try { $p = Join-Path $pwd $c.Request.Url.LocalPath.TrimStart('/'); if (Test-Path $p -PathType Leaf) { $b = [IO.File]::ReadAllBytes($p); $c.Response.ContentLength64 = $b.Length; $c.Response.OutputStream.Write($b, 0, $b.Length); } } catch {} finally { $c.Response.Close() } }"

pause