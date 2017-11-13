
const _ = require( 'lodash' )
	, Bluebird = require( 'bluebird' )
	, fs = require( 'fs' )
	, path = require( 'path' )
	, parseFunction = require( 'parse-function' )().parse
	;

Bluebird.config( { cancellation: true } );

let isValidDependency = ( str ) => {
	return _.isString( str ) && str.match( /^[A-Za-z0-9-]+$/ );
};

class ModuleLoader {

	constructor() {
		this.length = 0;
		this.modules = {};
		this.startPromise = null;
		this.stopPromise = null;
		this._anonymousCounter = 0;
	}

	register( name, dependencies, start, stop ) {

		if ( _.isArray( name ) && arguments.length < 4 ) {
			// Name is missing, shift arguments.
			if ( !_.isUndefined( dependencies ) ) {
				// Anonymous module registration with explicit parameters
				return this._doRegister( {
					name: this._generateAnonymousModuleName(),
					dependencies: name,
					start: dependencies,
					stop: start
				} );
			} else {
				// Array syntax definition
				let arr = name
					, last = arr.length > 0 ? arr[ arr.length - 1 ] : undefined
					, prelast = arr.length > 1 ? arr[ arr.length - 2 ] : undefined
					;

				if ( _.isFunction( last ) ) {
					if ( _.isFunction( prelast ) ) {
						// last two parameters are the start and stop functions, respectively
						start = prelast;
						stop = last;
						dependencies = arr.slice( 0, -2 );
					} else {
						// last parameter is the start function
						start = last;
						stop = undefined;
						dependencies = arr.slice( 0, -1 );
					}
					return this._doRegister( {
						name: this._generateAnonymousModuleName(),
						dependencies: dependencies,
						start: start,
						stop: stop
					} );
				} else {
					throw new Error( 'Module does not define a valid start function in array syntax.' );
				}
			}
		} else if ( _.isObject( name ) ) {
			return this._doRegister( name );
		} else {
			let bind = function( fn, _this ) {
				return fn ? _.bind( fn, _this ) : undefined;
			};

			if ( arguments.length === 2 && _.isObject( dependencies ) ) {
				// Object instance mode with no dependencies
				return this._doRegister( {
					name: name,
					dependencies: [],
					start: bind( dependencies.start, dependencies ),
					stop: bind( dependencies.stop, dependencies )
				} );
			} else if ( arguments.length === 3 && _.isObject( start ) ) {
				// Object instance mode with dependencies
				return this._doRegister( {
					name: name,
					dependencies: dependencies,
					start: bind( start.start, start ),
					stop: bind( start.stop, start )
				} );
			} else {
				// Spread syntax
				return this._doRegister( {
					name: name,
					dependencies: dependencies,
					start: start,
					stop: stop
				} );
			}
		}

	}

	async resolve( dep ) {

		if ( _.isArray( dep ) ) {
			let invalidDependencies = dep.filter( ( name ) => !isValidDependency( name ) );
			if ( invalidDependencies.length > 0 )
				throw new Error( 'Invalid module names found: ' + invalidDependencies.join( ', ' ) );
			return Bluebird.all( dep.map( ( name ) => this.resolve( name ) ) );
		} else if ( isValidDependency( dep ) ) {
			if ( !this.modules[ dep ] )
				return Bluebird.resolve( undefined );
			if ( !this.started )
				this.start();
			return this.modules[ dep ].startPromise;
		} else {
			throw new Error( `Invalid dependency name, string or array expected, got: ${ dep }` );
		}

	}

	registerValue( name, value ) {
		if ( !this._isValidReturnValue( value ) )
			throw new Error( `Value ${ value } is not valid for module ${ name }` );
		return this._doRegister( {
			name: name,
			dependencies: [],
			start: () => value,
			stop: _.noop
		} );
	}

