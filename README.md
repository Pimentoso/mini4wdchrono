[![WIP](https://img.shields.io/badge/status-WORK%20IN%20PROGRESS-red.svg)](https://github.com/Pimentoso/mini4wdchrono)

# Mini4wdChrono

Software for Arduino based 3-lane lap timer for Tamiya Mini4wd. Built on johnny-five + electron.

The program reads data from the "Mini4WD Track Editor" and "Mini4WD Tournament Generator" websites to access track and players data,
so you are required to create your track and player list using those websites.

https://mini4wd-track-editor.pimentoso.com/

https://mini4wd-tournament.pimentoso.com/

## Hardware

- An arduino board. The project has been tested with both Arduino UNO and NANO.

https://www.aliexpress.com/item/32341832857.html

- A white LED strip, 50cm is enough. You can get a 5v USB-powered one, but any strip is ok, more light = better.

https://www.aliexpress.com/item/33000619572.html

- 3x photoresistor sensors. I'm using TEMT6000 for their slim form factor, but it will work with any photoresistor + 10kΩ resistor.

https://www.aliexpress.com/item/32583469115.html

- 3x green 5v LEDs, or lilypad boards

https://www.aliexpress.com/item/32962136265.html

- A magnetic buzzer.

https://www.aliexpress.com/item/32666789405.html

- A straight piece of 3 lane Japan Cup Mini4wd track.

Diagram link: https://www.tinkercad.com/things/jGPGsdLMKwj

![diagram](https://cdn.jsdelivr.net/gh/Pimentoso/mini4wdchrono/images/schema.png)

## Building the lap timer

Drill 3 holes in the middle of the 3 lanes of a mini4wd track piece. Put the photoresistors under the holes and fix them with tape.
Put the lap timer over the 3 holes, and stick the LED strip underside the lap timer, so that it casts light on the sensors.
The mini4wd car passing over the photoresistor will trigger a lap.
Put the 3 green leds on the front of the lap timer, one over each lane.

(PICS COMING SOON)

# Building the software

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