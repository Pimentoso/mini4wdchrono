// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

const sp = require('serialport');

window.addEventListener('DOMContentLoaded', () => {
	sp.SerialPort.list().then(ports => {
		ports.forEach(function (port) {
			$('#js-config-usb-port').append($('<option>', {
				value: port.path,
				text: port.manufacturer ? `${port.path} (${port.manufacturer})` : port.path
			}));
		});
	});
})
