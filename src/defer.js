
const a = 1 // eslint-disable-line no-unused-vars
	, Bluebird = require( 'bluebird' )
	;

module.exports = function defer() {
	let resolve, reject;
	let promise = new Bluebird( ( _resolve, _reject ) => {
		resolve = _resolve;
		reject = _reject;
	} );
	return {
		resolve: resolve,
		reject: reject,
		promise: promise
	};
};
