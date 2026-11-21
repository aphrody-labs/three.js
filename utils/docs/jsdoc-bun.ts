import { plugin } from "bun";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const lib = join( dirname( Bun.resolveSync( "jsdoc/package.json", process.cwd() ) ), "lib" );

plugin( {
	name: "jsdoc-lib",
	setup( build ) {
		build.onResolve( { filter: /^jsdoc\// }, ( args ) => {
			const base = join( lib, args.path );
			for ( const candidate of [ base + ".js", join( base, "index.js" ), base ] ) if ( existsSync( candidate ) ) return { path: candidate };
			return undefined;
		} );
	}
} );
