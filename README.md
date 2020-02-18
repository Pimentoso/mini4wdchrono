[![Version](https://img.shields.io/badge/version-0.12.2-blue.svg)](https://github.com/Pimentoso/mini4wdchrono)

Mini4wdChrono is a fully free and open source project to make a functional 3-lane lap timer for Mini4WD Japan Cup tracks.
The hardware has been chosen to be as simple and cheap as possible, while still maintain accuracy.
The software has been built to ease the work of race organizers, while still having a clean interface that can be shown on a big TV screen during the race.

# The software

The program reads data from the "Mini4WD Track Editor" and "Mini4WD Tournament Generator" websites to access track length and player names,
so you are required to create your track and player list using those websites.

**Quick start guide:**

- Launch the program and go to the "configuration" tab.
    - Change the arduino pins to match your setup.
    - Change the USB port if needed.
    - Save and reboot the program.
    - Make sure the 3 colored squares read "1". This mean the light source is correctly pointed at the sensors.
- Draw the track in the https://mini4wd-track-editor.pimentoso.com/ website, and save it. Copy the 6-letter code or just copy the link.
- Import the track in the "race setup" screen. This is important because the program needs to know the length of the track and the lane changes.
- You can now already go to the "race view" screen and start a race.
- Insert the player names in the https://mini4wd-tournament.pimentoso.com/ website, generate the tournament, and save it. Copy the 6-letter code or just copy the link.
- Import the tournament in the "race setup" screen.
- Now in the "race view" screen you can start the actual rounds of the race. The times will be recorded and assigned to the correct players.
- You can also go to the "racers list" and "manches list" screens to check the current race rankings.
- Enjoy the race.

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

- An arduino board. The project has been tested with both Arduino UNO, Arduino Nano and Pro Micro.

https://www.aliexpress.com/item/32341832857.html

- 3x laser diodes.

https://www.aliexpress.com/item/32822976597.html

- 3x phototransistor sensors. I'm using TEMT6000 for their slim form factor. Do not use photoresistors, they're slow.

https://www.aliexpress.com/item/32583469115.html

- 3x green 5v LEDs, or lilypad boards.

https://www.aliexpress.com/item/32962136265.html

- Alternatively, you can use a WS2812b LED strip with 9 LEDs (3 for each lane). The ones with 30 LEDS/meter are best so 9 LEDS are 30cm long.

https://www.aliexpress.com/item/2036819167.html

- A magnetic (active) buzzer.

https://www.aliexpress.com/item/32666789405.html

- A straight piece of 3 lane Japan Cup Mini4wd track.

## Diagram for LEDs/Lilypads

![diagram](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/schema.png)

## Diagram for WS2812b RGB LED strip

![diagram](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/schema_strip.png)

## Building the lap timer

Drill 3 holes in the middle of the 3 lanes of a mini4wd track piece. Put the phototransistors under the holes and fix them with tape.

![sensors mounted](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/sensors.jpg)

Build some sort of bridge-like structure to hold the electronics.
Put the structure over the 3 holes on the track with the sensors. The mini4wd car passing over the phototransistors will trigger a lap.
Attach the lasers underside the bridge, so that they are exactly pointed at the phototransistors.
Put the 3 green leds on the front of the lap timer, one over each lane.

Example lap timer made using cable ducts:

![lap timer](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/semaforo1.jpg)

More elaborate lap timer with LED strip and polycarbonate body:

[coming soon]

Connection pins: every pin used is configurable inside the program, but the default are:

- Light sensors: D6, D7, D8
- LEDs: D3, D4, D5 (only D3 if using WS2812b strip)
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
Run ```brew install nodenv``` and follow installation instructions here. https://github.com/nodenv/nodenv

```
brew cask install arduino
// now open the arduino IDE, and use it to upload the StandardFirmataPlus firmware on the board

nodenv install 10.16.3
cd mini4wdchrono
npm install

// make sure the arduino board is connected via USB, then
npm start
```

To package the project run utils/build_darwin.sh, or

```
electron-packager . Mini4wdChrono --overwrite --icon=images/ic_launcher_web.icns --prune=true --out=release-builds
```

## Build on Windows

Make sure you are running a Powershell with administrator permissions, and Chocolatey is installed.

```
choco install python2
choco install arduino
// now open the arduino IDE, and use it to upload the StandardFirmataPlus firmware on the board

choco install nodejs --version=10.16.3
npm install -g windows-build-tools
cd mini4wdchrono
npm install

// make sure the arduino board is connected via USB, then
npm start
```

To package the project run utils/build_win64.ps1, or

```
electron-packager . Mini4wdChrono --overwrite --asar --icon=images/ic_launcher_web.ico --prune=true --out=release-builds
```

## Errors

If you get an error when running the program like

```
Serialport was compiled against a different Node.js version using NODE_MODULE_VERSION 72. This version of Node.js requires NODE_MODULE_VERSION 70. Please try re-compiling or re-installing the module (for instance, using npm rebuild or npm install).
```

- Remove from the node-modules folder the serialport and @serialport folders.
- Remove the file packages-lock.json
- Run `npm install` to install non-installed modules
- And finally run `./node_modules/.bin/electron-rebuild`

Related issue: https://github.com/serialport/node-serialport/issues/1910
