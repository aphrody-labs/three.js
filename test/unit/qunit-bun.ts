// QUnit compatibility layer on top of bun:test.
//
// The suites under test/unit/src and test/unit/addons are written against the
// QUnit API (QUnit.module / QUnit.test / assert.*). This preload maps that
// subset onto bun:test so `bun test` runs them unchanged.
//
// Assertions are soft like in QUnit: a failing assertion is recorded and the
// test body keeps running; the test fails at its end with every recorded
// failure in the message.

import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { createServer } from '../../utils/server.js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from 'bun:test';

type Hook = ( assert: Assert ) => void | Promise<void>;
type TestBody = ( assert: Assert ) => unknown;

interface Result {
	result: boolean;
	actual?: unknown;
	expected?: unknown;
	message?: string;
}

const testTimeout = 20_000;

// QUnit.assert is the assert of the running test; the helpers in utils/qunit-utils.js
// call it directly instead of receiving it as an argument.
let running: Assert | undefined;

const show = ( value: unknown ): string => {

	const text = Bun.inspect( value, { depth: 3 } ).replace( /\s*\n\s*/g, ' ' );

	return text.length > 240 ? text.slice( 0, 240 ) + '...' : text;

};

// Port of QUnit.equiv: NaN equals NaN, 0 equals -0, for-in properties (inherited
// ones included) must match, constructors must match, and function-valued
// properties of class instances are ignored (per-instance closures such as the
// onChange callbacks of Object3D would otherwise never compare equal).
function equivalent( a: unknown, b: unknown, parents: [ unknown, unknown ][] = [], containers: unknown[] = [] ): boolean {

	if ( a === b ) return true;

	if ( typeof a === 'number' && typeof b === 'number' ) return a !== a && b !== b;

	if ( typeof a === 'function' && typeof b === 'function' ) return containers.length > 0 && containers[ containers.length - 1 ] !== Object;

	if ( typeof a !== 'object' || typeof b !== 'object' || a === null || b === null ) return false;

	if ( parents.some( ( [ x, y ] ) => x === a && y === b ) ) return true;

	if ( Object.prototype.toString.call( a ) !== Object.prototype.toString.call( b ) ) return false;

	const first = a as Record<string, unknown>;
	const second = b as Record<string, unknown>;

	if ( first.constructor !== second.constructor && ! ( ( first.constructor === undefined || first.constructor === Object ) && ( second.constructor === undefined || second.constructor === Object ) ) ) return false;

	if ( a instanceof Date ) return a.getTime() === ( b as Date ).getTime();

	if ( a instanceof RegExp ) return String( a ) === String( b );

	parents = [ ...parents, [ a, b ] ];
	containers = [ ...containers, first.constructor ];

	if ( Array.isArray( a ) ) {

		const other = b as unknown[];

		if ( a.length !== other.length ) return false;

		return a.every( ( value, index ) => equivalent( value, other[ index ], parents, containers ) );

	}

	if ( a instanceof Map || a instanceof Set ) {

		const mine = [ ...( a as Map<unknown, unknown> ).entries() ];
		const theirs = [ ...( b as Map<unknown, unknown> ).entries() ];

		return mine.length === theirs.length && mine.every( ( [ key, value ] ) => theirs.some( ( [ otherKey, otherValue ] ) => equivalent( key, otherKey, parents, containers ) && equivalent( value, otherValue, parents, containers ) ) );

	}

	const aKeys: string[] = [];
	const bKeys: string[] = [];

	for ( const key in first ) {

		aKeys.push( key );

		if ( ! equivalent( first[ key ], second[ key ], parents, containers ) ) return false;

	}

	for ( const key in second ) bKeys.push( key );

	return equivalent( aKeys.sort(), bKeys.sort(), parents, containers );

}

function ownProperties( value: unknown ): unknown {

	if ( value === null || typeof value !== 'object' ) return value;

	const properties: Record<string, unknown> = {};

	for ( const key of Object.keys( value ) ) properties[ key ] = ( value as Record<string, unknown> )[ key ];

	return properties;

}

function contains( actual: unknown, expected: unknown ): boolean {

	return actual !== null && typeof actual === 'object' && Object.entries( expected as object ).every( ( [ key, value ] ) => equivalent( ( actual as Record<string, unknown> )[ key ], value ) );

}

class Assert {

	failures: string[] = [];
	count = 0;
	planned: number | undefined;
	steps: string[] = [];
	pending: Promise<void>[] = [];

	pushResult( { result, actual, expected, message }: Result ): void {

		if ( this === Assert.prototype && running !== undefined ) return running.pushResult( { result, actual, expected, message } );

		this.count ++;

		if ( result ) return;

		const detail = actual !== undefined || expected !== undefined
			? ` (expected: ${ show( expected ) }, actual: ${ show( actual ) })`
			: '';

		this.failures.push( `${ message ?? 'assertion failed' }${ detail }` );

	}

	expect( count: number ): void {

		this.planned = count;

	}

