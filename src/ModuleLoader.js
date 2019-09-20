
const a = 1 // eslint-disable-line no-unused-vars
	, Bluebird = require( 'bluebird' )
	, fs = require( 'fs' )
	, FunctionParser = require( 'parse-function' )
	, isNullOrUndefined = x => x === null || x === undefined
	, lodash = require( 'lodash' )
	, path = require( 'path' )
	;

Bluebird.config( { cancellation: true } );

const functionParser = FunctionParser.default ? FunctionParser.default() : new FunctionParser();

const isValidDependencyName = ( str ) => {
	return lodash.isString( str ) && str.match( /^[A-Za-z0-9-]+$/ );
};

const bind = function( fn, _this ) {
	if ( fn === undefined )
		return undefined;
	if ( lodash.isFunction( fn ) )
		return lodash.bind( fn, _this );
	throw new Error( 'Function expected, got ' + typeof fn );
};

function defer() {
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
}

function createTask( fn ) {
	let deferred = defer();
	let task = deferred.promise.then( fn ? fn : lodash.noop );
	deferred.promise.task = task;
	task.execute = () => {
		if ( task.executed )
			throw new Error( 'Task already executed' );
		task.executed = true;
		deferred.resolve();
		return task;
	};
	task.executed = false;
	return task;
}

class Module {

	constructor( name, anonymous, dependencies, start, stop, obj ) {
		this.name = name;
		this.anonymous = anonymous;
		this.dependencies = dependencies;
		this.start = start;
		this.stop = stop;
		this.obj = obj;

		this.startTask = this._createStartTask();
		this.stopTask = this._createStopTask();

		this._cancelled = false;
		this._hasResolvedDependencies = false;
		this._resolvedDependencies = [];
		this._order = null;

		this.starting = false;
		this.started = false;
		this.stopping = false;
		this.stopped = false;
	}

	get resolvedDependencies() {
		return this._resolvedDependencies;
	}

	set resolvedDependencies( value ) {
		if ( isNullOrUndefined( value ) )
			throw new Error( 'Resolved dependencies cannot be null or undefined' );
		if ( this._hasResolvedDependencies )
			throw new Error( 'Module already has resolved dependencies' );
		this._hasResolvedDependencies = true;
		this._resolvedDependencies = value;
	}

	get order() {
		return this._order;
	}

	set order( value ) {
		if ( this._order !== null )
			throw new Error( 'Module already had an order' );
		this._order = value;
	}

	/**
	 * Calculate this module order.\n
	 * A module order is defined as the priority in which a module should be loaded, relative to other modules.\n
	 * Order is 0 if the module has no dependencies, otherwise it is the max order of the module dependencies plus one.
	 * @return this module calculated order according to the definition above, or -1 if order could not be calculated.
	 */
	calculateOrder() {
		if ( !this.dependencies.length )
			return 0;
		if ( lodash.some( this.resolvedDependencies, dp => dp.order === null ) )
			return -1;
		return lodash( this.resolvedDependencies ).map( 'order' ).max() + 1;
	}

	_createStartTask() {
		return createTask( () => Bluebird.resolve()
			// .tap( _ => console.info( 'Waiting for dependencies', m.name, _.map( m.resolvedDependencies, 'name' ) ) )
			.then( () => Bluebird.all( lodash.map( this.resolvedDependencies, d => d.startTask ) ) )
			// .tap( _ => console.info( 'Dependencies ready', m.name ) )
			.then( deps => {
				if ( this.stopping || this.stopped )
					return undefined;
				return Bluebird.resolve( deps )
					// .tap( _ => console.info( 'Starting', this.name ) )
					.tap( _ => this.starting = true )
					.then( args => this.start.apply( this, args ) )
					.tap( x => this._ensureValidReturnValue( x ) )
					.tap( _ => this.starting = false )
					.tap( _ => this.started = true )
					// .tap( x => console.info( 'Started', this.name, x ) )
				;
			} )
			// .catch( err => console.error( 'Failed to start task:', err ) )
		);
	}

	_createStopTask() {
		return createTask( () => Bluebird.resolve()
			// .tap( _ => console.info( 'Stopping', this.name, this.started, this.starting ) )
			.then( _ => {
				if ( !this.started && !this.starting )
					return undefined;
				// console.info( this.name, 'Waiting on modules: ', [ this, ...this.resolvedDependencies ].map( x => x.name ), [ this, ...this.resolvedDependencies ].map( x => x.startTask.isFulfilled() ) );
				return Bluebird.resolve( [ this.startTask, ...lodash.map( this.resolvedDependencies, d => d.startTask ) ] )
					.all()
					.then( values => this.stop( ...values ) );
			} )
			.tap( _ => this.stopped = true )
			// .tap( _ => console.info( 'Stopped', this.name ) )
			// .catch( err => console.error( 'Failed to stop task:', err ) )
		);
	}

