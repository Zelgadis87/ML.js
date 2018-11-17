
const _ = require( 'lodash' )
	, Bluebird = require( 'bluebird' )
	, fs = require( 'fs' )
	, path = require( 'path' )
	, FunctionParser = require( 'parse-function' )
	, isNullOrUndefined = x => _.isNull( x ) || _.isUndefined( x )
	;

Bluebird.config( { cancellation: true } );

const functionParser = FunctionParser.default ? FunctionParser.default() : new FunctionParser();

const isValidDependencyName = ( str ) => {
	return _.isString( str ) && str.match( /^[A-Za-z0-9-]+$/ );
};

const bind = function( fn, _this ) {
	if ( fn === undefined )
		return undefined;
	if ( _.isFunction( fn ) )
		return _.bind( fn, _this );
	throw new Error( 'Function expected, got ' + typeof fn );
};
class ModuleLoader {

	constructor() {
		this.length = 0;
		this.modules = {};
		this.startPromise = null;
		this.stopPromise = null;
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

		if ( _.isArray( dep ) ) {
			let invalidDependencies = dep.filter( ( name ) => !isValidDependencyName( name ) );
			if ( invalidDependencies.length > 0 )
				throw new Error( 'Invalid module names found: ' + invalidDependencies.join( ', ' ) );
			return Bluebird.all( dep.map( ( name ) => this.resolve( name ) ) );
		} else if ( isValidDependencyName( dep ) ) {
			if ( !this.modules[ dep ] )
				return Bluebird.resolve( undefined );
			if ( !this.started )
				this.start();
			return this.modules[ dep ].startPromise;
		} else {
			throw new Error( `Invalid dependency name, string or array expected, got: ${ typeof dep }` );
		}

	}

	registerValue( name, value ) {
		if ( _.isUndefined( name ) || _.isNull( name ) )
			throw new Error( `Cannot register a value with a null or undefined name` );
		if ( !this._isValidReturnValue( value ) )
			throw new Error( `Value ${ value } is not valid for module '${ name }'` );
		return this._doRegister( {
			name: name,
			dependencies: [],
			start: () => value,
			stop: _.noop
		} );
	}