	async(): () => void {

		let resolve!: () => void;
		this.pending.push( new Promise<void>( r => resolve = r ) );
		return resolve;

	}

	ok( value: unknown, message?: string ): void {

		this.pushResult( { result: !! value, actual: value, expected: true, message } );

	}

	notOk( value: unknown, message?: string ): void {

		this.pushResult( { result: ! value, actual: value, expected: false, message } );

	}

	true( value: unknown, message?: string ): void {

		this.pushResult( { result: value === true, actual: value, expected: true, message } );

	}

	false( value: unknown, message?: string ): void {

		this.pushResult( { result: value === false, actual: value, expected: false, message } );

	}

	equal( actual: unknown, expected: unknown, message?: string ): void {

		this.pushResult( { result: actual == expected, actual, expected, message } );

	}

	notEqual( actual: unknown, expected: unknown, message?: string ): void {

		this.pushResult( { result: actual != expected, actual, expected, message } );

	}

	strictEqual( actual: unknown, expected: unknown, message?: string ): void {

		this.pushResult( { result: actual === expected, actual, expected, message } );

	}

	notStrictEqual( actual: unknown, expected: unknown, message?: string ): void {

		this.pushResult( { result: actual !== expected, actual, expected, message } );

	}

	deepEqual( actual: unknown, expected: unknown, message?: string ): void {

		this.pushResult( { result: equivalent( actual, expected ), actual, expected, message } );

	}

	notDeepEqual( actual: unknown, expected: unknown, message?: string ): void {

		this.pushResult( { result: ! equivalent( actual, expected ), actual, expected, message } );

	}

	propEqual( actual: unknown, expected: unknown, message?: string ): void {

		this.pushResult( { result: equivalent( ownProperties( actual ), ownProperties( expected ) ), actual, expected, message } );

	}

	notPropEqual( actual: unknown, expected: unknown, message?: string ): void {

		this.pushResult( { result: ! equivalent( ownProperties( actual ), ownProperties( expected ) ), actual, expected, message } );

	}

	closeTo( actual: number, expected: number, delta: number, message?: string ): void {

		if ( delta === undefined ) throw new TypeError( 'closeTo() requires a delta argument' );

		this.pushResult( { result: Math.abs( actual - expected ) <= delta, actual, expected, message } );

	}

	propContains( actual: unknown, expected: unknown, message?: string ): void {

		this.pushResult( { result: contains( actual, expected ), actual, expected, message } );

	}

	notPropContains( actual: unknown, expected: unknown, message?: string ): void {

		this.pushResult( { result: ! contains( actual, expected ), actual, expected, message } );

	}

	timeout( _duration: number ): void {}

	step( label: string ): void {

		this.steps.push( label );
		this.pushResult( { result: true, message: label } );

	}

	verifySteps( expected: string[], message?: string ): void {

		const actual = this.steps;
		this.steps = [];
		this.pushResult( { result: equivalent( actual, expected ), actual, expected, message } );

	}

	throws( fn: () => unknown, expected?: unknown, message?: string ): void {

		if ( typeof expected === 'string' ) {

			message = expected;
			expected = undefined;

		}

		let thrown: unknown;
		let didThrow = false;

		try {

			fn();

		} catch ( error ) {

			didThrow = true;
			thrown = error;

		}

		this.pushResult( { result: didThrow && matches( thrown, expected ), actual: thrown, expected, message } );

	}

	raises( fn: () => unknown, expected?: unknown, message?: string ): void {

		this.throws( fn, expected, message );

	}

	async rejects( promise: Promise<unknown> | ( () => Promise<unknown> ), expected?: unknown, message?: string ): Promise<void> {

		if ( typeof expected === 'string' ) {

			message = expected;
			expected = undefined;

		}

		let thrown: unknown;
		let didReject = false;

		try {

			await ( typeof promise === 'function' ? promise() : promise );

		} catch ( error ) {

			didReject = true;
			thrown = error;

		}

		this.pushResult( { result: didReject && matches( thrown, expected ), actual: thrown, expected, message } );

	}

}

function matches( thrown: unknown, expected: unknown ): boolean {

	if ( expected === undefined ) return true;

	if ( expected instanceof RegExp ) return expected.test( String( thrown ) );

	if ( typeof expected === 'function' ) {

		if ( expected.prototype !== undefined && thrown instanceof expected ) return true;

		try {

			return ( expected as ( value: unknown ) => unknown ).call( {}, thrown ) === true;

		} catch {

			return false;

		}

	}

	if ( typeof expected === 'object' && expected !== null ) {

		return Object.entries( expected ).every( ( [ key, value ] ) => equivalent( ( thrown as Record<string, unknown> )?.[ key ], value ) );

	}

	return false;

}

function run( body: TestBody ): () => Promise<void> {

	return async () => {

		const assert = new Assert();

		running = assert;

		try {

			await body( assert );
			await Promise.all( assert.pending );

		} finally {

			running = undefined;

		}

		if ( assert.planned !== undefined ) {

			if ( assert.count !== assert.planned ) assert.failures.push( `expected ${ assert.planned } assertions, but ${ assert.count } were run` );

		} else if ( assert.count === 0 ) {

			assert.failures.push( 'expected at least one assertion, but none were run' );

		}

		if ( assert.failures.length > 0 ) throw new Error( assert.failures.join( '\n' ) );

	};

}

