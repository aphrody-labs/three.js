// Reproduces the Bun tooling migration of this fork on a checkout of upstream three.js.
//
//   bun scripts/migrate-to-bun.ts [target] [--no-install] [--check]
//
// `target` is the checkout to migrate (default: the repository this script lives in).
// The migrated tooling files of this repository are the templates: they are copied into
// the target, package.json fields are rewritten, files that Bun replaces are deleted and
// `bun install` writes bun.lock. Running it again changes nothing; `--check` only reports
// what would change and exits with 1 when something would.

import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve( dirname( fileURLToPath( import.meta.url ) ), '..' );
const args = Bun.argv.slice( 2 );
const flags = new Set( args.filter( argument => argument.startsWith( '--' ) ) );
const target = resolve( args.find( argument => ! argument.startsWith( '--' ) ) ?? source );
const checkOnly = flags.has( '--check' );

// Tooling files copied from this repository into the target.
const managedGlobs = [
	'bunfig.toml',
	'.github/workflows/ci.yml',
	'.github/workflows/bundle-size.yml',
	'utils/browser.js',
	'utils/build/*',
	'utils/changelog.js',
	'utils/generateMaterialXNodeInterfaceRegistry.js',
	'utils/packLDrawModel.mjs',
	'utils/llms/build.js',
	'utils/docs/template/static/index.html',
	'utils/docs/template/static/scenes/*.html',
	'test/benchmarks/node-material-instance.js',
	'test/benchmarks/node-material-instance/*.html',
	'test/e2e/puppeteer.js',
	'test/e2e/README.md',
	'test/treeshake/treeshake.ts',
	'test/unit/qunit-bun.ts',
	'test/unit/three.source.test.js',
	'test/unit/three.addons.test.js',
	'test/unit/README.md',
	'test/unit/src/nodes/tsl/gpu-test-utils.js',
	'test/unit/src/nodes/lighting/EnvironmentNode.tests.js',
	'test/unit/src/constants.tests.js',
	'test/unit/tsl/code.js',
	'test/unit/tsl/TSL.tests.js'
];

// Files that rollup, eslint, puppeteer-in-node, npm and the WebGL renderer made necessary.
const obsolete = [
	'package-lock.json',
	'eslint.config.js',
	'utils/build/rollup.config.js',
	'utils/generatePMREM.js',
	'test/rollup.treeshake.config.js',
	'test/treeshake/index.js',
	'test/treeshake/utils/format-diff.js',
	'test/treeshake/utils/format-size.js',
	'test/treeshake/utils/formatBytes.js',
	'test/unit/UnitTests.html',
	'test/unit/UnitTestsAddons.html',
	'test/unit/puppeteer.unit.js',
	'test/unit/three.source.unit.js',
	'test/unit/three.addons.unit.js',
	'test/unit/src/materials/RawShaderMaterial.tests.js',
	'test/unit/src/materials/ShaderMaterial.tests.js',
	'test/unit/src/renderers/WebGL3DRenderTarget.tests.js',
	'test/unit/src/renderers/WebGLArrayRenderTarget.tests.js',
	'test/unit/src/renderers/WebGLCubeRenderTarget.tests.js',
	'test/unit/src/renderers/WebGLRenderTarget.tests.js',
	'test/unit/src/renderers/shaders/ShaderChunk.tests.js',
	'test/unit/src/renderers/shaders/ShaderLib.tests.js',
	'test/unit/src/renderers/shaders/UniformsLib.tests.js',
	'test/unit/src/renderers/shaders/UniformsUtils.tests.js',
	'test/unit/src/renderers/webgl/WebGLExtensions.tests.js',
	'test/unit/src/renderers/webgl/WebGLRenderLists.tests.js',
	'test/unit/src/lights/LightProbe.tests.js',
	'test/unit/src/core/Clock.tests.js',
	'test/unit/src/core/GLBufferAttribute.tests.js',
	'test/unit/src/core/Uniform.tests.js',
	'test/unit/src/core/UniformsGroup.tests.js',
	'test/unit/addons/tsl/WebGLNodesHandler.tests.js',
	'test/unit/addons/postprocessing/GTAOPass.tests.js',
	'test/unit/tsl/reference.glsl',
	'test/benchmarks/node-material-instance/shader-material.html',
	'.github/workflows/read-size.yml',
	'.github/workflows/report-size.yml',
	'build/three.cjs',
	'build/three.core.js',
	'build/three.module.js'
];

