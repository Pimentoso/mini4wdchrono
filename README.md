[![WIP](https://img.shields.io/badge/version-0.9.5-blue.svg)](https://github.com/Pimentoso/mini4wdchrono)

# Mini4wdChrono

Software for Arduino based 3-lane lap timer for Tamiya Mini4wd. Built on johnny-five + electron.

The program reads data from the "Mini4WD Track Editor" and "Mini4WD Tournament Generator" websites to access track and players data,
so you are required to create your track and player list using those websites.

https://mini4wd-track-editor.pimentoso.com/

https://mini4wd-tournament.pimentoso.com/

# Screenshots

![race view](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/screen-race.png)

![players view](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/screen-players.png)

![manches view](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/screen-manches.png)

# Download the software

You can download the latest releases for Windows 10 (64-bit) or Mac OS (64-bit) from [the releases page](https://github.com/Pimentoso/mini4wdchrono/releases).

# Hardware needed

- A computer.

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

![diagram](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/schema.png)

Real life assembled electronics:

![assembled electronics](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/electronics.jpg)

# Building the lap timer

Drill 3 holes in the middle of the 3 lanes of a mini4wd track piece. Put the photoresistors under the holes and fix them with tape.

![sensors mounted](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/sensors.jpg)

Put the lap timer over the 3 holes, and stick the LED strip underside the lap timer, so that it casts light on the sensors.
The mini4wd car passing over the photoresistor will trigger a lap.
Put the 3 green leds on the front of the lap timer, one over each lane.

Example lap timer made using cable ducts:

![lap timer](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/semaforo.jpg)

Connection pins: every pin used is configurable inside the program, but the default are:

- Light sensors: A5, A6, A7
- LEDs: D3, D4, D5
- Buzzer: D2

Now you need to flash the StandardFirmataPlus firmware on your arduino board. This will allow the arduino to comunicate with the computer via USB.

Instructions:

- Install Arduino IDE from https://www.arduino.cc/en/Main/Software
- Open Arduino IDE
- Verify correct port and board
- Navigate to File > Examples > Firmata > StandardFirmataPlus
- Upload sketch onto board.
- Done!

When you launch Mini4WD Chrono, the small badge on the top right will be green and say "board connected". If you have problems, go to the configuration tab, change the USB port, save and reload the program.

Some Arduino Nano clones may need the CH340 USB driver to be recognized. [You can download it here](https://sparks.gogo.co.nz/ch340.html).

# Contributing

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
choco install arduino
// now open the arduino IDE, and use it to upload the StandardFirmataPlus firmware on the board
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