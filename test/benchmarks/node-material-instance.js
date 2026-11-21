import assert from 'node:assert/strict';
import { createServer } from '../../utils/server.js';
import { launchBrowser } from '../../utils/browser.js';

// Run from the repository root with: bun run benchmark-node-material-instance
// Rotate ordering to reduce the effect of browser and driver warm-up.
const runs = 3;
const modes = [
	{ name: 'node material', page: 'node-material', builds: 10000 },
	{ name: 'material instance', page: 'material-instance', builds: 1 }
];
const metrics = {
	firstRender: 'first render',
	secondRender: 'second render',
	uniformRender: 'uniform update'
};
const samples = Object.fromEntries( modes.map( mode => [ mode.name, []] ) );
const server = createServer();
let browser;

try {

	await new Promise( resolve => server.listen( 0, resolve ) );
	browser = await launchBrowser( { headless: true, args: [ '--enable-unsafe-webgpu' ] } );

	for ( let run = 0; run < runs; run ++ ) {

		const order = [ ...modes.slice( run % modes.length ), ...modes.slice( 0, run % modes.length ) ];

		for ( const mode of order ) {

			const page = await browser.newPage();
			const errors = [];
			page.on( 'pageerror', error => errors.push( error.message ) );
			await page.goto( `http://localhost:${ server.address().port }/test/benchmarks/node-material-instance/${ mode.page }.html` );
			await page.waitForFunction( () => window.benchmarkResults !== undefined, { timeout: 120000 } );
			await page.click( '#update' );
			await page.waitForFunction( () => window.benchmarkResults.uniformRender !== undefined );
			const result = await page.evaluate( () => window.benchmarkResults );

			assert.deepEqual( errors, [], 'The example must run without errors' );
			assert.equal( result.count, 10000 );
			assert.ok( result.drawCalls >= 10000, 'All meshes must be drawn, plus any output pass' );

			assert.equal( result.firstBuilds, mode.builds );
			assert.equal( result.updateBuilds, 0, 'Uniform updates must not rebuild shaders' );

			samples[ mode.name ].push( result );
			const builds = `${ result.firstBuilds } node builds`;
			console.log( `Run ${ run + 1 }, ${ mode.name }: ${ result.firstRender.toFixed( 1 ) } ms, ${ builds } (${ result.backend })` );

			await page.close();

		}

	}

	const nodeSamples = modes.flatMap( mode => samples[ mode.name ] );
	const backends = new Set( nodeSamples.map( sample => sample.backend ) );
	assert.equal( backends.size, 1, 'Node material examples must use the same backend' );
	assert.equal( new Set( nodeSamples.map( sample => sample.drawCalls ) ).size, 1, 'Node material examples must issue the same number of draws' );

	const rows = {};

	for ( const metric in metrics ) {

		const row = rows[ metrics[ metric ] ] = {};

		for ( const mode of modes ) {

			const values = samples[ mode.name ].map( sample => sample[ metric ] ).sort( ( a, b ) => a - b );
			row[ mode.name ] = `${ values[ Math.floor( values.length / 2 ) ].toFixed( 1 ) } ms`;

		}

	}

	console.log( `Median of ${ runs } runs, CPU milliseconds (${ [ ...backends ][ 0 ] }). GPU completion is not timed.` );
	console.table( rows );

} finally {

	if ( browser !== undefined ) await browser.close();
	server.close();

}
