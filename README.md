[![Version](https://img.shields.io/badge/version-0.14.3-blue.svg)](https://github.com/Pimentoso/mini4wdchrono)

Mini4wdChrono is a fully free and open source project to make a functional 3-lane lap timer for Mini4WD Japan Cup tracks.

# The hardware

The hardware has been chosen to be as simple and cheap as possible, while still maintain accuracy.

* [Hardware parts needed](https://github.com/Pimentoso/mini4wdchrono/wiki/Hardware-parts-needed)
* [Hardware diagrams](https://github.com/Pimentoso/mini4wdchrono/wiki/Hardware-diagrams)
* [Flashing the arduino board](https://github.com/Pimentoso/mini4wdchrono/wiki/Flashing-the-arduino-board)
* [Lap timer building](https://github.com/Pimentoso/mini4wdchrono/wiki/Lap-timer-building)
* [Launching the software](https://github.com/Pimentoso/mini4wdchrono/wiki/Launching-the-software)

# The software

The software has been built to ease the work of race organizers, while still having a clean interface that can be shown on a big TV screen during the race.

Note: the program reads data from the "Mini4WD Track Editor" and "Mini4WD Tournament Generator" websites to access track length and player names,
so you are required to create your track and player list using those websites.

* [Software quick start guide](https://github.com/Pimentoso/mini4wdchrono/wiki/Software-quick-start-guide)
* [Software tournament rules](https://github.com/Pimentoso/mini4wdchrono/wiki/Software-tournament-rules)

## Download the software

You can download the latest releases for Windows 10 (64-bit) or Mac OS (64-bit) from [the releases page](https://github.com/Pimentoso/mini4wdchrono/releases).

## Screenshots

![race view](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/screen-race.png)

![players view](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/screen-players.png)

![manches view](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/screen-manches.png)

# Developing and contributing

## Build on OSX
Run ```brew install nodenv``` and follow installation instructions here. https://github.com/nodenv/nodenv

```bash
brew cask install arduino
# now open the arduino IDE, and use it to upload the StandardFirmataPlus firmware on the board

nodenv install 10.16.3
cd mini4wdchrono
npm install
npm run build

# make sure the arduino board is connected via USB, then
npm start
```

## Build on Windows

Make sure you are running a Powershell with administrator permissions, and Chocolatey is installed.

```bash
choco install python2
choco install arduino
# now open the arduino IDE, and use it to upload the StandardFirmataPlus firmware on the board

choco install nodejs --version=10.16.3
npm install -g windows-build-tools
cd mini4wdchrono
npm install

# make sure the arduino board is connected via USB, then
npm start
```
