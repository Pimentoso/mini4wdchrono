BASEDIR=$(dirname $0)
cd $BASEDIR
cd ..
echo "Deleting node_modules directory"
rm -rf node_modules/
echo "Deleting release-builds directory"
rm -rf release-builds/
npm install
$(node node_modules/electron-packager/bin/electron-packager.js . Mini4wdChrono --overwrite --icon=images/ic_launcher_web.icns --prune=true --out=release-builds)
cd release-builds
relname=$(ls -1)
echo "Creating zip archive"
zip -r Mini4wdChrono-linux-x64.zip $relname
echo "Done"
