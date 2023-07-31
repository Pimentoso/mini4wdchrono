[![Version](https://img.shields.io/badge/version-0.18.0-blue.svg)](https://github.com/Pimentoso/mini4wdchrono)

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

*Main lap timer view, with position, delay from first place, average speed and split times.*

![race view](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/screen-race.png)

---

*Player roster view, sorted, showing best time of each player in red.*

![players view](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/screen-players.png)

---

*Tournament view with all rounds. Times are editable.*

![manches view](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/screen-manches.png)

---

*Race setup screen. You can import data from Mini4WD Track Editor.*

![setup view](https://raw.githubusercontent.com/Pimentoso/mini4wdchrono/master/images/screen-setup.png)

# Developing and contributing

## Build on OSX
Run ```brew install nodenv``` and follow installation instructions here. https://github.com/nodenv/nodenv

```bash
brew cask install arduino
cd mini4wdchrono
nodenv install
npm install

# make sure the arduino board is connected via USB, then
npm start
```

To package the project run utils/build_darwin.sh, or

```bash
electron-packager . Mini4wdChrono --overwrite --icon=images/ic_launcher_web.icns --prune=true --out=release-builds
```

## Build on Windows

Make sure you are running a Powershell with administrator permissions, and Chocolatey is installed.

```bash
choco install python2
choco install arduino
choco install nodejs --version=10.16.3
npm install -g windows-build-tools
cd mini4wdchrono
npm install

# make sure the arduino board is connected via USB, then
npm start
```

To package the project run utils/build_win64.ps1, or

```bash
electron-packager . Mini4wdChrono --overwrite --asar --icon=images/ic_launcher_web.ico --prune=true --out=release-builds
```

## Build on Linux

:warning: This instructions are from a very old note, I haven't tried them recently.

```bash
sudo apt update
sudo apt install build-essential apt-transport-https lsb-release ca-certificates curl
curl -sL https://deb.nodesource.com/setup_10.x | bash -
sudo apt install nodejs
sudo apt install npm
cd mini4wdchrono/
npm install
./node_modules/.bin/electron-rebuild
sudo chmod 666 /dev/ttyACM0

# make sure the arduino board is connected via USB, then
npm start
```

## Errors

If you get an error when running the program like

```bash
Serialport was compiled against a different Node.js version using NODE_MODULE_VERSION 72. This version of Node.js requires NODE_MODULE_VERSION 70. Please try re-compiling or re-installing the module (for instance, using npm rebuild or npm install).
```

it means you need to run `electron-rebuild` on the project. Please run `npm run postinstall` inside the project directory.

Related issue: https://github.com/serialport/node-serialport/issues/1910
