[![WIP](https://img.shields.io/badge/status-WORK%20IN%20PROGRESS-red.svg)](https://github.com/Pimentoso/mini4wdchrono)

# Mini4wdChrono
Software for Arduino based 3-lane lap timer for Tamiya Mini4wd. Built on johnny-five + node.js + socket.io.

THIS PROJECT IS STILL IN DEVELOPMENT. Please check back in the future.

## Arduino schematics
Coming soon.

The chronometer uses 3x reflective infrared 3pin obstacle avoidance sensor. Like this one

https://www.aliexpress.com/item/sensor/32591729856.html

## Usage on OSX

```
brew update
brew cask install arduino
// use the arduino IDE to upload StandardFirmataPlus on the board

brew install node
cd mini4wdchrono
npm install

// connect the device, then
npm start
```
Then open chrome on http://localhost:3000/ to access the web interface.

## Useful links

- http://johnny-five.io/api/sensor/
- http://johnny-five.io/examples/photoresistor/
- https://github.com/thulioph/arduino-j5
