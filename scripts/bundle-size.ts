import { brotliCompressSync, constants } from 'node:zlib';

const entries = Bun.argv.slice( 2 );
const targets = entries.length > 0 ? entries : [ 'src/Three.js', 'src/Three.WebGPU.js', 'src/Three.TSL.js' ];

const rows: Array<{ entry: string; minified: number; brotli: number }> = [];

for ( const entry of targets ) {

	if ( ! ( await Bun.file( entry ).exists() ) ) continue;

	const result = await Bun.build( { entrypoints: [ entry ], minify: true, format: 'esm', target: 'browser' } );

	if ( ! result.success ) throw new AggregateError( result.logs, `bun build failed for ${ entry }` );

	const bytes = new Uint8Array( await result.outputs[ 0 ].arrayBuffer() );
	const brotli = brotliCompressSync( bytes, { params: { [ constants.BROTLI_PARAM_QUALITY ]: 11 } } ).length;

	rows.push( { entry, minified: bytes.length, brotli } );

}

console.log( JSON.stringify( rows, null, '\t' ) );
