
const _ = require( 'lodash' )
	, Bluebird = require( 'bluebird' )
	;

Bluebird.config( { cancellation: true } );

let isValidDependency = (str) => {
	return _.isString( str ) && str.match(/^[A-Za-z0-9-]+$/);
};

class ModuleLoader {

	constructor() {
		this.length = 0;
		this.modules = {};
		this.startPromise = null;
		this.stopPromise = null;
	}

	register( name, dependencies, start, stop ) {
		if ( _.isObject( name ) ) {
			return this._doRegister( name );
		} else {
			return this._doRegister( {
				name: name,
				dependencies: dependencies,
				start: start,
				stop: stop
			} );
		}
	}

	resolve( moduleName ) {
		if ( !this.modules[ moduleName ] )
			return undefined;
		if ( !this.started )
			throw new Error( 'ModuleLoader not yet started.' );
		return this.modules[ moduleName ].startPromise;
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
		if ( x === null || x === undefined )
			throw Error( `Module ${ module.name } should return a valid object, to be used by other modules, got: ${ typeof(x) }` );
		return x;
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
			throw new Error( 'Module does not define a valid name property.' );

		if ( this.modules[ mod.name ] )
			throw new Error( 'Cannot override module definition.' );

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
				throw new Error( 'Module does not define a valid dependencies property.' );
			}
		}

		let invalidDependencies = _.filter( mod.dependencies, d => !isValidDependency( d ) || d === mod.name );
		if ( invalidDependencies.length > 0 )
			throw new Error( 'Module specified some invalid dependencies: ' + invalidDependencies.join( ', ' ) );

		if ( !_.isFunction( mod.start ) ) {
			if ( _.isUndefined( mod.start ) ) {
				mod.start = () => { return {}; };
			} else {
				throw new Error( 'Module does not define a valid start property.' );
			}
		}

		if ( !_.isFunction( mod.stop ) ) {
			if ( _.isUndefined( mod.stop ) ) {
				mod.stop = _.noop;
			} else {
				throw new Error( 'Module does not define a valid stop property.' );
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
			.filter( dependencyName => !this.modules[ dependencyName ] )
			.value();
		if ( missingDependencies.length > 0 )
			throw new Error( `Unable to start ModuleLoader: Some dependencies could not be resolved: ${ missingDependencies.join(', ') }` );

		// We have at least one module to load, but no module has 0 depedency.
		let rootModules = _.filter( this.modules, m => m.dependencies.length === 0 );
		if ( rootModules.length === 0 )
			throw new Error( `Unable to start ModuleLoader: No module found without dependencies !` );

		// Assign order 0 to root modules and let them start loading.
		_.each( rootModules, m => {
			m.order = 0;
			m.dependenciesPromise = [];
			m.startPromise = Bluebird.resolve().then( () => m.start() ).then( (x) => this._ensureModuleReturnValue( m, x ) );
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
					m.startPromise = Bluebird.all( m.dependenciesPromise ).spread( m.start );
				}


			} );

			missingModules = _.filter( this.modules, m => m.order === null );

		}

		if ( stale )
			throw new Error( `Unable to start ModuleLoader: Circular dependencies detected, some modules could not be started: ${_.map( missingModules, m => m.name ).join( ', ' )} !` );

		return Bluebird.all( _.map( this.modules, m => m.startPromise ) );
	}

	_doStop() {

		if ( !this.started )
			throw new Error( 'Cannot stop, loader not even started' );

		return _( this.modules )
			.sortBy( 'order' )
			.reverse( )
			.reduce( (partialPromise, m) => {
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

}

module.exports = ModuleLoader;