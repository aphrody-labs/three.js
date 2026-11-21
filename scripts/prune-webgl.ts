// Deletes everything the WebGPU-only build can no longer reach, and justifies each deletion.
//
//   bun scripts/prune-webgl.ts [--dry-run] [--report=path.json]
//
// A file is deleted only for one of these recorded reasons:
//   webgl-app         editor/ or manual/: an application whose viewport or every lesson runs on WebGLRenderer
//   webgl-example     example page constructs WebGLRenderer
//   broken-import     module imports a name that `three` / `three/tsl` no longer exports,
//                     or a module that does not exist or was itself deleted (fixpoint)
//   glsl-module       module only carries GLSL (ShaderMaterial-style vertexShader/fragmentShader
//                     objects) or hooks the WebGL program pipeline (onBeforeCompile, getContext('webgl'))
//   unreachable-lib   vendored file under examples/jsm/libs that no remaining file imports or names
//   unreachable-asset example asset whose path, ancestor folder or file name no remaining file names
//   orphan-screenshot screenshot of a deleted example

import { $ } from 'bun';
import { basename, dirname, join, normalize, resolve } from 'node:path';

type Reason = 'webgl-app' | 'webgl-example' | 'broken-import' | 'glsl-module' | 'unreachable-lib' | 'unreachable-asset' | 'orphan-screenshot';

interface Deletion { file: string; reason: Reason; detail: string }

const root = resolve( import.meta.dir, '..' );
const dryRun = Bun.argv.includes( '--dry-run' );
const reportArgument = Bun.argv.find( ( argument ) => argument.startsWith( '--report=' ) );

const tracked = ( await $`git ls-files -z`.cwd( root ).text() ).split( '\0' ).filter( Boolean );
const existing = new Set<string>();
for ( const file of tracked ) if ( await Bun.file( join( root, file ) ).exists() ) existing.add( file );

const deleted = new Map<string, Deletion>();
const remove = ( file: string, reason: Reason, detail: string ) => {

	if ( ! deleted.has( file ) ) deleted.set( file, { file, reason, detail } );

};
const alive = ( file: string ) => existing.has( file ) && ! deleted.has( file );

const textCache = new Map<string, string>();
const read = async ( file: string ) => {

	let text = textCache.get( file );
	if ( text === undefined ) {

		text = await Bun.file( join( root, file ) ).text();
		textCache.set( file, text );

	}

	return text;

};

// Public names of the bare specifiers, taken from the live sources rather than a list.
const exportsOf = async ( entry: string ) => new Set( Object.keys( await import( join( root, entry ) ) ) );
const threeExports = await exportsOf( 'src/Three.js' );
const bareExports: Record<string, Set<string>> = {
	'three': threeExports,
	'three/webgpu': threeExports,
	'three/tsl': await exportsOf( 'src/Three.TSL.js' ),
};

const isModule = ( file: string ) => /\.(m?js|ts)$/.test( file );
const isExampleScriptHost = ( file: string ) => file.startsWith( 'examples/' ) && file.endsWith( '.html' );

// Module sources of a file: itself for JS, inline `<script type="module">` blocks for HTML,
// with comments stripped by the transpiler so JSDoc `import` samples are not read as edges.
const transpiler = new Bun.Transpiler( { loader: 'js', trimUnusedImports: false } );
const stripComments = ( code: string ) => {

	try {

		return transpiler.transformSync( code );

	} catch {

		return code;

	}

};

const moduleSources = async ( file: string ) => {

	const text = await read( file );
	if ( ! file.endsWith( '.html' ) ) return [ stripComments( text ) ];
	return [ ...text.matchAll( /<script type="module">([\s\S]*?)<\/script>/g ) ].map( ( match ) => stripComments( match[ 1 ] ) );

};

const importPattern = /^[ \t]*(?:import|export)\s*(?:(?:\*\s*as\s*\w+|\{([^}]*)\}|\w+(?:\s*,\s*\{([^}]*)\})?)\s*from\s*)?['"]([^'"]+)['"]/gm;
const dynamicImportPattern = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

interface ImportEdge { specifier: string; names: string[] }

const importsOf = async ( file: string ): Promise<ImportEdge[]> => {

	const edges: ImportEdge[] = [];
	for ( const source of await moduleSources( file ) ) {

		for ( const match of source.matchAll( importPattern ) ) {

			const list = ( match[ 1 ] ?? match[ 2 ] ?? '' ).split( ',' ).map( ( part ) => part.trim().split( /\s+as\s+/ )[ 0 ].trim() ).filter( ( name ) => name && name !== 'default' );
			edges.push( { specifier: match[ 3 ], names: list } );

		}

		for ( const match of source.matchAll( dynamicImportPattern ) ) edges.push( { specifier: match[ 1 ], names: [] } );

	}

	return edges;

};

