// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

const serialport = require('serialport');

window.addEventListener('DOMContentLoaded', () => {
	for (const versionType of ['chrome', 'electron', 'node']) {
		document.getElementById(`${versionType}-version`).innerText = process.versions[versionType]
	}

	document.getElementById('serialport-version').innerText = require('serialport/package').version

	serialport.list().then(ports => {
		ports.forEach(function (port) {
			$('#js-config-usb-port').append($('<option>', {
				value: port.path,
				text: port.manufacturer ? `${port.path} (${port.manufacturer})` : port.path
			}));
		});
	});
})
