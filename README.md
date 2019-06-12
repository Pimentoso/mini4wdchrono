[![WIP](https://img.shields.io/badge/status-WORK%20IN%20PROGRESS-red.svg)](https://github.com/Pimentoso/mini4wdchrono)

# Mini4wdChrono

Software for Arduino based 3-lane lap timer for Tamiya Mini4wd. Built on johnny-five + electron.

THIS PROJECT IS STILL IN DEVELOPMENT. Please check back in the future.

## Arduino diagram

First you need an arduino board. The project has been tested with both Arduino UNO and NANO.

You also need a white LED strip and 3x photoresistor sensors.

For the LED strip, use a 50cm 5V cold light strip, like this one.

https://www.aliexpress.com/item/33000619572.html

For the sensors I'm using TEMT6000 for their slim form factor, but it will work with any photoresistor + 10kΩ resistor.

https://www.aliexpress.com/item/32583469115.html

You also need 3 green LEDs + 220Ω resistors (or a lilypad), and a 5v magnetic buzzer

Diagram link: https://www.tinkercad.com/things/jGPGsdLMKwj

![diagram](https://cdn.jsdelivr.net/gh/Pimentoso/mini4wdchrono/images/schema.png)

## Building the lap timer

The ```3d_models``` folder contains the 3d-printable models for building the main structure. Print 2 joints.
You will also need 3 wood planks, a couple 10mm self-threading wood screws, and zip ties.

[PICTURES COMING SOON]

Drill 3 holes in the middle of the 3 lanes of a mini4wd track piece. Put the photoresistors under the holes and fix them with tape.
Put the lap timer over the 3 holes, and stick the LED strip underside the lap timer, so that it casts light on the sensors.
The mini4wd car passing over the photoresistor will trigger a lap.

## Build on OSX

```
brew update
brew install node
brew cask install arduino
// now open the arduino IDE, and use it to upload the StandardFirmataPlus firmware on the board

cd mini4wdchrono
npm install

// make sure the arduino board is connected via USB, then
npm start
```

To package the project:

```
electron-packager . Mini4wdChrono --overwrite --icon=images/ic_launcher_web.icns --prune=true --out=release-builds
```

## Build on Windows

Make sure you are running a Powershell with administrator permissions, and Chocolatey is installed.

```
choco install node
choco install python2
```

Now open a Node.js Command Prompt with administrator access

```
npm install -g windows-build-tools
cd mini4wdchrono
npm install

// make sure the arduino board is connected via USB, then
npm start
```

To package the project:

```
electron-packager . Mini4wdChrono --overwrite --asar --icon=images/ic_launcher_web.ico --prune=true --out=release-builds
```