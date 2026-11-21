import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '../..' );

// Start the bundler in watch mode
const build = Bun.spawn( [ process.execPath, 'run', 'utils/build/build.ts', '--watch', '--sourcemap' ], {
	cwd: rootDir,
	stdout: 'pipe',
	stderr: 'pipe'
} );

// Start server
const server = Bun.spawn( [ process.execPath, 'run', 'utils/server.js', '-p', '8080' ], {
	cwd: rootDir,
	stdout: 'pipe',
	stderr: 'pipe'
} );

// Prefix output
const prefix = async ( stream, name, color ) => {

	const decoder = new TextDecoder();

	for await ( const chunk of stream ) {

		const lines = decoder.decode( chunk ).split( '\n' ).filter( l => l.trim() );

		for ( const line of lines ) {

			console.log( `${color}[${name}]\x1b[0m ${line}` );

		}

	}

};

prefix( build.stdout, 'BUN BUILD', '\x1b[44m\x1b[1m' );
prefix( build.stderr, 'BUN BUILD', '\x1b[44m\x1b[1m' );
prefix( server.stdout, 'HTTP', '\x1b[42m\x1b[1m' );
prefix( server.stderr, 'HTTP', '\x1b[42m\x1b[1m' );

// Handle cleanup
const cleanup = () => {

	build.kill();
	server.kill();
	process.exit( 0 );

};

process.on( 'SIGINT', cleanup );
process.on( 'SIGTERM', cleanup );

build.exited.then( cleanup );
server.exited.then( cleanup );
