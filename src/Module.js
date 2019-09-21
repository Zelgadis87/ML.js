
const a = 1 // eslint-disable-line no-unused-vars
	, Bluebird = require( 'bluebird' )
	, createTask = require( './create-task' )
	, isNullOrUndefined = x => x === null || x === undefined
	, lodash = require( 'lodash' )
	;

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

		this._starting = false;
		this._started = false;
		this._stopping = false;
		this._stopped = false;
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

	/**
	 * Returns this module order.\n
	 * A module order is defined as the priority in which a module should be loaded, relative to other modules.\n
	 * Order is:
	 * - null if order has not been calculated yet
	 * - 0 if the module has no dependencies
	 * - otherwise it is the max order of the module dependencies plus one.
	 * @return this module order, according to the above rules
	 */
	get order() {
		return this._order;
	}

	set order( value ) {
		if ( this._order !== null )
			throw new Error( 'Module already has an order' );
		this._order = value;
	}

	_createStartTask() {
		return createTask( () => Bluebird.resolve()
			// .tap( _ => console.info( 'Waiting for dependencies', m.name, _.map( m.resolvedDependencies, 'name' ) ) )
			.then( () => Bluebird.all( lodash.map( this.resolvedDependencies, d => d.startTask ) ) )
			// .tap( _ => console.info( 'Dependencies ready', m.name ) )
			.then( deps => {
				if ( this._stopping || this._stopped )
					return undefined;
				return Bluebird.resolve( deps )
					// .tap( _ => console.info( 'Starting', this.name ) )
					.tap( _ => this._starting = true )
					.then( args => this.start.apply( this, args ) )
					.tap( x => this._ensureValidReturnValue( x ) )
					.tap( _ => this._starting = false )
					.tap( _ => this._started = true )
					// .tap( x => console.info( 'Started', this.name, x ) )
				;
			} )
			// .catch( err => console.error( 'Failed to start task:', err ) )
		);
	}

	_createStopTask() {
		return createTask( descendant => {
			// console.info( 'Stopping', this.name, this.order, lodash.map( descendant.modules, 'name' ) );
			this._stopping = true;
			return Bluebird.resolve( descendant.promise )
				// .tap( _ => console.info( 'Beginning stop procedure', this.name, this.order, this.started, this.starting ) )
				.then( _ => {
					if ( !this._started && !this._starting )
						return undefined;
					// console.info( this.name, 'Waiting on modules: ', [ this, ...this.resolvedDependencies ].map( x => x.name ), [ this, ...this.resolvedDependencies ].map( x => x.startTask.isFulfilled() ) );
					return Bluebird.resolve( [ this.startTask, ...lodash.map( this.resolvedDependencies, d => d.startTask ) ] )
						.all()
						.then( values => this.stop( ...values ) );
				} )
				.tap( _ => this._stopped = true )
				.tap( _ => this._stopping = false )
				// .tap( _ => console.info( 'Stopped', this.name ) )
				// .catch( err => console.error( 'Failed to stop task:', err ) )
			;
		} );
	}

	_ensureValidReturnValue( x ) {
		if ( !this.anonymous && isNullOrUndefined( x ) )
			throw Error( `Module '${ this.name }' should return a valid object to be used by other modules, got: ${ x } ` );
	}

}

module.exports = Module;