	_ensureValidReturnValue( x ) {
		if ( !this.anonymous && isNullOrUndefined( x ) )
			throw Error( `Module '${ this.name }' should return a valid object to be used by other modules, got: ${ x } ` );
	}

}

class ModuleLoader {

	constructor() {
		this.length = 0;
		this.modules = {};
		this.globalStartPromise = null;
		this.globalStopPromise = null;
	}

	register( ...args ) {
		let values = args.slice( 0, 4 );
		switch ( values.length ) {
		case 4: return this._register4( ...values );
		case 3: return this._register3( ...values );
		case 2: return this._register2( ...values );
		case 1: return this._register1( ...values );
		default: throw this._illegalRegistrationError( ...arguments );
		}
	}

	resolve( dep ) {

		if ( lodash.isArray( dep ) ) {
			let invalidDependencies = dep.filter( ( name ) => !isValidDependencyName( name ) );
			if ( invalidDependencies.length > 0 )
				throw new Error( 'Invalid module names found: ' + invalidDependencies.join( ', ' ) );
			return Bluebird.all( dep.map( ( name ) => this.resolve( name ) ) );
		} else if ( isValidDependencyName( dep ) ) {
			if ( !this.modules[ dep ] )
				return Bluebird.resolve( undefined );
			if ( !this.started )
				this.start();
			return this.modules[ dep ].startTask;
		} else {
			throw new Error( `Invalid dependency name, string or array expected, got: ${ typeof dep }` );
		}

	}

	registerValue( name, value ) {
		if ( lodash.isUndefined( name ) || lodash.isNull( name ) )
			throw new Error( `Cannot register a value with a null or undefined name` );
		if ( !this._isValidReturnValue( value ) )
			throw new Error( `Value ${ value } is not valid for module '${ name }'` );
		return this._doRegister( {
			name: name,
			dependencies: [],
			start: () => value,
			stop: lodash.noop
		} );
	}

	registerFile( filepath ) {
		let lib = require( filepath );
		let name = this._generateNameFromFilepath( filepath );
		if ( lodash.isFunction( lib ) ) {
			let result = functionParser.parse( lib );

			// Register as new instance.
			return this._doRegister( {
				name: name,
				dependencies: result.args,
				start: function( ...deps ) {
					return lib.apply( {}, deps );
				},
				stop: lodash.noop
			} );
		} else if ( this._isValidReturnValue( lib ) ) {
			// Register as value.
			return this._doRegister( {
				name: name,
				dependencies: [],
				start: () => lib,
				stop: lodash.noop
			} );
		} else {
			throw new Error( `File ${ filepath } does not contain a valid module definition !` );
		}
	}

	registerDirectory( directory, recursive = false ) {
		const entries = fs.readdirSync( directory );
		for ( let entry of entries ) {
			const filepath = path.join( directory, entry );
			const stats = fs.statSync( filepath );
			if ( stats.isFile() ) {
				this.registerFile( filepath );
			} else if ( stats.isDirectory() && recursive ) {
				this.registerDirectory( filepath, recursive );
			}
		}
	}

	list() {
		return lodash.map( this.modules, 'name' );
	}

	start() {
		if ( !this.started )
			this.globalStartPromise = Bluebird.try( this._doStart.bind( this ) );
		return this.globalStartPromise;
	}

	stop() {
		if ( !this.started )
			throw new Error( 'Cannot stop, loader not even started' );
		if ( !this.stopped )
			this.globalStopPromise = Bluebird.try( this._doStop.bind( this ) );
		return this.globalStopPromise;
	}

	// #region current loader state

	get started() {
		return this.globalStartPromise !== null;
	}

	get stopped() {
		return this.globalStopPromise !== null;
	}

	// #endregion
	// #region private methods

	_isValidReturnValue( x ) {
		return !lodash.isNil( x );
	}

