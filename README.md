# mini4wdchrono

on OSX:

brew update
brew cask install arduino
// use the arduino IDE to upload StandardFirmataPlus on the board

brew install node
cd mini4wdchrono
npm install -g node-gyp
npm install johnny-five

// connect the device, then
node chrono.js

Useful links
http://johnny-five.io/api/sensor/
http://johnny-five.io/examples/photoresistor/