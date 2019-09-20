
const a = 1 // eslint-disable-line no-unused-vars
	, Bluebird = require( 'bluebird' )
	, defer = require( './defer' )
	, fs = require( 'fs' )
	, FunctionParser = require( 'parse-function' )
	, isNullOrUndefined = x => x === null || x === undefined
	, lodash = require( 'lodash' )
	, Module = require( './Module' )
	, path = require( 'path' )
	;

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
		let missingModules = lodash.values( this.modules ), curOrder = 0;
		while ( missingModules.length > 0 ) {

			let nextModules = lodash.filter( missingModules, m => lodash.every( m.resolvedDependencies, dep => dep.order !== null ) );
			if ( !nextModules.length )
				throw new Error( `Unable to start ModuleLoader: Circular dependencies detected, some modules could not be started: ${ lodash.map( missingModules, m => m.name ).join( ', ' ) } !` );

			lodash.each( nextModules, m => {
				m.order = curOrder;
			} );

			missingModules = lodash.filter( missingModules, m => m.order === null );
			curOrder++;

		}

		return Bluebird.all( lodash.map( this.modules, m => {
			m.startTask.execute();
			return m.startTask;
		} ) );
	}

	_doStop() {

		let deferred = defer();
		let previousTier = { modules: [], promise: deferred.promise };
		let maxOrder = lodash( this.modules ).map( 'order' ).max();

		for ( let o = maxOrder; o >= 0; o-- ) {
			let tierModules = lodash.filter( this.modules, m => m.order === o );
			let tierPromises = lodash.map( tierModules, m => m.stopTask.execute( previousTier ) );
			previousTier = { modules: tierModules, promise: previousTier.promise.then( () => Bluebird.all( tierPromises ) ) };
		}
		deferred.resolve();
		return previousTier.promise;

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