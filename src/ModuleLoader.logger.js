
// Initialize optional logger dependency.
let logger = {};

try {
	let log4js = require( 'log4js' );
	logger = log4js.getLogger( 'ModuleLoader' );
} catch ( e ) {
	if ( 'code' in e && e.code === 'MODULE_NOT_FOUND' ) {
		[ 'debug', 'info', 'warn', 'error' ].map(( key ) => logger[ key ] = () => {} );
	} else {
		throw e;
	}
}

module.exports = logger;