	_register1( a ) {
		if ( lodash.isArray( a ) ) {
			// Array syntax definition
			let [ deps, prelast, last ] = [ a.slice( 0, -2 ), a.slice( -2, a.length - 1 )[ 0 ], a.slice( -1, a.length )[ 0 ] ];
			if ( this._isArgValidStart( prelast ) && this._isArgValidStop( last ) ) {
				// last two parameters are the start and stop functions, respectively
				return this._doRegister( { dependencies: deps, start: prelast, stop: last } );
			} else if ( this._isArgValidStart( last ) ) {
				// last parameter is the start function
				if ( prelast !== undefined ) deps.push( prelast );
				return this._doRegister( { dependencies: deps, start: last } );
			} else {
				throw new Error( 'Module does not define a valid start function in array syntax.' );
			}
		} else if ( lodash.isObjectLike( a ) ) {
			// Object instance mode
			return this._doRegister( {
				name: a.name,
				dependencies: a.dependencies,
				start: bind( a.start, a ),
				stop: bind( a.stop, a ),
				obj: a
			} );
		} else if ( this._isArgValidName( a ) ) {
			// Minimal syntax with only name.
			return this._doRegister( { name: a } );
		} else {
			throw this._illegalRegistrationError( ...arguments );
		}
	}

	_register2( a, b ) {
		if ( lodash.isArray( a ) ) {
			// Anonymous spread syntax with no stop function.
			return this._doRegister( { dependencies: a, start: b } );
		} else if ( this._isArgValidName( a ) && lodash.isObjectLike( b ) ) {
			// Object instance mode with standalone name
			return this._doRegister( {
				name: a,
				dependencies: [],
				start: bind( b.start, b ),
				stop: bind( b.stop, b ),
				obj: b
			} );
		} else if ( this._isArgValidName( a ) && this._isArgValidDependencies( b ) ) {
			// Minimal syntax with only name and dependencies.
			return this._doRegister( { name: a, dependencies: b } );
		} else {
			throw this._illegalRegistrationError( ...arguments );
		}
	}

	_register3( a, b, c ) {
		if ( lodash.isArray( a ) ) {
			// Anonymous spread syntax.
			return this._doRegister( { dependencies: a, start: b, stop: c } );
		} else if ( this._isArgValidName( a ) && this._isArgValidDependencies( b ) && lodash.isObjectLike( c ) ) {
			// Object instance mode with name and dependencies
			return this._doRegister( {
				name: a,
				dependencies: b,
				start: bind( c.start, c ),
				stop: bind( c.stop, c ),
				obj: c
			} );
		} else if ( this._isArgValidName( a ) && this._isArgValidDependencies( b ) && this._isArgValidStart( c ) ) {
			// Spread syntax with no stop function
			return this._doRegister( {
				name: a,
				dependencies: b,
				start: c
			} );
		} else {
			throw this._illegalRegistrationError( ...arguments );
		}
	}

	_register4( a, b, c, d ) {
		if ( this._isArgValidName( a ) && this._isArgValidDependencies( b ) && this._isArgValidStart( c ) && this._isArgValidStop( d ) ) {
			return this._doRegister( { name: a, dependencies: b, start: c, stop: d } );
		} else {
			throw this._illegalRegistrationError( ...arguments );
		}
	}

	_isArgValidName( name ) {
		return lodash.isString( name );
	}

	_isArgValidDependencies( deps ) {
		return lodash.isString( deps ) || lodash.isArray( deps );
	}

	_isArgValidStart( start ) {
		return lodash.isFunction( start );
	}

	_isArgValidStop( stop ) {
		return lodash.isFunction( stop );
	}

	_illegalRegistrationError( ...args ) {
		return new Error( 'Invalid registration arguments: ' + JSON.stringify( args ) );
	}

	_doRegister( mod ) {

		if ( this.started )
			throw new Error( 'Cannot register a new module if the ModuleLoader has already been started' );

		mod = this._validateModuleDefinition( mod );

		Object.defineProperty( mod, 'name', {
			value: mod.name,
			writable: false,
			enumerable: false
		} );

		this.modules[ mod.name ] = new Module( mod.name, mod.anonymous, mod.dependencies, mod.start, mod.stop );
		this.length++;

	}

