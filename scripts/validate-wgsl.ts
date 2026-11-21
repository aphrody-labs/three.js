/**
 * Validates the WGSL modules captured by scripts/capture-wgsl.ts with naga-cli on a remote host.
 *
 *   bun scripts/validate-wgsl.ts [--dir CAPTURE_DIR] [--host fr1] [--naga '~/.cargo/bin/naga'] [--report FILE] [--capabilities all]
 *
 * Copies <dir>/unique/*.wgsl over ssh (tar), runs `naga --bulk-validate` and writes a JSON report:
 * naga version, pass/fail per module, error message, error class, labels and examples, plus a
 * per-class aggregate. Capabilities default to naga's own default (all), i.e. the validator is as
 * permissive as it can be about device features; anything it still rejects is a real incompatibility.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs( {
	options: {
		dir: { type: 'string', default: join( tmpdir(), 'wgsl-capture' ) },
		host: { type: 'string', default: 'fr1' },
		naga: { type: 'string', default: '~/.cargo/bin/naga' },
		report: { type: 'string' },
		capabilities: { type: 'string' },
	},
} );

const dir = resolve( args.dir! );
const reportPath = resolve( args.report ?? join( dir, 'naga-report.json' ) );
const manifest = JSON.parse( readFileSync( join( dir, 'manifest.json' ), 'utf8' ) );
const hashes = Object.keys( manifest.modules );
const remoteDir = `/tmp/wgsl-validate-${ Date.now() }`;
const capabilities = args.capabilities ? `--capabilities ${ args.capabilities }` : '';

async function ssh( command: string, stdin?: ReadableStream<Uint8Array> | null ) {

	const proc = Bun.spawn( [ 'ssh', '-o', 'BatchMode=yes', args.host!, command ], { stdin: stdin ?? 'ignore', stdout: 'pipe', stderr: 'pipe' } );
	const [ stdout, stderr ] = await Promise.all( [ new Response( proc.stdout ).text(), new Response( proc.stderr ).text() ] );
	return { stdout, stderr, code: await proc.exited };

}

// tar | ssh: scp is not reliably available next to ssh on every Windows shell.
const tar = Bun.spawn( [ 'tar', 'cf', '-', '-C', join( dir, 'unique' ), '.' ], { stdout: 'pipe', stderr: 'inherit' } );
const upload = await ssh( `rm -rf ${ remoteDir } && mkdir -p ${ remoteDir } && tar xf - -C ${ remoteDir }`, tar.stdout );
if ( upload.code !== 0 || await tar.exited !== 0 ) throw new Error( `upload failed: ${ upload.stderr }` );

const version = ( await ssh( `${ args.naga } --version` ) ).stdout.trim();
const run = await ssh( `cd ${ remoteDir } && ${ args.naga } ${ capabilities } --bulk-validate *.wgsl 2>&1; echo NAGA_RC=$?; cd / && rm -rf ${ remoteDir }` );

const output = run.stdout.replace( /\x1b\[[0-9;]*m/g, '' );
const failures = new Map<string, string>();
const blockPattern = /^Error validating (\S+\.wgsl):\n([\s\S]*?)(?=^Error validating \S+\.wgsl:|^Validation failed for the following inputs:|^NAGA_RC=)/gm;

for ( const match of output.matchAll( blockPattern ) ) failures.set( match[ 1 ].replace( /\.wgsl$/, '' ), match[ 2 ].trim() );

// Identifiers, numbers and quoted names are collapsed so that equal generator bugs share one class.
const errorClass = ( text: string ) => {

	const line = text.split( '\n' ).find( candidate => /^(error|Shader validation error|.*(?:Error|error):)/.test( candidate ) && ! candidate.startsWith( 'Could not' ) ) ?? text.split( '\n' )[ 0 ];
	return line.replace( /`[^`]*`/g, '`_`' ).replace( /"[^"]*"/g, '"_"' ).replace( /'[^']*'/g, '\'_\'' ).replace( /\b\d+\b/g, 'N' ).trim();

};

const modules = hashes.map( hash => {

	const entry = manifest.modules[ hash ];
	const error = failures.get( hash );

	return {
		hash,
		pass: error === undefined,
		class: error === undefined ? null : errorClass( error ),
		error: error ?? null,
		labels: entry.labels,
		examples: entry.examples,
		chromeMessages: entry.compilation.length,
	};

} );

const classes: Record<string, { count: number; examples: string[]; sample: string }> = {};

for ( const module of modules.filter( candidate => ! candidate.pass ) ) {

	const bucket = classes[ module.class! ] ??= { count: 0, examples: [], sample: module.hash };
	bucket.count ++;
	for ( const example of module.examples ) if ( ! bucket.examples.includes( example ) ) bucket.examples.push( example );

}

const unaccounted = ( output.match( /NAGA_RC=(\d+)/ )?.[ 1 ] ?? '?' ) !== '0' && failures.size === 0;

const report = {
	generatedAt: new Date().toISOString(),
	naga: version,
	host: args.host,
	capture: manifest.summary,
	total: modules.length,
	passed: modules.filter( module => module.pass ).length,
	failed: failures.size,
	classes,
	modules: modules.sort( ( a, b ) => Number( a.pass ) - Number( b.pass ) || a.hash.localeCompare( b.hash ) ),
	...( unaccounted ? { rawOutput: output.slice( 0, 4000 ) } : {} ),
};

writeFileSync( reportPath, JSON.stringify( report, null, '\t' ) );

console.log( `${ version }: ${ report.passed }/${ report.total } modules pass, ${ report.failed } fail, ${ Object.keys( classes ).length } error classes -> ${ reportPath }` );
for ( const [ name, bucket ] of Object.entries( classes ).sort( ( [ , a ], [ , b ] ) => b.count - a.count ) ) console.log( `${ String( bucket.count ).padStart( 5 ) }  ${ name }  (${ bucket.examples.length } examples, e.g. ${ bucket.sample })` );
if ( unaccounted ) console.log( `unparsed naga output:\n${ output.slice( 0, 2000 ) }` );

process.exit( failures.size > 0 || unaccounted ? 1 : 0 );
