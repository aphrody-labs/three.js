import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

// puppeteer-core ships no browser: use CHROME_PATH, or the first Chrome/Chromium found.
const candidates = [
	'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'chrome',
	'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
	'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

export function findChrome() {

	const executablePath = process.env.CHROME_PATH
		?? candidates.map( candidate => existsSync( candidate ) ? candidate : Bun.which( candidate ) ).find( Boolean );

	if ( ! executablePath ) throw new Error( 'Chrome or Chromium not found. Install one or set CHROME_PATH.' );

	return executablePath;

}

export function launchBrowser( options = {} ) {

	return puppeteer.launch( { executablePath: findChrome(), ...options } );

}
