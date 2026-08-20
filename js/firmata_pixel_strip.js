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
    constructor({ firmata, pin, length, gamma = 2.8 }) {
        this.port = firmata.transport || firmata.sp || firmata;
        this.pin = pin;
        this.length = length;
        this.gamma = gamma;
    }

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

    pixel(index) {
        return {
            color: (color) => this.setPixel(index, color),
            off: () => this.setPixel(index, '#000000')
        };
    }

    color(color) {
        this.writeColorCommand(PIXEL_SET_STRIP, this.toColorValue(color));
    }

    off() {
        this.color('#000000');
        this.show();
    }

    show() {
        this.write([START_SYSEX, PIXEL_COMMAND, PIXEL_SHOW, END_SYSEX]);
    }

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

    toColorValue(color) {
        const { r, g, b } = this.parseColor(color);
        const gamma = (value) => Math.floor(Math.pow(value / 255, this.gamma) * 255 + 0.5);

        return (gamma(r) << 16) + (gamma(g) << 8) + gamma(b);
    }

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

    write(data, callback) {
        this.port.write(Buffer.from(data), callback);
    }
}

module.exports = FirmataPixelStrip;