	registerFile( filepath ) {
		let lib = require( filepath );
		if ( _.isFunction( lib ) ) {
			let name = this._generateNameFromFilepath( filepath );
			let result = parseFunction( lib );

			return this._doRegister( {
				name: name,
				dependencies: result.args,
				start: function( ...deps ) {
					return lib.apply( {}, deps );
				},
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
			this.startPromise = this._doStart();
		return this.startPromise;
	}

	stop() {
		if ( !this.stopped )
			this.stopPromise = this._doStop();
		return this.stopPromise;
	}

	get started() {
		return this.startPromise !== null;
	}

	get stopped() {
		return this.stopPromise !== null;
	}

	_ensureModuleReturnValue( module, x ) {
		if ( !this._isValidReturnValue( x ) )
			throw Error( `Module ${ module.name } should return a valid object, to be used by other modules, got: ${ x } ` );
		return x;
	}

	_isValidReturnValue( x ) {
		return x !== null && x !== undefined;
	}

	_doRegister( mod ) {

		mod = this._validateModuleDefinition( mod );

		Object.defineProperty( mod, 'name', {
			value: mod.name,
			writable: false,
			enumerable: false
		} );

		this.modules[ mod.name ] = {
			name: mod.name,
			dependencies: mod.dependencies,
			start: mod.start,
			stop: mod.stop,
			order: null,
			dependenciesPromise: null,
			startPromise: null,
			stopPromise: null
		};

		this.length++;

	}

	_validateModuleDefinition( mod ) {

		if ( !_.isString( mod.name ) || !mod.name.match( /^[A-z0-9-_]+$/ ) )
			throw new Error( 'Module does not define a valid name property: ' + mod.name );

		if ( this.modules[ mod.name ] )
			throw new Error( 'Cannot override module definition: ' + mod.name );

		if ( !_.isArray( mod.dependencies ) ) {
			if ( _.isNull( mod.dependencies ) || _.isUndefined( mod.dependencies ) ) {
				mod.dependencies = [];
			} else if ( _.isString( mod.dependencies ) ) {
				if ( mod.dependencies === '' ) {
					mod.dependencies = [];
				} else {
					mod.dependencies = [ mod.dependencies ];
				}
			} else {
				throw new Error( `Module ${ mod.name } does not define a valid dependencies property.` );
			}
		}

		let invalidDependencies = _.filter( mod.dependencies, d => !isValidDependency( d ) || d === mod.name );
		if ( invalidDependencies.length > 0 )
			throw new Error( `Module ${ mod.name } specified some invalid dependencies: ${ invalidDependencies.join( ', ' ) }` );

		if ( !_.isFunction( mod.start ) ) {
			if ( _.isUndefined( mod.start ) ) {
				mod.start = () => { return {}; };
			} else {
				throw new Error( `Module ${ mod.name } does not define a valid start property.` );
			}
		}

		if ( !_.isFunction( mod.stop ) ) {
			if ( _.isUndefined( mod.stop ) ) {
				mod.stop = _.noop;
			} else {
				throw new Error( `Module ${ mod.name } does not define a valid stop property.` );
			}
		}

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

		if ( !this.started )
			throw new Error( 'Cannot stop, loader not even started' );

		return _( this.modules )
			.sortBy( 'order' )
			.reverse()
			.reduce( ( partialPromise, m ) => {
				if ( m.startPromise.isFulfilled() ) {
					// If the module was started, stop it.
					return partialPromise.then( Bluebird.resolve( [].concat( m.startPromise ).concat( m.dependenciesPromise ) ).spread( m.stop ) );
				} else {
					// If the module was still waiting for dependencies, cancel it and ignore it.
					m.startPromise.cancel();
					return partialPromise;
				}
			}, Bluebird.resolve() );

	}

	_generateAnonymousModuleName() {
		return 'anonymous-module-' + this._anonymousCounter++;
	}

	_generateNameFromFilepath( filepath ) {
		let filename = path.parse( filepath ).name;
		return _.camelCase( filename );
	}

}

module.exports = ModuleLoader;