	_validateModuleDefinition( mod ) {

		mod.anonymous = false;

		if ( isNullOrUndefined( mod.name ) ) {
			mod.name = this._generateAnonymousModuleName();
			mod.anonymous = true;
		}

		if ( this.modules[ mod.name ] )
			throw new Error( 'Cannot override module definition: ' + mod.name );

		if ( !this._isArgValidName( mod.name ) || !mod.name.match( /^[A-z0-9-_]+$/ ) )
			throw new Error( 'Module does not define a valid name property: ' + mod.name );

		if ( isNullOrUndefined( mod.dependencies ) ) {
			mod.dependencies = [];
		} else if ( lodash.isString( mod.dependencies ) ) {
			if ( mod.dependencies === '' ) {
				mod.dependencies = [];
			} else {
				mod.dependencies = [ mod.dependencies ];
			}
		} else if ( !lodash.isArray( mod.dependencies ) ) {
			throw new Error( `Module '${ mod.name }' does not define a valid dependencies property.` );
		}

		/* istanbul ignore else */
		if ( lodash.isUndefined( mod.start ) ) {
			mod.start = function() { return mod.obj; };
		} else if ( !this._isArgValidStart( mod.start ) ) {
			throw new Error( `Module '${ mod.name }' does not define a valid start property.` );
		}

		/* istanbul ignore else */
		if ( lodash.isUndefined( mod.stop ) ) {
			mod.stop = function() { return mod.obj; };
		} else if ( !this._isArgValidStop( mod.stop ) ) {
			throw new Error( `Module '${ mod.name }' does not define a valid stop property.` );
		}

		let invalidDependencies = lodash.filter( mod.dependencies, d => !isValidDependencyName( d ) || d === mod.name );
		if ( invalidDependencies.length > 0 )
			throw new Error( `Module '${ mod.name }' specified some invalid dependencies: ${ invalidDependencies.join( ', ' ) }` );

		// Ensure that a mod object exists.
		mod.obj = mod.obj || mod;

		return mod;

	}

	_doStart() {

		if ( this.length === 0 )
			return Bluebird.resolve();

		// Validate that no dependency is missing.
		let missingDependencies = lodash( this.modules )
			.map( m => m.dependencies )
			.flatten()
			.uniq()
			.filter( dependencyName => !this.modules[ dependencyName ] )
			.value();
		if ( missingDependencies.length > 0 )
			throw new Error( `Unable to start ModuleLoader: Some dependencies could not be resolved: ${ missingDependencies.join( ', ' ) } ` );

		// We have at least one module to load, but no module has 0 depedency.
		let rootModules = lodash.filter( this.modules, m => m.dependencies.length === 0 );
		if ( rootModules.length === 0 )
			throw new Error( `Unable to start ModuleLoader: No module found without dependencies !` );

		// Convert dependency names to real dependencies
		lodash.each( this.modules, m => {
			m.resolvedDependencies = lodash.map( m.dependencies, name => this.modules[ name ] );
		} );

		// Sort the modules
		let stale = false, missingModules = lodash.values( this.modules );
		while ( !stale && missingModules.length > 0 ) {

			stale = true;
			lodash.each( missingModules, m => {

				let calculatedOrder = m.calculateOrder();
				if ( calculatedOrder >= 0 ) {
					stale = false;
					// m.resolvedDependencies.forEach( dep => dep.required() );
					m.order = calculatedOrder;
				}
				// console.debug( 'dependency-resolver', m.name, _.map( m.resolvedDependencies, d => ( { name: d.name, order: d.order } ) ), dependenciesResolved ? '=> ' + m.order : '=> --' );
			} );

			missingModules = lodash.filter( missingModules, m => m.order === null );

		}

		if ( stale )
			throw new Error( `Unable to start ModuleLoader: Circular dependencies detected, some modules could not be started: ${ lodash.map( missingModules, m => m.name ).join( ', ' ) } !` );

		return Bluebird.all( lodash.map( this.modules, m => {
			m.startTask.execute();
			return m.startTask;
		} ) );
	}

	_doStop() {

		let deferred = defer();
		let combinedPromise = lodash( this.modules )
			.sortBy( 'order' )
			.reverse()
			.reduce( ( partialPromise, m ) => {
				m.stopping = true;
				return partialPromise.then( () => m.stopTask.execute() ).finally( _ => m.stopping = false );
			}, deferred.promise );
		deferred.resolve();
		return combinedPromise;

	}

	_generateAnonymousModuleName() {
		return 'anonymous-' + ( 'xxxxxxxx'.replace( /[x]/g, function( c ) {
			var r = Math.random() * 16 | 0, v = ( r & 0x3 | 0x8 ); // eslint-disable-line no-mixed-operators
			return v.toString( 16 );
		} ) );
	}

	_generateNameFromFilepath( filepath ) {
		let filename = path.parse( filepath ).name;
		return lodash.camelCase( filename );
	}

	// #endregion

}

module.exports = ModuleLoader;