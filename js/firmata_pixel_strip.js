'use strict';

const START_SYSEX = 0xF0;
const END_SYSEX = 0xF7;
const PIXEL_COMMAND = 0x51;
const PIXEL_CONFIG = 0x01;
const PIXEL_SHOW = 0x02;
const PIXEL_SET_PIXEL = 0x03;
const PIXEL_SET_STRIP = 0x04;
const MASK_7BIT = 0x7F;

class FirmataPixelStrip {
    // Configures a Firmata-backed WS2812 pixel strip.
    constructor({ firmata, pin, length, gamma = 2.8 }) {
        this.port = firmata.transport || firmata.sp || firmata;
        this.pin = pin;
        this.length = length;
        this.gamma = gamma;
    }

    // Sends the strip configuration command to the board.
    initialize() {
        return new Promise((resolve, reject) => {
            this.port.write(Buffer.from([
                START_SYSEX,
                PIXEL_COMMAND,
                PIXEL_CONFIG,
                this.pin,
                this.length & MASK_7BIT,
                (this.length >> 7) & MASK_7BIT,
                END_SYSEX
            ]), (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                console.log('[Hardware] LED strip ready');
                resolve();
            });
        });
    }

    // Returns controls for one pixel in the strip.
    pixel(index) {
        return {
            color: (color) => this.setPixel(index, color),
            off: () => this.setPixel(index, '#000000')
        };
    }

    // Sets every pixel to the requested color.
    color(color) {
        this.writeColorCommand(PIXEL_SET_STRIP, this.toColorValue(color));
    }

    // Turns off every pixel and applies the change.
    off() {
        this.color('#000000');
        this.show();
    }

    // Flushes pending pixel changes to the strip.
    show() {
        this.write([START_SYSEX, PIXEL_COMMAND, PIXEL_SHOW, END_SYSEX]);
    }

    // Sets one pixel to the requested color.
    setPixel(index, color) {
        const colorValue = this.toColorValue(color);
        this.write([
            START_SYSEX,
            PIXEL_COMMAND,
            PIXEL_SET_PIXEL,
            index & MASK_7BIT,
            (index >> 7) & MASK_7BIT,
            colorValue & MASK_7BIT,
            (colorValue >> 7) & MASK_7BIT,
            (colorValue >> 14) & MASK_7BIT,
            (colorValue >> 21) & MASK_7BIT,
            END_SYSEX
        ]);
    }

    // Sends a strip-wide color command.
    writeColorCommand(command, colorValue) {
        this.write([
            START_SYSEX,
            PIXEL_COMMAND,
            command,
            colorValue & MASK_7BIT,
            (colorValue >> 7) & MASK_7BIT,
            (colorValue >> 14) & MASK_7BIT,
            (colorValue >> 21) & MASK_7BIT,
            END_SYSEX
        ]);
    }

    // Converts an RGB color to the gamma-corrected Firmata value.
    toColorValue(color) {
        const { r, g, b } = this.parseColor(color);
        const gamma = (value) => Math.floor(Math.pow(value / 255, this.gamma) * 255 + 0.5);

        return (gamma(r) << 16) + (gamma(g) << 8) + gamma(b);
    }

    // Parses a hex string or RGB object into RGB channels.
    parseColor(color) {
        if (typeof color === 'object' && color !== null) {
            return color;
        }

        const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
        if (!match) {
            throw new Error(`Unsupported LED color: ${color}`);
        }

        return {
            r: parseInt(match[1], 16),
            g: parseInt(match[2], 16),
            b: parseInt(match[3], 16)
        };
    }

    // Writes raw Firmata bytes to the hardware transport.
    write(data, callback) {
        this.port.write(Buffer.from(data), callback);
    }
}

module.exports = FirmataPixelStrip;
