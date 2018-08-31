[![WIP](https://img.shields.io/badge/status-WORK%20IN%20PROGRESS-red.svg)](https://github.com/Pimentoso/mini4wdchrono)

# Mini4wdChrono

Software for Arduino based 3-lane lap timer for Tamiya Mini4wd. Built on johnny-five + electron.

THIS PROJECT IS STILL IN DEVELOPMENT. Please check back in the future.

## Arduino diagram

The chronometer uses 3x reflective infrared proximity sensors.
I strongly reccomend E18-D80NK sensors for their accuracy, but it will work with any digital proximity sensor.

https://www.aliexpress.com/item/sensor/2004492676.html

You also need 3 green LEDs and a piezo speaker.

![diagram](https://cdn.rawgit.com/Pimentoso/mini4wdchrono/6b3901f4/images/schema.png)

Pictures coming soon.

## Usage on OSX

```
brew update
brew cask install arduino
// now open the arduino IDE, and use it to upload the StandardFirmataPlus firmware on the board

cd mini4wdchrono
npm install

// make sure the arduino board is connected via USB, then
npm start
```

To package the project:

```
npm install electron-packager -g
electron-packager --out=dist .
```
