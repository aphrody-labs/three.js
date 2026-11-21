// Bundles src/ into build/ with Bun.build.
//
//   bun run utils/build/build.ts [--watch] [--sourcemap]
//
// Outputs (ESM, browser target):
//   three.webgpu.js / three.webgpu.min.js              src/Three.WebGPU.js
//   three.webgpu.nodes.js / three.webgpu.nodes.min.js  src/Three.WebGPU.Nodes.js
//   three.tsl.js                                       thin re-export of the TSL namespace of three.webgpu.js
//
// three.tsl.js must not bundle the node classes a second time: the node registry
// lives in three.webgpu.js and examples import both, so a second copy would break it.

import { watch } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath( new URL( '../../', import.meta.url ) );
const sourceDirectory = `${ root }src`;
const outputDirectory = `${ root }build`;

const license = `/**
 * @license
 * Copyright 2010-${ new Date().getFullYear() } Three.js Authors
 * SPDX-License-Identifier: MIT
 */
`;

const bundles = [
	{ name: 'three.webgpu', entry: 'src/Three.WebGPU.js' },
	{ name: 'three.webgpu.nodes', entry: 'src/Three.WebGPU.Nodes.js' }
];

const reservedWords = new Set( [
	'arguments', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
	'else', 'enum', 'eval', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements', 'import', 'in',
	'instanceof', 'interface', 'let', 'new', 'null', 'package', 'private', 'protected', 'public', 'return', 'static', 'super',
	'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'
] );

async function bundle( entry: string, name: string, minify: boolean, sourcemap: boolean ): Promise<void> {

	const result = await Bun.build( {
		entrypoints: [ `${ root }${ entry }` ],
		outdir: outputDirectory,
		naming: `${ name }.js`,
		target: 'browser',
		format: 'esm',
		minify,
		sourcemap: sourcemap ? 'inline' : 'none',
		banner: license
	} );

	if ( ! result.success ) throw new AggregateError( result.logs, `Bun.build failed for ${ entry }` );

}

// The export list comes from the real exports of src/nodes/TSL.js, never from a hand-kept list.
async function writeTSLModule(): Promise<number> {

	const names = Object.keys( await import( pathToFileURL( `${ sourceDirectory }/Three.TSL.js` ).href ) ).sort();

	const bindings = names.map( name => reservedWords.has( name ) ? `${ name }: _${ name }` : name );
	const exported = names.map( name => reservedWords.has( name ) ? `_${ name } as ${ name }` : name );

	await Bun.write( `${ outputDirectory }/three.tsl.js`, `${ license }import { TSL } from './three.webgpu.js';

const { ${ bindings.join( ', ' ) } } = TSL;

export { ${ exported.join( ', ' ) } };
` );

	const built = await import( pathToFileURL( `${ outputDirectory }/three.webgpu.js` ).href );
	const missing = names.filter( name => ! ( name in built.TSL ) );

	if ( missing.length > 0 ) throw new Error( `three.webgpu.js does not export these TSL names: ${ missing.join( ', ' ) }` );

	return names.length;

}

async function build( sourcemap: boolean ): Promise<void> {

	const start = performance.now();

	await rm( outputDirectory, { recursive: true, force: true } );
	await mkdir( outputDirectory, { recursive: true } );

	await Promise.all( bundles.flatMap( ( { name, entry } ) => [
		bundle( entry, name, false, sourcemap ),
		bundle( entry, `${ name }.min`, true, false )
	] ) );

	const count = await writeTSLModule();

	for ( const file of [ ...bundles.flatMap( ( { name } ) => [ `${ name }.js`, `${ name }.min.js` ] ), 'three.tsl.js' ] ) {

		const bytes = new Uint8Array( await Bun.file( `${ outputDirectory }/${ file }` ).arrayBuffer() );
		console.log( `build/${ file }`.padEnd( 34 ), `${ ( bytes.length / 1024 ).toFixed( 2 ) } KB`.padStart( 12 ), `${ ( Bun.gzipSync( bytes ).length / 1024 ).toFixed( 2 ) } KB gzip`.padStart( 18 ) );

	}

	console.log( `three.tsl.js re-exports ${ count } TSL names, built in ${ Math.round( performance.now() - start ) } ms` );

}

const watching = Bun.argv.includes( '--watch' );
const sourcemap = Bun.argv.includes( '--sourcemap' );

await build( sourcemap );

if ( watching ) {

	let timer: ReturnType<typeof setTimeout> | undefined;
	let running = false;

	watch( sourceDirectory, { recursive: true }, () => {

		clearTimeout( timer );
		timer = setTimeout( async () => {

			if ( running ) return;

			running = true;

			try {

				await build( sourcemap );

			} catch ( error ) {

				console.error( error );

			}

			running = false;

		}, 100 );

	} );

	console.log( 'Watching src/ for changes...' );

}
