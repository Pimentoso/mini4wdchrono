cd $PSScriptRoot
cd ..
Write-Host "Deleting release-builds directory"
Remove-Item -path .\release-builds\ -recurse
electron-packager . Mini4wdChrono --overwrite --asar --icon=images/ic_launcher_web.ico --prune=true --out=release-builds
cd release-builds
$relname = Get-ChildItem -Path . -Force -Recurse | Select-Object -First 1
Write-Host "Creating $relname.zip archive"
Compress-Archive -Path "$relname/" -DestinationPath "$relname.zip"
cd ..
Write-Host "Completed"