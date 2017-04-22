
// Initialize optional logger dependency.
let logger = {};

try {
	let log4js = require( 'log4js' );
	logger = log4js.getLogger( 'ModuleLoader' );
	logger.setLevel( "ERROR" );
} catch ( e ) {
	if ( 'code' in e && e.code === 'MODULE_NOT_FOUND' ) {
		[ 'trace', 'debug', 'info', 'warn', 'error', 'setLevel' ].map(( key ) => logger[ key ] = () => {} );
	} else {
		throw e;
	}
}

module.exports = logger;