	registerFile( filepath ) {
		let lib = require( filepath );
		let name = this._generateNameFromFilepath( filepath );
		if ( _.isFunction( lib ) ) {
			let result = functionParser.parse( lib );

			// Register as new instance.
			return this._doRegister( {
				name: name,
				dependencies: result.args,
				start: function( ...deps ) {
					return lib.apply( {}, deps );
				},
				stop: _.noop
			} );
		} else if ( this._isValidReturnValue( lib ) ) {
			// Register as value.
			return this._doRegister( {
				name: name,
				dependencies: [],
				start: () => lib,
				stop: _.noop
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
		return _.map( this.modules, 'name' );
	}

	start() {
		if ( !this.started )
			this.startPromise = Bluebird.try( this._doStart.bind( this ) );
		return this.startPromise;
	}

	stop() {
		if ( !this.started )
			throw new Error( 'Cannot stop, loader not even started' );
		if ( !this.stopped )
			this.stopPromise = Bluebird.try( this._doStop.bind( this ) );
		return this.stopPromise;
	}

	// #region current loader state

	get started() {
		return this.startPromise !== null;
	}

	get stopped() {
		return this.stopPromise !== null;
	}

	// #endregion
	// #region private methods

	_ensureModuleReturnValue( module, x ) {
		if ( !module.anonymous && !this._isValidReturnValue( x ) )
			throw Error( `Module '${ module.name }' should return a valid object, to be used by other modules, got: ${ x } ` );
		return x;
	}

	_isValidReturnValue( x ) {
		return !_.isNil( x );
	}

	_register1( a ) {
		if ( _.isArray( a ) ) {
			// Array syntax definition
			let [ deps, prelast, last ] = [ a.slice( 0, -2 ), a.slice( -2, a.length - 1 )[0], a.slice( -1, a.length )[0] ];
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
		} else if ( _.isObjectLike( a ) ) {
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
		if ( _.isArray( a ) ) {
			// Anonymous spread syntax with no stop function.
			return this._doRegister( { dependencies: a, start: b } );
		} else if ( this._isArgValidName( a ) && _.isObjectLike( b ) ) {
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
		if ( _.isArray( a ) ) {
			// Anonymous spread syntax.
			return this._doRegister( { dependencies: a, start: b, stop: c } );
		} else if ( this._isArgValidName( a ) && this._isArgValidDependencies( b ) && _.isObjectLike( c ) ) {
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
		return _.isString( name );
	}

	_isArgValidDependencies( deps ) {
		return _.isString( deps ) || _.isArray( deps );
	}

	_isArgValidStart( start ) {
		return _.isFunction( start );
	}

	_isArgValidStop( stop ) {
		return _.isFunction( stop );
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

		this.modules[ mod.name ] = {
			name: mod.name,
			anonymous: mod.anonymous,
			dependencies: mod.dependencies,
			start: mod.start,
			stop: mod.stop,
			obj: mod.obj,
			order: null,
			dependenciesPromise: null,
			startPromise: null,
			stopPromise: null
		};

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
		} else if ( _.isString( mod.dependencies ) ) {
			if ( mod.dependencies === '' ) {
				mod.dependencies = [];
			} else {
				mod.dependencies = [ mod.dependencies ];
			}
		} else if ( !_.isArray( mod.dependencies ) ) {
			throw new Error( `Module '${ mod.name }' does not define a valid dependencies property.` );
		}

		/* istanbul ignore else */
		if ( _.isUndefined( mod.start ) ) {
			mod.start = function() { return mod.obj; };
		} else if ( !this._isArgValidStart( mod.start ) ) {
			throw new Error( `Module '${ mod.name }' does not define a valid start property.` );
		}

		/* istanbul ignore else */
		if ( _.isUndefined( mod.stop ) ) {
			mod.stop = function() { return mod.obj; };
		} else if ( !this._isArgValidStop( mod.stop ) ) {
			throw new Error( `Module '${ mod.name }' does not define a valid stop property.` );
		}

		let invalidDependencies = _.filter( mod.dependencies, d => !isValidDependencyName( d ) || d === mod.name );
		if ( invalidDependencies.length > 0 )
			throw new Error( `Module '${ mod.name }' specified some invalid dependencies: ${ invalidDependencies.join( ', ' ) }` );

		// Ensure that a mod object exists.
		mod.obj = mod.obj || mod;

		return mod;

	}

	_doStart() {

		if ( this.length === 0 )
			return Bluebird.resolve();

		// Validate module dependencies.
		let missingDependencies = _( this.modules )
			.map( m => m.dependencies )
			.flatten()
			.uniq()
			.filter( dependencyName => !this.modules[ dependencyName ] )
			.value();
		if ( missingDependencies.length > 0 )
			throw new Error( `Unable to start ModuleLoader: Some dependencies could not be resolved: ${ missingDependencies.join( ', ' ) } ` );

		// We have at least one module to load, but no module has 0 depedency.
		let rootModules = _.filter( this.modules, m => m.dependencies.length === 0 );
		if ( rootModules.length === 0 )
			throw new Error( `Unable to start ModuleLoader: No module found without dependencies !` );

		// Assign order 0 to root modules and let them start loading.
		_.each( rootModules, m => {
			m.order = 0;
			m.dependenciesPromise = [];
			m.startPromise = Bluebird.resolve().then( () => m.start() ).then( ( x ) => this._ensureModuleReturnValue( m, x ) );
		} );

		// Sort the modules
		let stale = false, missingModules = _.filter( this.modules, m => m.order === null );
		while ( !stale && missingModules.length > 0 ) {

			stale = true;
			_.each( missingModules, m => {

				let dependenciesResolved = true, lastDependency = 0, promises = [];
				for ( let dependencyName of m.dependencies ) {
					let dependency = this.modules[ dependencyName ];
					if ( dependency.order === null ) {
						dependenciesResolved = false;
						break;
					} else {
						lastDependency = Math.max( lastDependency, dependency.order );
						promises.push( dependency.startPromise );
					}
				}

				if ( dependenciesResolved ) {
					stale = false;
					m.order = lastDependency + 1;
					m.dependenciesPromise = promises;
					m.startPromise = Bluebird.all( m.dependenciesPromise )
						.then( args => m.start.apply( m, args ) )
						.then( x => this._ensureModuleReturnValue( m, x ) );
				}


			} );

			missingModules = _.filter( this.modules, m => m.order === null );

		}

		if ( stale )
			throw new Error( `Unable to start ModuleLoader: Circular dependencies detected, some modules could not be started: ${ _.map( missingModules, m => m.name ).join( ', ' ) } !` );

		return Bluebird.all( _.map( this.modules, m => m.startPromise ) );
	}

	_doStop() {

		return _( this.modules )
			.sortBy( 'order' )
			.reverse()
			.reduce( ( partialPromise, m ) => {
				if ( m.startPromise.isFulfilled() ) {
					// If the module was started, stop it.
					let promises = [].concat( m.startPromise ).concat( m.dependenciesPromise );
					return partialPromise.then( () => Bluebird.resolve( promises ).spread( m.stop ) );
				} else {
					// If the module was still waiting for dependencies, cancel it and ignore it.
					m.startPromise.cancel();
					return partialPromise;
				}
			}, Bluebird.resolve() );

	}

	_generateAnonymousModuleName() {
		return 'anonymous-' + ( 'xxxxxxxx'.replace( /[x]/g, function( c ) {
			var r = Math.random() * 16 | 0, v = ( r & 0x3 | 0x8 ); // eslint-disable-line no-mixed-operators
			return v.toString( 16 );
		} ) );
	}

	_generateNameFromFilepath( filepath ) {
		let filename = path.parse( filepath ).name;
		return _.camelCase( filename );
	}

	// #endregion

}

module.exports = ModuleLoader;