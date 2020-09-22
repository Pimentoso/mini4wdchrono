'use strict';

const fs = require('fs');
const { google } = require('googleapis');
const ElectronGoogleOAuth2 = require('@getstation/electron-google-oauth2').default;
const configuration = require('./configuration');
configuration.init();

const CREDENTIALS_FILE_PATH = 'config/credentials.json';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Load the app credentials file.
const loadCredentials = () => {
	if (!fs.existsSync(CREDENTIALS_FILE_PATH)) {
		return console.log('Error loading application credentials.');
	}
	return JSON.parse(fs.readFileSync(CREDENTIALS_FILE_PATH));
};

// Use stored access token and create an API client.
const getClient = () => {
	let token = configuration.get('google_spreadsheets_token');
	if (token == null) {
		console.log('No access token present. Please use getNewToken function.');
	}

	let credentials = loadCredentials();
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
	oAuth2Client.setCredentials(JSON.parse(token));
	return oAuth2Client;
}

// Start the Oauth2 process to create a new user access token.
const getNewToken = () => {
	let credentials = loadCredentials();
	const {client_secret, client_id, redirect_uris} = credentials.installed;
	// Authorize a client with credentials, then call the Google Sheets API.
	const myApiOauth = new ElectronGoogleOAuth2(client_id, client_secret, SCOPES);
	myApiOauth.openAuthWindowAndGetTokens()
		.then(token => {
			// Store the token to disk for later program executions.
			configuration.set('google_spreadsheets_token', JSON.stringify(token));
		});
};

const create = (title) => {
	const client = getClient();
	const sheets = google.sheets({version: 'v4'});

	sheets.spreadsheets.create({
		auth: client,
		resource: {
			properties: {
				title: title,
			}
		}
	}, (err, spreadsheet) =>{
		if (err) {
			// Handle error.
			console.log(err);
		}
		else {
			return spreadsheet.spreadsheetId;
		}
	});
};

const write = () => {
	let values = [
		[
			// Cell values ...
		],
		// Additional rows ...
	];
	const resource = {
		values,
	};
	const client = getClient();
	client.sheetsService.spreadsheets.values.update({
		spreadsheetId,
		range,
		valueInputOption,
		resource,
	}, (err, result) => {
		if (err) {
			// Handle error
			console.log(err);
		} else {
			console.log('%d cells updated.', result.updatedCells);
		}
	});
};

module.exports = {
	getNewToken: getNewToken,
	create: create
};
