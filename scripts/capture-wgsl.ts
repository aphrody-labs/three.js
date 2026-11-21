/**
 * Loads every examples/webgpu_*.html in headless Chrome over raw CDP and records each WGSL module,
 * bind group layout, pipeline layout and pipeline descriptor the examples create, together with
 * Chrome's own diagnostics (getCompilationInfo, validation errors, console, uncaught exceptions).
 *
 *   bun scripts/capture-wgsl.ts [--out DIR] [--only a,b] [--concurrency N] [--quiet-ms 2000] [--cap-ms 20000]
 *
 * Output (default <tmp>/wgsl-capture):
 *   <example>/<n>.wgsl      modules of one example in creation order
 *   <example>/layouts.json  bind group layouts, pipeline layouts, pipelines
 *   unique/<hash>.wgsl      deduplicated modules (hash = first 16 hex of sha256)
 *   manifest.json           per example status/errors, per hash examples/labels/Chrome compilation messages
 */

import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import * as TSLExports from '../src/Three.TSL.js';

const { values: args } = parseArgs( {
	options: {
		out: { type: 'string', default: join( tmpdir(), 'wgsl-capture' ) },
		only: { type: 'string' },
		concurrency: { type: 'string', default: '4' },
		'quiet-ms': { type: 'string', default: '2000' },
		'cap-ms': { type: 'string', default: '20000' },
		chrome: { type: 'string' },
		headful: { type: 'boolean', default: false },
	},
} );

const root = resolve( import.meta.dir, '..' );
const outDir = resolve( args.out! );
const quietMs = Number( args[ 'quiet-ms' ] );
const capMs = Number( args[ 'cap-ms' ] );
const concurrency = Number( args.concurrency );

const log = ( ...parts: unknown[] ) => console.error( `[capture ${ ( performance.now() / 1000 ).toFixed( 1 ).padStart( 6 ) }s]`, ...parts );

// ---------------------------------------------------------------------------------------------
// Static server: examples/, src/, files/ from the repo root plus the in-memory bundles.
// ---------------------------------------------------------------------------------------------

const build = await Bun.build( {
	entrypoints: [ join( root, 'src/Three.WebGPU.js' ) ],
	format: 'esm',
	target: 'browser',
	minify: false,
} );

if ( ! build.success ) throw new AggregateError( build.logs, 'Bun.build of src/Three.WebGPU.js failed' );

const webgpuBundle = await build.outputs[ 0 ].text();

const tslNames = Object.keys( TSLExports ).filter( name => name !== 'default' && /^[A-Za-z_$][\w$]*$/.test( name ) ).sort();
const tslBundle = `import { TSL } from './three.webgpu.js';\nexport const { ${ tslNames.join( ', ' ) } } = TSL;\n`;

const memoryFiles = new Map<string, string>( [
	[ '/build/three.webgpu.js', webgpuBundle ],
	[ '/build/three.tsl.js', tslBundle ],
] );

const served = [ 'examples', 'src', 'files' ].map( name => join( root, name ) + sep );
const missing = new Set<string>();

const server = Bun.serve( {
	port: 0,
	async fetch( request ) {

		const { pathname } = new URL( request.url );
		const path = decodeURIComponent( pathname );
		const memory = memoryFiles.get( path );

		if ( memory !== undefined ) return new Response( memory, { headers: { 'content-type': 'text/javascript' } } );

		const file = normalize( join( root, path ) );

		if ( served.some( prefix => file.startsWith( prefix ) ) ) {

			const handle = Bun.file( file );
			if ( await handle.exists() ) return new Response( handle );

		}

		missing.add( path );
		return new Response( 'not found', { status: 404 } );

	},
} );

const origin = `http://localhost:${ server.port }`;

// ---------------------------------------------------------------------------------------------
// Chrome + CDP
// ---------------------------------------------------------------------------------------------