// Resolves a specifier the way the examples' import maps do.
const resolveSpecifier = ( from: string, specifier: string ): string | null => {

	if ( specifier in bareExports ) return null;
	if ( specifier.startsWith( 'three/addons/' ) ) return normalize( join( 'examples/jsm', specifier.slice( 'three/addons/'.length ) ) ).replaceAll( '\\', '/' );
	if ( specifier.startsWith( '.' ) ) return normalize( join( dirname( from ), specifier ) ).replaceAll( '\\', '/' );
	return null; // other bare specifiers (CDN URLs, packages) are external

};

const glslOnly = ( text: string ) =>
	/\bonBeforeCompile\b/.test( stripComments( text ) ) ||
	/getContext\(\s*['"]webgl2?['"]/.test( stripComments( text ) ) ||
	/\bvertexShader\s*:\s*\/\*\s*glsl\s*\*\/|\bfragmentShader\s*:\s*\/\*\s*glsl\s*\*\//.test( text );

// 1. Example pages bound to WebGLRenderer, plus the editor/manual apps built on it.
for ( const app of [ 'editor/', 'manual/' ] ) {

	const files = [ ...existing ].filter( ( file ) => file.startsWith( app ) );
	let users = 0;
	for ( const file of files ) if ( /\.(html|js)$/.test( file ) && /\bWebGLRenderer\b/.test( await read( file ) ) ) users ++;
	if ( users > 0 ) for ( const file of files ) remove( file, 'webgl-app', `${ app } has ${ users } files constructing WebGLRenderer` );

}

for ( const file of existing ) {

	if ( isExampleScriptHost( file ) && /\bWebGLRenderer\b/.test( await read( file ) ) ) remove( file, 'webgl-example', 'constructs WebGLRenderer' );

}

// Examples whose CDN dependency imports names `three` no longer exports (checked by loading them in Chrome).
const externalBreakage: Record<string, string> = {
	'examples/webgpu_renderer_pathtracer.html': 'three-gpu-pathtracer@0.0.28 (CDN) imports ShaderMaterial from three',
};
for ( const [ file, detail ] of Object.entries( externalBreakage ) ) if ( existing.has( file ) ) remove( file, 'broken-import', detail );

// 2. Modules: GLSL-only content, then broken imports to a fixpoint.
const codeFiles = [ ...existing ].filter( ( file ) => ( file.startsWith( 'examples/jsm/' ) && isModule( file ) ) || isExampleScriptHost( file ) );

for ( const file of codeFiles ) {

	if ( file.startsWith( 'examples/jsm/libs/' ) ) continue;
	if ( isModule( file ) && glslOnly( await read( file ) ) ) remove( file, 'glsl-module', 'GLSL program code or WebGL program hook' );

}

// Index modules are rewritten instead of deleted when an entry dies.
const indexes = new Set( [ 'examples/jsm/Addons.js' ] );

const edges = new Map<string, ImportEdge[]>();
for ( const file of codeFiles ) edges.set( file, await importsOf( file ) );

const brokenEdge = ( file: string, edge: ImportEdge ): string | null => {

	const names = bareExports[ edge.specifier ];
	if ( names ) {

		const missing = edge.names.filter( ( name ) => ! names.has( name ) );
		return missing.length > 0 ? `${ edge.specifier } no longer exports ${ missing.join( ', ' ) }` : null;

	}

	const target = resolveSpecifier( file, edge.specifier );
	if ( target === null ) return null;
	if ( ! existing.has( target ) ) return `${ edge.specifier } does not exist`;
	if ( deleted.has( target ) ) return `${ edge.specifier } was deleted (${ deleted.get( target )!.reason })`;
	return null;

};

for ( let changed = true; changed; ) {

	changed = false;
	for ( const file of codeFiles ) {

		if ( deleted.has( file ) || file.startsWith( 'examples/jsm/libs/' ) || indexes.has( file ) ) continue;
		for ( const edge of edges.get( file )! ) {

			const reason = brokenEdge( file, edge );
			if ( reason !== null ) {

				remove( file, 'broken-import', reason );
				changed = true;
				break;

			}

		}

	}

}

// 3. Screenshots and listings of deleted examples.
for ( const file of existing ) {

	const match = /^examples\/screenshots\/(.+)\.jpg$/.exec( file );
	if ( match && ! alive( `examples/${ match[ 1 ] }.html` ) ) remove( file, 'orphan-screenshot', `examples/${ match[ 1 ] }.html is gone` );

}

// 4. Reachability of vendored libs and assets by name, iterated because kept text assets
// (glTF, MTL, JSON) reference further files.
const assetRoots = [ 'examples/models/', 'examples/textures/', 'examples/sounds/', 'examples/fonts/', 'examples/luts/', 'examples/ies/', 'examples/materialx/', 'examples/jsm/libs/' ];
const isCandidate = ( file: string ) => assetRoots.some( ( prefix ) => file.startsWith( prefix ) );
const textLike = ( file: string ) => /\.(html|m?js|ts|json|gltf|mtl|usda|dae|x3d|wrl|txt|css|md|vox|obj|ply|fbx|3mf|amf|svg|xml|mtlx)$/i.test( file );

const mentions = ( corpus: string, file: string ) => {

	const local = file.slice( 'examples/'.length );
	if ( corpus.includes( local ) || corpus.includes( basename( file ) ) ) return true;
	// Names spliced into a path template at runtime, e.g. `luts/${ name }.png` with name 'NightLUT'.
	const stem = basename( file ).replace( /\.[^.]+$/, '' );
	if ( corpus.includes( `'${ stem }'` ) || corpus.includes( `"${ stem }"` ) ) return true;
	// Any ancestor folder below the category (e.g. textures/cube/Bridge2) covers paths built at runtime.
	let folder = dirname( local );
	while ( folder.includes( '/' ) ) {

		if ( corpus.includes( folder + '/' ) || corpus.includes( `'${ folder }'` ) || corpus.includes( `"${ folder }"` ) ) return true;
		folder = dirname( folder );

	}

	return false;

};

const corpusFiles = new Set( [ ...existing ].filter( ( file ) => alive( file ) && textLike( file ) && ! isCandidate( file ) && ( file.startsWith( 'examples/' ) || file.startsWith( 'src/' ) || file.startsWith( 'test/' ) ) ) );
const candidates = [ ...existing ].filter( ( file ) => alive( file ) && isCandidate( file ) );
const kept = new Set<string>();

for ( let changed = true; changed; ) {

	changed = false;
	const parts: string[] = [];
	for ( const file of corpusFiles ) parts.push( await read( file ) );
	for ( const file of kept ) if ( textLike( file ) && Bun.file( join( root, file ) ).size < 4e6 ) parts.push( await read( file ) );
	const corpus = parts.join( '\n' );

	for ( const file of candidates ) {

		if ( kept.has( file ) ) continue;
		if ( mentions( corpus, file ) ) {

			kept.add( file );
			changed = true;

		}

	}

	// Libraries are modules: whatever a kept lib imports stays too.
	for ( const file of [ ...kept ] ) {

		if ( ! file.startsWith( 'examples/jsm/libs/' ) || ! isModule( file ) ) continue;
		for ( const edge of await importsOf( file ) ) {

			const target = resolveSpecifier( file, edge.specifier );
			if ( target && existing.has( target ) && ! kept.has( target ) ) {

				kept.add( target );
				changed = true;

			}

		}

	}

}

for ( const file of candidates ) {

	if ( kept.has( file ) ) continue;
	remove( file, file.startsWith( 'examples/jsm/libs/' ) ? 'unreachable-lib' : 'unreachable-asset', 'no remaining file names it, its folder or its file name' );

}

// Report and apply.
const byReason = new Map<Reason, number>();
for ( const { reason } of deleted.values() ) byReason.set( reason, ( byReason.get( reason ) ?? 0 ) + 1 );

const report = {
	deleted: deleted.size,
	byReason: Object.fromEntries( byReason ),
	files: [ ...deleted.values() ].sort( ( a, b ) => a.file.localeCompare( b.file ) ),
};

if ( reportArgument ) await Bun.write( reportArgument.slice( '--report='.length ), JSON.stringify( report, null, '\t' ) + '\n' );
console.log( JSON.stringify( { deleted: report.deleted, byReason: report.byReason }, null, '\t' ) );

if ( ! dryRun && deleted.size > 0 ) {

	const files = [ ...deleted.keys() ];
	for ( let index = 0; index < files.length; index += 500 ) await $`git rm -q --cached --ignore-unmatch -- ${ files.slice( index, index + 500 ) }`.cwd( root );
	for ( const file of files ) await Bun.file( join( root, file ) ).delete();

	for ( const index of indexes ) {

		const lines = ( await read( index ) ).split( '\n' ).filter( ( line ) => {

			const match = /from '([^']+)'/.exec( line );
			if ( ! match ) return true;
			const target = resolveSpecifier( index, match[ 1 ] );
			return target === null || alive( target );

		} );
		await Bun.write( join( root, index ), lines.join( '\n' ) );

	}

	for ( const listing of [ 'examples/files.json', 'examples/tags.json' ] ) {

		if ( ! existing.has( listing ) ) continue;
		const data = JSON.parse( await read( listing ) );
		const live = ( name: string ) => alive( `examples/${ name }.html` );
		if ( Array.isArray( data ) ) continue;
		for ( const key of Object.keys( data ) ) {

			if ( Array.isArray( data[ key ] ) ) {

				data[ key ] = data[ key ].filter( live );
				if ( data[ key ].length === 0 ) delete data[ key ];

			} else if ( ! live( key ) ) delete data[ key ];

		}

		await Bun.write( join( root, listing ), JSON.stringify( data, null, '\t' ) + '\n' );

	}

}

