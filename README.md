https://img.shields.io/badge/status-WIP-red.svg

# Mini4wdChrono
Arduino based 3-lane lap timer for Tamiya Mini4wd

## Develop on OSX

```
brew update
brew cask install arduino
// use the arduino IDE to upload StandardFirmataPlus on the board

brew install node
cd mini4wdchrono
npm install -g node-gyp
npm install johnny-five

// connect the device, then
node chrono.js
```

Useful links
http://johnny-five.io/api/sensor/
http://johnny-five.io/examples/photoresistor/