const chromeCandidates = [
	args.chrome,
	process.env.CHROME_PATH,
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
	'/usr/bin/google-chrome',
	'/usr/bin/chromium',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter( ( path ): path is string => !! path && existsSync( path ) );

if ( chromeCandidates.length === 0 ) throw new Error( 'Chrome executable not found (use --chrome)' );

const profileDir = mkdtempSync( join( tmpdir(), 'wgsl-capture-profile-' ) );

const chrome = Bun.spawn( [
	chromeCandidates[ 0 ],
	...( args.headful ? [] : [ '--headless=new' ] ),
	'--remote-debugging-port=0',
	`--user-data-dir=${ profileDir }`,
	'--enable-unsafe-webgpu',
	'--enable-features=Vulkan',
	'--ignore-gpu-blocklist',
	'--no-first-run',
	'--no-default-browser-check',
	'--window-size=1280,800',
	'--autoplay-policy=no-user-gesture-required',
	'--disable-background-timer-throttling',
	'--disable-renderer-backgrounding',
	'--disable-backgrounding-occluded-windows',
	'--use-fake-ui-for-media-stream',
	'--use-fake-device-for-media-stream',
	'about:blank',
], { stdout: 'ignore', stderr: 'ignore' } );

async function shutdown() {

	chrome.kill();
	server.stop( true );
	await Bun.sleep( 500 );
	rmSync( profileDir, { recursive: true, force: true, maxRetries: 5 } );

}

type Json = any; // CDP payloads are untyped JSON

class Cdp {

	private socket!: WebSocket;
	private nextId = 1;
	private pending = new Map<number, { resolve: ( value: Json ) => void; reject: ( error: Error ) => void; method: string }>();
	private listeners = new Set<( method: string, params: Json, sessionId?: string ) => void>();

	static async connect( url: string ) {

		const cdp = new Cdp();
		cdp.socket = new WebSocket( url );
		await new Promise<void>( ( resolveOpen, rejectOpen ) => {

			cdp.socket.onopen = () => resolveOpen();
			cdp.socket.onerror = () => rejectOpen( new Error( `CDP connect failed: ${ url }` ) );

		} );

		cdp.socket.onmessage = event => {

			const message = JSON.parse( String( event.data ) );

			if ( message.id !== undefined ) {

				const entry = cdp.pending.get( message.id );
				cdp.pending.delete( message.id );
				if ( message.error ) entry?.reject( new Error( `${ entry.method }: ${ message.error.message }` ) );
				else entry?.resolve( message.result );

			} else {

				for ( const listener of cdp.listeners ) listener( message.method, message.params, message.sessionId );

			}

		};

		return cdp;

	}

	send( method: string, params: Json = {}, sessionId?: string, timeoutMs = 60000 ): Promise<Json> {

		const id = this.nextId ++;

		return new Promise( ( resolveSend, rejectSend ) => {

			const timer = setTimeout( () => {

				this.pending.delete( id );
				rejectSend( new Error( `${ method}: timeout after ${ timeoutMs } ms` ) );

			}, timeoutMs );

			this.pending.set( id, {
				method,
				resolve: value => { clearTimeout( timer ); resolveSend( value ); },
				reject: error => { clearTimeout( timer ); rejectSend( error ); },
			} );

			this.socket.send( JSON.stringify( { id, method, params, sessionId } ) );

		} );

	}

	on( listener: ( method: string, params: Json, sessionId?: string ) => void ) {

		this.listeners.add( listener );
		return () => this.listeners.delete( listener );

	}

}

async function devtoolsUrl() {

	const portFile = join( profileDir, 'DevToolsActivePort' );

	for ( let attempt = 0; attempt < 100; attempt ++ ) {

		if ( existsSync( portFile ) ) {

			const [ port ] = readFileSync( portFile, 'utf8' ).split( '\n' );
			const response = await fetch( `http://127.0.0.1:${ port }/json/version` ).catch( () => null );
			if ( response?.ok ) return ( await response.json() ) as { webSocketDebuggerUrl: string; Browser: string };

		}

		await Bun.sleep( 200 );

	}

	throw new Error( 'Chrome DevTools endpoint did not come up' );

}

// ---------------------------------------------------------------------------------------------
// Page-side hook (runs before any page script)
// ---------------------------------------------------------------------------------------------

const hookSource = /* js */`( () => {

	if ( ! navigator.gpu || window.__cap ) return;

	const cap = window.__cap = { modules: [], bindGroupLayouts: [], pipelineLayouts: [], pipelines: [], devices: [], errors: [], pending: [], last: 0 };
	const ids = new WeakMap();
	const note = ( kind, message ) => cap.errors.push( { kind, message: String( message ), t: Math.round( performance.now() ) } );

	const scoped = ( device, kind, label, fn ) => {

		device.pushErrorScope( 'validation' );

		try {

			return fn();

		} finally {

			device.popErrorScope().then( error => { if ( error ) note( kind + ( label ? ' [' + label + ']' : '' ), error.message ); }, () => {} );

		}

	};

	const requestDevice = GPUAdapter.prototype.requestDevice;

	GPUAdapter.prototype.requestDevice = async function ( descriptor ) {

		const device = await requestDevice.call( this, descriptor );

		device.addEventListener( 'uncapturederror', event => note( 'uncapturederror', event.error.message ) );
		device.lost.then( info => note( 'device-lost', info.reason + ': ' + info.message ) );
		cap.devices.push( { requiredFeatures: [ ...( descriptor?.requiredFeatures ?? [] ) ], features: [ ...device.features ], requiredLimits: { ...( descriptor?.requiredLimits ?? {} ) } } );

		return device;

	};

	const createShaderModule = GPUDevice.prototype.createShaderModule;

	GPUDevice.prototype.createShaderModule = function ( descriptor ) {

		const module = scoped( this, 'createShaderModule', descriptor.label, () => createShaderModule.call( this, descriptor ) );
		const entry = { id: cap.modules.length, label: descriptor.label ?? '', code: descriptor.code, compilation: [] };

		ids.set( module, entry.id );
		cap.modules.push( entry );
		cap.last = performance.now();
		cap.pending.push( module.getCompilationInfo().then(
			info => { entry.compilation = info.messages.map( m => ( { type: m.type, message: m.message, line: m.lineNum, column: m.linePos } ) ); },
			error => note( 'getCompilationInfo', error.message )
		) );

		return module;

	};

	const createBindGroupLayout = GPUDevice.prototype.createBindGroupLayout;

	GPUDevice.prototype.createBindGroupLayout = function ( descriptor ) {

		const layout = scoped( this, 'createBindGroupLayout', descriptor.label, () => createBindGroupLayout.call( this, descriptor ) );
		const id = cap.bindGroupLayouts.length;

		ids.set( layout, id );
		cap.bindGroupLayouts.push( { id, label: descriptor.label ?? '', entries: JSON.parse( JSON.stringify( descriptor.entries ) ) } );

		return layout;

	};

	const createPipelineLayout = GPUDevice.prototype.createPipelineLayout;

	GPUDevice.prototype.createPipelineLayout = function ( descriptor ) {

		const layout = scoped( this, 'createPipelineLayout', descriptor.label, () => createPipelineLayout.call( this, descriptor ) );
		const id = cap.pipelineLayouts.length;

		ids.set( layout, id );
		cap.pipelineLayouts.push( { id, label: descriptor.label ?? '', bindGroupLayouts: descriptor.bindGroupLayouts.map( l => ids.get( l ) ) } );

		return layout;

	};

	const stage = ( s ) => s ? { module: ids.get( s.module ), entryPoint: s.entryPoint ?? null, constants: s.constants ? Object.keys( s.constants ) : [] } : null;

	for ( const name of [ 'createRenderPipeline', 'createComputePipeline', 'createRenderPipelineAsync', 'createComputePipelineAsync' ] ) {

		const original = GPUDevice.prototype[ name ];
		const isAsync = name.endsWith( 'Async' );
		const kind = name.includes( 'Render' ) ? 'render' : 'compute';

		GPUDevice.prototype[ name ] = function ( descriptor ) {

			cap.pipelines.push( {
				kind,
				label: descriptor.label ?? '',
				layout: typeof descriptor.layout === 'string' ? descriptor.layout : ( ids.get( descriptor.layout ) ?? null ),
				vertex: stage( descriptor.vertex ), fragment: stage( descriptor.fragment ), compute: stage( descriptor.compute )
			} );

			if ( isAsync ) {

				const promise = original.call( this, descriptor );
				promise.catch( error => note( name + ( descriptor.label ? ' [' + descriptor.label + ']' : '' ), error.message ) );
				return promise;

			}

			return scoped( this, name, descriptor.label, () => original.call( this, descriptor ) );

		};

	}

} )();`;

// ---------------------------------------------------------------------------------------------
// Per-example capture
// ---------------------------------------------------------------------------------------------

type Diagnostic = { kind: string; message: string };

type CapturedModule = { id: number; label: string; code: string; compilation: { type: string; message: string; line: number; column: number }[] };

type Captured = {
	modules: CapturedModule[];
	bindGroupLayouts: Json[];
	pipelineLayouts: Json[];
	pipelines: Json[];
	devices: Json[];
	errors: { kind: string; message: string; t: number }[];
};

type ExampleResult = {
	status: 'shaders' | 'no-shaders' | 'failed';
	modules: string[];
	devices: Json[];
	errors: Diagnostic[];
	console: Diagnostic[];
	exceptions: string[];
	seconds: number;
	reason?: string;
};

const sha = ( code: string ) => createHash( 'sha256' ).update( code ).digest( 'hex' ).slice( 0, 16 );

const argText = ( arg: Json ) => arg.value !== undefined ? String( typeof arg.value === 'object' ? JSON.stringify( arg.value ) : arg.value ) : ( arg.description ?? arg.type );

async function captureExample( cdp: Cdp, name: string ): Promise<{ result: ExampleResult; captured: Captured | null }> {

	const started = performance.now();
	const result: ExampleResult = { status: 'no-shaders', modules: [], devices: [], errors: [], console: [], exceptions: [], seconds: 0 };
	let captured: Captured | null = null;
	let sessionId: string | undefined;
	let targetId: string | undefined;
	let stop = () => {};

	try {

		( { targetId } = await cdp.send( 'Target.createTarget', { url: 'about:blank', newWindow: true, width: 1280, height: 800 } ) );
		( { sessionId } = await cdp.send( 'Target.attachToTarget', { targetId, flatten: true } ) );

		const session = sessionId!;
		const call = ( method: string, params?: Json, timeoutMs?: number ) => cdp.send( method, params, session, timeoutMs );

		stop = cdp.on( ( method, params, eventSession ) => {

			if ( eventSession !== session ) return;

			if ( method === 'Runtime.exceptionThrown' ) {

				const details = params.exceptionDetails;
				result.exceptions.push( details.exception?.description ?? details.text );

			} else if ( method === 'Runtime.consoleAPICalled' && ( params.type === 'error' || params.type === 'warning' ) ) {

				result.console.push( { kind: params.type, message: params.args.map( argText ).join( ' ' ).slice( 0, 2000 ) } );

			} else if ( method === 'Log.entryAdded' && ( params.entry.level === 'error' || params.entry.level === 'warning' ) ) {

				result.console.push( { kind: `log-${ params.entry.level }`, message: `${ params.entry.text } ${ params.entry.url ?? '' }`.slice( 0, 2000 ) } );

			} else if ( method === 'Page.javascriptDialogOpening' ) {

				call( 'Page.handleJavaScriptDialog', { accept: true } ).catch( () => {} );

			}

		} );

		await Promise.all( [ call( 'Page.enable' ), call( 'Runtime.enable' ), call( 'Log.enable' ) ] );
		await call( 'Page.addScriptToEvaluateOnNewDocument', { source: hookSource } );
		await call( 'Page.bringToFront' ).catch( () => {} );
		await call( 'Page.navigate', { url: `${ origin }/examples/${ name }.html` } );

		let count = 0;
		let lastChange = performance.now();

		while ( performance.now() - started < capMs ) {

			await Bun.sleep( 250 );

			const state = await call( 'Runtime.evaluate', { expression: 'window.__cap ? window.__cap.modules.length : -1', returnByValue: true }, 10000 ).catch( () => null );
			const now = state?.result?.value ?? -1;

			if ( now !== count ) {

				count = now;
				lastChange = performance.now();

			}

			if ( count > 0 && performance.now() - lastChange >= quietMs ) break;

		}

		const dump = await call( 'Runtime.evaluate', {
			expression: `( async () => { await Promise.all( window.__cap?.pending ?? [] ); const { pending, last, ...rest } = window.__cap ?? {}; return JSON.stringify( rest ); } )()`,
			awaitPromise: true,
			returnByValue: true,
		}, 30000 );

		if ( dump.result?.value ) captured = JSON.parse( dump.result.value ) as Captured;

		result.devices = captured?.devices ?? [];
		result.errors = ( captured?.errors ?? [] ).map( ( { kind, message } ) => ( { kind, message } ) );
		result.modules = ( captured?.modules ?? [] ).map( module => sha( module.code ) );
		result.status = result.modules.length > 0 ? 'shaders' : 'no-shaders';

	} catch ( error ) {

		result.status = 'failed';
		result.reason = String( ( error as Error ).message ?? error );

	} finally {

		stop();
		if ( targetId ) await cdp.send( 'Target.closeTarget', { targetId } ).catch( () => {} );
		result.seconds = Math.round( ( performance.now() - started ) / 100 ) / 10;

	}

	return { result, captured };

}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

try {

	const version = await devtoolsUrl();
	const cdp = await Cdp.connect( version.webSocketDebuggerUrl );

	const probe = await ( async () => {

		const { targetId } = await cdp.send( 'Target.createTarget', { url: `${ origin }/examples/index.html` } );
		const { sessionId } = await cdp.send( 'Target.attachToTarget', { targetId, flatten: true } );

		await Bun.sleep( 500 );

		const evaluated = await cdp.send( 'Runtime.evaluate', {
			expression: `( async () => { const adapter = navigator.gpu ? await navigator.gpu.requestAdapter() : null; if ( ! adapter ) return null; const info = adapter.info; return { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description, features: [ ...adapter.features ] }; } )()`,
			awaitPromise: true,
			returnByValue: true,
		}, sessionId );

		await cdp.send( 'Target.closeTarget', { targetId } );
		return evaluated.result?.value ?? null;

	} )();

	if ( ! probe ) throw new Error( 'navigator.gpu.requestAdapter() returned null in headless Chrome' );
	log( `${ version.Browser }; adapter ${ probe.vendor } ${ probe.architecture } ${ probe.description }` );

	const only = args.only?.split( ',' ).filter( Boolean );
	const examples = readdirSync( join( root, 'examples' ) )
		.filter( file => /^webgpu_.*\.html$/.test( file ) )
		.map( file => file.slice( 0, - 5 ) )
		.filter( name => ! only || only.some( filter => name.includes( filter ) ) )
		.sort();

	rmSync( outDir, { recursive: true, force: true } );
	mkdirSync( join( outDir, 'unique' ), { recursive: true } );

	const manifest: { examples: Record<string, ExampleResult>; modules: Record<string, { bytes: number; examples: string[]; labels: string[]; compilation: Json[] }> } = { examples: {}, modules: {} };
	const queue = [ ...examples ];
	let done = 0;

	const worker = async () => {

		for ( let name = queue.shift(); name !== undefined; name = queue.shift() ) {

			const { result, captured } = await captureExample( cdp, name );
			manifest.examples[ name ] = result;

			if ( captured && captured.modules.length > 0 ) {

				const exampleDir = join( outDir, name );
				mkdirSync( exampleDir, { recursive: true } );

				captured.modules.forEach( ( module, index ) => {

					const hash = sha( module.code );
					writeFileSync( join( exampleDir, `${ index }.wgsl` ), module.code );
					writeFileSync( join( outDir, 'unique', `${ hash }.wgsl` ), module.code );

					const entry = manifest.modules[ hash ] ??= { bytes: module.code.length, examples: [], labels: [], compilation: [] };
					if ( ! entry.examples.includes( name ) ) entry.examples.push( name );
					if ( module.label && ! entry.labels.includes( module.label ) ) entry.labels.push( module.label );
					for ( const message of module.compilation ) if ( ! entry.compilation.some( known => known.message === message.message && known.line === message.line ) ) entry.compilation.push( message );

				} );

				const { bindGroupLayouts, pipelineLayouts, pipelines } = captured;
				writeFileSync( join( exampleDir, 'layouts.json' ), JSON.stringify( { bindGroupLayouts, pipelineLayouts, pipelines, moduleHashes: result.modules }, null, '\t' ) );

			}

			done ++;
			log( `${ String( done ).padStart( 3 ) }/${ examples.length } ${ name }: ${ result.status } (${ result.modules.length } modules, ${ result.errors.length } validation errors, ${ result.seconds }s)${ result.reason ? ' ' + result.reason : '' }` );

		}

	};

	await Promise.all( Array.from( { length: Math.max( 1, concurrency ) }, worker ) );

	const sortedExamples = Object.fromEntries( Object.entries( manifest.examples ).sort( ( [ a ], [ b ] ) => a.localeCompare( b ) ) );
	const statuses = Object.values( sortedExamples ).reduce( ( counts, example ) => ( counts[ example.status ] = ( counts[ example.status ] ?? 0 ) + 1, counts ), {} as Record<string, number> );

	const summary = {
		generatedAt: new Date().toISOString(),
		chrome: version.Browser,
		adapter: probe,
		examplesTotal: examples.length,
		statuses,
		uniqueModules: Object.keys( manifest.modules ).length,
		modulesWithChromeMessages: Object.values( manifest.modules ).filter( module => module.compilation.length > 0 ).length,
		examplesWithValidationErrors: Object.entries( sortedExamples ).filter( ( [ , example ] ) => example.errors.length > 0 ).map( ( [ name ] ) => name ),
		missingAssets: [ ...missing ].sort(),
	};

	writeFileSync( join( outDir, 'manifest.json' ), JSON.stringify( { summary, examples: sortedExamples, modules: manifest.modules }, null, '\t' ) );
	log( JSON.stringify( summary ) );

} finally {

	await shutdown();

}