// package.json fields that are taken from this repository's package.json.
const copiedFields = [ 'module', 'exports', 'scripts', 'devDependencies' ];
const removedFields = [ 'main', 'browserslist', 'allowScripts' ];
const removedKeywords = new Set( [ 'webgl', 'webgl2' ] );

const changes: string[] = [];

async function write( relativePath: string, content: string | Uint8Array ): Promise<void> {

	const file = Bun.file( join( target, relativePath ) );

	if ( await file.exists() ) {

		const existing = new Uint8Array( await file.arrayBuffer() );
		const next = typeof content === 'string' ? new TextEncoder().encode( content ) : content;

		if ( Buffer.compare( existing, next ) === 0 ) return;

	}

	changes.push( `write ${ relativePath }` );

	if ( ! checkOnly ) {

		await mkdir( dirname( join( target, relativePath ) ), { recursive: true } );
		await Bun.write( join( target, relativePath ), content );

	}

}

async function migratePackageJson(): Promise<void> {

	const templatePackage = await Bun.file( join( source, 'package.json' ) ).json();
	const targetPackage = await Bun.file( join( target, 'package.json' ) ).json();

	const migrated: Record<string, unknown> = { ...targetPackage };

	for ( const field of removedFields ) delete migrated[ field ];

	for ( const field of copiedFields ) migrated[ field ] = templatePackage[ field ];

	migrated.packageManager = String( targetPackage.packageManager ?? '' ).startsWith( 'bun@' ) ? targetPackage.packageManager : `bun@${ Bun.version }`;
	migrated.keywords = ( targetPackage.keywords as string[] ).filter( keyword => ! removedKeywords.has( keyword ) );

	// Same key order as the template, so the result does not depend on the upstream layout.
	const ordered = Object.fromEntries( [
		...Object.keys( templatePackage ).filter( key => key in migrated ).map( key => [ key, migrated[ key ] ] ),
		...Object.keys( migrated ).filter( key => ! ( key in templatePackage ) ).map( key => [ key, migrated[ key ] ] )
	] );

	await write( 'package.json', JSON.stringify( ordered, null, 2 ) + '\n' );

}

async function copyManagedFiles(): Promise<void> {

	if ( source === target ) return;

	for ( const pattern of managedGlobs ) {

		for await ( const relativePath of new Bun.Glob( pattern ).scan( { cwd: source, dot: true } ) ) {

			await write( relativePath.replaceAll( '\\', '/' ), new Uint8Array( await Bun.file( join( source, relativePath ) ).arrayBuffer() ) );

		}

	}

}

async function deleteObsoleteFiles(): Promise<void> {

	for ( const relativePath of obsolete ) {

		const file = Bun.file( join( target, relativePath ) );

		if ( ! await file.exists() ) continue;

		changes.push( `delete ${ relativePath }` );

		if ( ! checkOnly ) await rm( join( target, relativePath ), { force: true } );

	}

}

async function install(): Promise<void> {

	if ( checkOnly || flags.has( '--no-install' ) ) return;

	const lockfile = Bun.file( join( target, 'bun.lock' ) );
	const before = await lockfile.exists() ? await lockfile.text() : '';

	const result = Bun.spawnSync( [ process.execPath, 'install' ], { cwd: target, stdout: 'inherit', stderr: 'inherit' } );

	if ( result.exitCode !== 0 ) throw new Error( `bun install failed with exit code ${ result.exitCode }` );

	if ( await lockfile.text() !== before ) changes.push( 'write bun.lock' );

}

await migratePackageJson();
await copyManagedFiles();
await deleteObsoleteFiles();
await install();

console.log( changes.length === 0 ? 'Already migrated, nothing to do.' : `${ checkOnly ? 'Would change' : 'Changed' } ${ changes.length } files:\n${ changes.map( change => `  ${ change }` ).join( '\n' ) }` );

if ( checkOnly && changes.length > 0 ) process.exit( 1 );
