
const a = 1 // eslint-disable-line no-unused-vars
	, defer = require( './defer' );

module.exports = function createTask( fn ) {
	if ( typeof fn !== 'function' )
		throw new Error( 'A task should be created with a function' );
	let deferred = defer();
	let task = deferred.promise.then( fn ? fn : () => {} );
	deferred.promise.task = task;
	task.execute = ( ...args ) => {
		if ( task.executed )
			throw new Error( 'Task already executed' );
		task.executed = true;
		deferred.resolve( ...args );
		return task;
	};
	task.executed = false;
	return task;
};
