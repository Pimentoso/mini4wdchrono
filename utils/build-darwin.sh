BASEDIR=$(dirname $0)
cd $BASEDIR
cd ..
echo "Deleting release-builds directory"
rm -rf release-builds/
$(electron-packager . Mini4wdChrono --overwrite --icon=images/ic_launcher_web.icns --prune=true --out=release-builds)
cd release-builds
relname=$(ls | sort -n | head -1)
echo "Creating zip archive"
$(ditto -c -k --sequesterRsrc --keepParent $relname/ Mini4wdChrono-mac.zip)
echo "Done"