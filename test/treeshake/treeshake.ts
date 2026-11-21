// Tree-shaking check: bundles the full builds and minimal scenes (renderer, camera,
// empty scene) with Bun.build and fails when tree-shaking removes nothing.
//
//   bun run build && bun run test/treeshake/treeshake.ts [--json]
//
// index.webgpu.tsl.js imports build/three.webgpu.js and build/three.tsl.js, so the build must exist.

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath( new URL( '../../', import.meta.url ) );
const outputDirectory = `${ root }test/treeshake`;

interface Target {
	name: string;
	entry: string;
	full?: string;
}

const targets: Target[] = [
	{ name: 'three.webgpu', entry: 'src/Three.WebGPU.js' },
	{ name: 'three.webgpu.nodes', entry: 'src/Three.WebGPU.Nodes.js' },
	{ name: 'index.webgpu', entry: 'test/treeshake/index.webgpu.js', full: 'three.webgpu' },
	{ name: 'index.webgpu.nodes', entry: 'test/treeshake/index.webgpu.nodes.js', full: 'three.webgpu.nodes' },
	{ name: 'index.webgpu.tsl', entry: 'test/treeshake/index.webgpu.tsl.js', full: 'three.webgpu' }
];

interface Row {
	name: string;
	minified: number;
	gzip: number;
}

async function bundle( { name, entry }: Target ): Promise<Row> {

	const options = { entrypoints: [ `${ root }${ entry }` ], outdir: outputDirectory, target: 'browser', format: 'esm' } as const;

	const [ plain, minified ] = await Promise.all( [
		Bun.build( { ...options, naming: `${ name }.bundle.js` } ),
		Bun.build( { ...options, naming: `${ name }.bundle.min.js`, minify: true } )
	] );

	for ( const result of [ plain, minified ] ) if ( ! result.success ) throw new AggregateError( result.logs, `Bun.build failed for ${ entry }` );

	const bytes = new Uint8Array( await minified.outputs[ 0 ].arrayBuffer() );

	return { name, minified: bytes.length, gzip: Bun.gzipSync( bytes ).length };

}

await mkdir( outputDirectory, { recursive: true } );

const rows = await Promise.all( targets.map( bundle ) );
const sizes = new Map( rows.map( row => [ row.name, row ] ) );

if ( Bun.argv.includes( '--json' ) ) {

	console.log( JSON.stringify( rows, null, '\t' ) );

} else {

	for ( const { name, minified, gzip } of rows ) console.log( name.padEnd( 22 ), `${ ( minified / 1000 ).toFixed( 2 ) } kB`.padStart( 12 ), `${ ( gzip / 1000 ).toFixed( 2 ) } kB gzip`.padStart( 18 ) );

}

const failures = targets.flatMap( ( { name, full } ) => {

	const shaken = sizes.get( name );
	const complete = full === undefined ? undefined : sizes.get( full );

	return shaken !== undefined && complete !== undefined && shaken.minified >= complete.minified ? [ `${ name } (${ shaken.minified } B) is not smaller than ${ full } (${ complete.minified } B)` ] : [];

} );

if ( failures.length > 0 ) {

	console.error( `Tree-shaking failed:\n${ failures.join( '\n' ) }` );
	process.exit( 1 );

}
