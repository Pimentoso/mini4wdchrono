[![Version](https://img.shields.io/badge/version-0.11.1-blue.svg)](https://github.com/Pimentoso/mini4wdchrono)

Mini4wdChrono is a fully free and open source project to make a functional 3-lane lap timer for Mini4WD Japan Cup tracks.
The hardware has been chosen to be as simple and cheap as possible, while still maintain accuracy.
The software has been built to ease the work of race organizers, while still having a clean interface that can be shown on a big TV screen during the race.

# The software

The program reads data from the "Mini4WD Track Editor" and "Mini4WD Tournament Generator" websites to access track length and player names,
so you are required to create your track and player list using those websites.

**Quick start guide:**

- draw the track in the https://mini4wd-track-editor.pimentoso.com/ website, and save it. Copy the 6-letter code or just copy the link.
- import the track in the "race setup" screen. This is important because the program needs to know the length of the track and the lane changes.
- you can now already go to the "race view" screen and start a race.
- insert the player names in the https://mini4wd-tournament.pimentoso.com/ website, generate the tournament, and save it. Copy the 6-letter code or just copy the link.
- import the tournament in the "race setup" screen.
- now in the "race view" screen you can start the actual rounds of the race. The times will be recorded and assigned to the correct players.
- now you can go to the "racers list" and "manches list" screens to check the current race rankings.

## Screenshots

![race view](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/screen-race.png)

![players view](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/screen-players.png)

![manches view](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/screen-manches.png)

## Download the software

You can download the latest releases for Windows 10 (64-bit) or Mac OS (64-bit) from [the releases page](https://github.com/Pimentoso/mini4wdchrono/releases).

Unzip the program anywhere on your computer, connect the lap timer to the computer via USB, and then launch the program.

# The hardware

## Hardware needed

- A computer with the Mini4WDChrono software installed.

- An arduino board. The project has been tested with both Arduino UNO and NANO.

https://www.aliexpress.com/item/32341832857.html

- A white LED strip, 50cm is enough. You can get a 5v USB-powered one, but any strip is ok, more light = better.

https://www.aliexpress.com/item/33000619572.html

- 3x phototransistor sensors. I'm using TEMT6000 for their slim form factor. Do not use photoresistors, they're slow.

https://www.aliexpress.com/item/32583469115.html

- 3x green 5v LEDs, or lilypad boards

https://www.aliexpress.com/item/32962136265.html

- A magnetic (active) buzzer.

https://www.aliexpress.com/item/32666789405.html

- A straight piece of 3 lane Japan Cup Mini4wd track.

Diagram link: https://www.tinkercad.com/things/jGPGsdLMKwj-mini4wd-chrono

![diagram](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/schema.png)

Real life assembled electronics:

![assembled electronics](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/electronics.jpg)

## Building the lap timer

Drill 3 holes in the middle of the 3 lanes of a mini4wd track piece. Put the phototransistors under the holes and fix them with tape.

![sensors mounted](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/sensors.jpg)

Build some sort of bridge-like structure to hold the electronics. Stick the LED strip underside it, so that it casts light on the sensors. Put the structure over the 3 holes on the track with the sensors.

The mini4wd car passing over the photoresistor will trigger a lap.
Put the 3 green leds on the front of the lap timer, one over each lane.

Prototype lap timer made of wood and 3d printed joints:

![lap timer](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/semaforo2.jpg)

Example lap timer made using cable ducts:

![lap timer](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/semaforo1.jpg)

Connection pins: every pin used is configurable inside the program, but the default are:

- Light sensors: D6, D7, D8
- LEDs: D3, D4, D5
- Buzzer: D2

Now you need to flash the StandardFirmataPlus firmware on your arduino board. This will allow the arduino to comunicate with the computer via USB. Instructions:

- Install Arduino IDE from https://www.arduino.cc/en/Main/Software
- Open Arduino IDE
- Verify correct port and board
- Navigate to File > Examples > Firmata > StandardFirmataPlus
- Upload sketch onto board.
- Done!

When you launch Mini4WD Chrono, the small badge on the top right will be green and say "board connected".
If you have problems, go to the configuration tab, change the USB port, and save settings. Disconnect and reconnect the arduino board to USB, and reload the program.
**NOTE: the arduino board must be connected to the computer USB BEFORE launching the program.**

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
