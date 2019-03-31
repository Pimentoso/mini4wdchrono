[![WIP](https://img.shields.io/badge/status-WORK%20IN%20PROGRESS-red.svg)](https://github.com/Pimentoso/mini4wdchrono)

# Mini4wdChrono

Software for Arduino based 3-lane lap timer for Tamiya Mini4wd. Built on johnny-five + electron.

THIS PROJECT IS STILL IN DEVELOPMENT. Please check back in the future.

## Arduino diagram

The chronometer uses a LED strip and 3x photoresistor sensors.

For the LED strip, use a 50cm 5V cold light strip, like this one.
https://www.aliexpress.com/item/5V-USB-Cable-LED-Strip/32977470062.html

For the sensors I'm using TEMT6000 for their slim form factor, but it will work with any photoresistor.
https://www.aliexpress.com/item/TEMT6000-Sensor/32583469115.html

You also need 3 green LEDs and a piezo speaker.

![diagram](https://cdn.rawgit.com/Pimentoso/mini4wdchrono/6b3901f4/images/schema.png)

## Building the lap timer

The ```3d_models``` folder contains the 3d-printable models for building the main structure. Print 2 joints.
You will also need 3 wood planks, a couple 10mm self-threading wood screws, and zip ties.

[PICTURES COMING SOON]

Drill 3 holes in the middle of the 3 lanes of a mini4wd track piece. Put the photoresistors under the holes and fix them with tape.
Put the lap timer over the 3 holes, and stick the LED strip underside the lap tiper, so that it casts light on the sensors.
The mini4wd car passing over the photoresistor will trigger a lap.

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
