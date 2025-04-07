Mini4wdChrono is an electron app which is supposed to be used in combination with an external, usb-connected lap timer hardware for toy cars. 

The external lap timer uses 3 sensors to check if the toy cars pass over the start line on a 3 lanes track, and has led strips and a buzzer for visual/audio feedback. The program polls on those 3 sensors and calculates the car times using the timestamp readings.

The program uses johnny-five javascript library to comunicate with the external arduino board in the lap timer. https://github.com/rwaldron/johnny-five

It is built on electron because it has to work as a standalone, offline computer program, on both Windows, MacOS and Linux.

It currently runs on nodeJS 10.16.3 and electron 9.4.4 because it's the latest version that works without context isolation.

The project is structured like so:

/css - the folder for css stylesheets
/i18n - the folder for translation files
/scripts - contains the postinstall script required for rebuilding native libraries for johnny-five to work
/utils - the scripts to build the program using electron-builder on various architectures
/js/main.js - the main js file. It handles the comunication with the external hardware and handles events from the UI
/js/client.js - the main program logic is in this file. It is called from main.js and acts as a bridge between main.js and ui.js
/js/ui.js - handles the updates to the UI and rendering
/js/chrono.js - contains the algorithm to calculate the lap times. Crucial to the program
/js/configuration.js - handles persistence of the user settings
/js/storage.js - handles persistence of races data
/js/led_managers - the files in this folder handle comunication with the LED strips
/index.html - main UI file
/window.js - main electron entry point
/dev - ignore this
/resources - ignore this

Your mission now is to:

- add a JS linter library to the project and have it cleanup the code
- look for possible code organization issues and helpful refactors
- update the program to the latest version of NodeJS and Electron, and possibly update all dependencies that come along with it. Because the currently used NodeJS version is very old, the program cannot be compiled for MacOS on ARM architectures. This needs to be fixed
- make the program compliant with the newer electron requirements about context isolation, and main/renderer process model, creating any preload scripts needed for it
- avoid making feature changes to chrono.js other than linting/refactoring since it contains the main lap calculation algorithm for the program

Important note: You can and should use several tools to check your own work.

Please create an implementation plan and ask any questions that you need to have answered for your mission.
