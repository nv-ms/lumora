function lumora {
    Start-Process -FilePath "C:\Program Files\nodejs\node.exe" -ArgumentList "server/app.js" -WorkingDirectory "D:\Job\nvms\projects\stream-weaver" -WindowStyle Hidden
}