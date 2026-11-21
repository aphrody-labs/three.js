import { mkdir, rm } from 'node:fs/promises';

// Unbundled dev build: build/ re-exports src/, so edits show up on reload.
await rm( './build', { recursive: true, force: true } );

await mkdir( './build' );

const contents = {
	'three.tsl.js': 'export * from \'../src/Three.TSL.js\';',
	'three.webgpu.js': 'export * from \'../src/Three.WebGPU.js\';',
	'three.webgpu.nodes.js': 'export * from \'../src/Three.WebGPU.Nodes.js\';'
};

await Promise.all( Object.entries( contents ).map( ( [ filename, content ] ) =>
	Bun.write( `./build/${ filename }`, '// dev build\n' + content + '\n' )
) );