interface Hooks {
	before( callback: Hook ): void;
	after( callback: Hook ): void;
	beforeEach( callback: Hook ): void;
	afterEach( callback: Hook ): void;
}

const hooks: Hooks = {
	before: callback => beforeAll( () => callback( new Assert() ) ),
	after: callback => afterAll( () => callback( new Assert() ) ),
	beforeEach: callback => beforeEach( () => callback( new Assert() ) ),
	afterEach: callback => afterEach( () => callback( new Assert() ) )
};

// Tests that decode images, draw on canvases or wait on image load events, which
// happy-dom does not implement; they run in a real browser only.
const browserOnly = new Set( [
	'Loaders > ImageBitmapLoader > load',
	'Loaders > ImageLoader > image request priority',
	'Addons > Loaders > USDLoader > textures inherit CORS, resolve URLs once, and use the loading manager and image cache'
] );

// Names of the modules being registered; describe() callbacks may run deferred, so each one sets its own path.
let modules: string[] = [];

const QUnit = {

	assert: Assert.prototype,

	config: {} as Record<string, unknown>,

	module( name: string, optionsOrCallback?: unknown, callback?: ( hooks: Hooks ) => void ): void {

		const body = ( typeof optionsOrCallback === 'function' ? optionsOrCallback : callback ) as ( ( hooks: Hooks ) => void ) | undefined;

		const path = [ ...modules, name ];

		describe( name, () => {

			const outer = modules;

			modules = path;

			const options = typeof optionsOrCallback === 'object' && optionsOrCallback !== null ? optionsOrCallback as Partial<Record<keyof Hooks, Hook>> : {};

			if ( options.before ) hooks.before( options.before );
			if ( options.after ) hooks.after( options.after );
			if ( options.beforeEach ) hooks.beforeEach( options.beforeEach );
			if ( options.afterEach ) hooks.afterEach( options.afterEach );

			body?.( hooks );

			modules = outer;

		} );

	},

	test( name: string, body: TestBody ): void {

		if ( browserOnly.has( [ ...modules, name ].join( ' > ' ) ) ) return QUnit.skip( name );

		test( name, run( body ), testTimeout );

	},

	skip( name: string, _body?: TestBody ): void {

		test.skip( name, () => {} );

	},

	todo( name: string, body: TestBody ): void {

		test.todo( name, run( body ), testTimeout );

	},

	testDone( callback: () => void ): void {

		afterEach( () => callback() );

	}

};

( globalThis as Record<string, unknown> ).QUnit = QUnit;

// Tests import the public names (`three`, `three/webgpu`, `three/tsl`) like the
// examples do, but must run against /src, never a possibly stale /build.
const entries: Record<string, string> = {
	three: 'Three.js',
	'three/webgpu': 'Three.WebGPU.js',
	'three/tsl': 'Three.TSL.js'
};

Bun.plugin( {
	name: 'three-source',
	setup( build ) {

		build.onResolve( { filter: /^three(\/webgpu|\/tsl)?$/ }, ( { path } ) => ( { path: fileURLToPath( new URL( `../../src/${ entries[ path ] }`, import.meta.url ) ) } ) );

	}
} );

// Loader suites resolve relative URLs against the page they ran on in the browser
// (test/unit/UnitTests.html served from the repository root).
const server = createServer( { root: fileURLToPath( new URL( '../../', import.meta.url ) ) } );

await new Promise<void>( resolve => server.listen( 0, resolve ) );

( globalThis as unknown as { happyDOM: { setURL( url: string ): void } } ).happyDOM.setURL( `http://localhost:${ ( server.address() as AddressInfo ).port }/test/unit/index.html` );

// happy-dom resolves fetch() through its own HTTP stack, which rejects the file: URLs
// that suites build from import.meta.url and the blob: URLs they create.
const domFetch = globalThis.fetch;
const blobs = new Map<string, Blob>();
const createObjectURL = URL.createObjectURL.bind( URL );

URL.createObjectURL = ( object: Blob | MediaSource ) => {

	const url = createObjectURL( object );

	if ( object instanceof Blob ) blobs.set( url, object );

	return url;

};

globalThis.fetch = ( ...args: Parameters<typeof fetch> ) => {

	const input = args[ 0 ];
	const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

	if ( url.startsWith( 'file:' ) ) return Bun.file( fileURLToPath( url ) ).arrayBuffer().then( buffer => new Response( buffer ) );

	const blob = blobs.get( url );

	return blob !== undefined ? Promise.resolve( new Response( blob ) ) : domFetch( ...args );

};

// happy-dom has no Web Audio; the audio suites only need a context that can create gain nodes.
Object.assign( window, {
	AudioContext: function () {

		return { createGain: () => ( { connect: () => {} } ) };

	}
} );
