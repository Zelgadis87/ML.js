
/* eslint-env mocha */

const a = 1 // eslint-disable-line no-unused-vars
	, Bluebird = require( 'bluebird' )
	, chai = require( 'chai' )
	, expect = chai.use( require( 'chai-as-promised' ) ).expect
	, lodash = require( 'lodash' )
	;

describe( 'ModuleLoader', function() {

	let ModuleLoaderClass = require( '../src/ModuleLoader.js' )
		, moduleLoader
		;

	beforeEach( function() {
		moduleLoader = new ModuleLoaderClass();
	} );

	describe( '#register', function() {

		it( 'should not allow modules with empty or null names', function() {
			expect( () => moduleLoader.register() ).to.throw( Error );
			expect( () => moduleLoader.register( null ) ).to.throw( Error );
			expect( () => moduleLoader.register( undefined ) ).to.throw( Error );
			expect( () => moduleLoader.register( '' ) ).to.throw( Error );
			expect( () => moduleLoader.register( 2 ) ).to.throw( Error );
		} );

		it( 'should not allow a module to override an already registered module', function() {
			expect( () => moduleLoader.register( { name: 'a', dependencies: [] } ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( { name: 'a', dependencies: [] } ) ).to.throw( Error );
		} );

		it( 'should not allow a module to depend on itself', function() {
			expect( () => moduleLoader.register( { name: 'a', dependencies: [ 'a' ] } ) ).to.throw( Error );
		} );

		it( 'should not allow module names or dependencies with spaces', function() {
			moduleLoader.register( 'a' );
			expect( () => moduleLoader.register( { name: 'b', dependencies: [ 'a b' ] } ) ).to.throw( Error );
			expect( () => moduleLoader.register( { name: 'a b', dependencies: [ 'a' ] } ) ).to.throw( Error );
		} );

		it( 'should not allow module dependencies that are not strings or arrays', function() {
			expect( () => moduleLoader.register( { name: 'a', dependencies: 2 } ) ).to.throw( Error );
			expect( () => moduleLoader.register( { name: 'a', dependencies: {} } ) ).to.throw( Error );
		} );

		it( 'should not consider a module name property at runtime', function() {
			let moduleA = { name: 'a' };
			moduleLoader.register( moduleA );
			moduleA.name = 'b';

			let moduleB = { name: 'b' };
			expect( () => moduleLoader.register( moduleB ) ).to.not.throw( Error );
		} );

		it( 'should allow a module with minimal configuration', function() {
			expect( () => moduleLoader.register( 'a' ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( { name: 'b' } ) ).to.not.throw( Error );
			return expect( moduleLoader.start() ).to.eventually.be.fulfilled;
		} );

		it( 'should allow a module with a valid object definition', function() {
			expect( () => moduleLoader.register( { name: 'a', dependencies: [], start: lodash.noop, stop: lodash.noop } ) ).to.not.throw( Error );
		} );

		it( 'should allow a module with a valid spread definition', function() {
			expect( () => moduleLoader.register( 'a', [] ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( 'b', [], lodash.noop ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( 'c', [], lodash.noop, lodash.noop ) ).to.not.throw( Error );
		} );

		it( 'should allow a module with a name and an object definition', function() {
			expect( () => moduleLoader.register( 'a', { start: lodash.noop, stop: lodash.noop } ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( 'b', { start: lodash.noop } ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( 'c', { stop: lodash.noop } ) ).to.not.throw( Error );
		} );

		it( 'should allow a module with a namem, dependencies and an object definition', function() {
			expect( () => moduleLoader.register( 'a', [], { start: lodash.noop, stop: lodash.noop } ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( 'b', [ 'a' ], { start: lodash.noop } ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( 'c', [ 'a' ], { stop: lodash.noop } ) ).to.not.throw( Error );
		} );

		it( 'should allow a module definition with an empty string as dependency', function() {
			expect( () => moduleLoader.register( { name: 'a', dependencies: '' } ) ).to.not.throw( Error );
		} );

		it( 'should allow a module with a string dependency', function() {
			expect( () => moduleLoader.register( { name: 'a', dependencies: 'b', start: lodash.noop, stop: lodash.noop } ) ).to.not.throw( Error );
		} );

		it( 'should allow modules registration out of order', function() {
			expect( () => moduleLoader.register( { name: 'b', dependencies: [], start: lodash.noop, stop: lodash.noop } ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( { name: 'a', dependencies: 'b', start: lodash.noop, stop: lodash.noop } ) ).to.not.throw( Error );
		} );

		it( 'should throw an error is start or stop are not functions', function() {
			expect( () => moduleLoader.register( { name: 'a', dependencies: [], start: '', stop: lodash.noop } ) ).to.throw( Error );
			expect( () => moduleLoader.register( { name: 'a', dependencies: [], start: lodash.noop, stop: '' } ) ).to.throw( Error );
		} );

		it( 'should support registering anonymous modules', function() {
			expect( () => moduleLoader.register( [], lodash.noop ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( [], lodash.noop, lodash.noop ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( { dependencies: [], start: lodash.noop, stop: lodash.noop } ) ).to.not.throw( Error );
		} );

		it( 'should not support array syntax without a start function', function() {
			expect( () => moduleLoader.register( [] ) ).to.throw( Error );
			expect( () => moduleLoader.register( [ 'a', 'b' ] ) ).to.throw( Error );
		} );

		it( 'should support array syntax with only a start function', function() {
			expect( () => moduleLoader.register( [ 'a', 'b', lodash.noop ] ) ).to.not.throw( Error );
		} );

		it( 'should support array syntax with start and stop functions', function() {
			expect( () => moduleLoader.register( [ 'a', 'b', lodash.noop, lodash.noop ] ) ).to.not.throw( Error );
		} );

		it( 'should support array syntax without dependencies', function() {
			expect( () => moduleLoader.register( [ lodash.noop ] ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( [ lodash.noop, lodash.noop ] ) ).to.not.throw( Error );
		} );

		it( 'should not support nulls', function() {
			expect( () => moduleLoader.register( null ) ).to.throw( Error );
			expect( () => moduleLoader.register( null, null ) ).to.throw( Error );
			expect( () => moduleLoader.register( null, null, null ) ).to.throw( Error );
			expect( () => moduleLoader.register( null, null, null, null ) ).to.throw( Error );
		} );

		it( 'should throw an exception if already started', function() {
			expect( () => moduleLoader.register( 'a' ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( { name: 'b', dependencies: 'a' } ) ).to.not.throw( Error );
			return moduleLoader.start().then( () => {
				expect( () => moduleLoader.register( 'b' ) ).to.throw( Error );
			} );
		} );

	} );

	describe( '#length', function() {

		it( 'should be 0 by default', function() {
			expect( moduleLoader.length ).to.be.eql( 0 );
		} );

		it( 'should increase every time a module is registered', function() {
			moduleLoader.register( { name: 'a', dependencies: [] } );
			expect( moduleLoader.length ).to.be.eql( 1 );
		} );

	} );

	describe( '#start', function() {

		it( 'should do nothing if no module is registered', function() {
			return expect( moduleLoader.start() ).to.be.eventually.fulfilled;
		} );

		it( 'should run modules that have no dependencies', function() {

			let run = false;
			moduleLoader.register( { name: 'a', dependencies: [], start: () => run = true } );
			return moduleLoader.start().then( () => expect( run ).to.be.true );

		} );

		it( 'should only start once, even if called multiple times', function() {

			let counter = 0, count = () => counter++;
			moduleLoader.register( { name: 'a', dependencies: [], start: count } );
			return Promise.resolve( moduleLoader.start() ).then( () => moduleLoader.start() ).then( () => {
				expect( counter ).to.be.eql( 1 );
			} );

		} );

		it( 'should eventually throw an error if a circular dependency is found', function() {

			moduleLoader.register( { name: 'a', dependencies: [] } );
			moduleLoader.register( { name: 'b', dependencies: [ 'c' ] } );
			moduleLoader.register( { name: 'c', dependencies: [ 'a', 'b' ] } );
			return expect( moduleLoader.start() ).to.eventually.be.rejected;

		} );

		/**
		 * Please note that this test is actually included in the circular dependency one since,
		 * without a root module, a circular dependency is mathematically required to happen.
		 * The test is only here to cover for the more descriptive error message returned to
		 * the user in this particular case.
		 */
		it( 'should eventually throw an error if no root modules are found', function() {

			moduleLoader.register( { name: 'a', dependencies: [ 'b' ] } );
			moduleLoader.register( { name: 'b', dependencies: [ 'c' ] } );
			moduleLoader.register( { name: 'c', dependencies: [ 'a' ] } );
			return expect( moduleLoader.start() ).to.eventually.be.rejected;

		} );

		it( 'should eventually throw an error if an unknown dependency is found', function() {

			moduleLoader.register( { name: 'a', dependencies: [] } );
			moduleLoader.register( { name: 'b', dependencies: [ 'c' ] } );
			return expect( moduleLoader.start() ).to.eventually.be.rejected;

		} );

		it( 'should eventually throw an error if a root module returns undefined', function() {
			moduleLoader.register( { name: 'a', dependencies: [], start: lodash.noop } );
			return expect( moduleLoader.start() ).to.eventually.be.rejected;
		} );

		it( 'should eventually throw an error if a dependant module returns undefined', function() {
			moduleLoader.register( { name: 'a', dependencies: [], start: () => 1 } );
			moduleLoader.register( { name: 'b', dependencies: 'a', start: lodash.noop } );
			return expect( moduleLoader.start() ).to.eventually.be.rejected;
		} );

		it( 'should load modules in parallel when no dependency is shared', function() {

			let counter = 0, delayedCount = () => Bluebird.delay( 10 ).then( () => counter++ );
			moduleLoader.register( { name: 'a', dependencies: [], start: () => { expect( counter ).to.be.eql( 0 ); return delayedCount(); } } );
			moduleLoader.register( { name: 'b', dependencies: [], start: () => { expect( counter ).to.be.eql( 0 ); return delayedCount(); } } );
			moduleLoader.register( { name: 'c', dependencies: [], start: () => { expect( counter ).to.be.eql( 0 ); return delayedCount(); } } );
			return moduleLoader.start();

		} );

		it( 'should load modules in sequence when a dependency is shared', function() {

			let counter = 0, delayedCount = () => Bluebird.delay( 10 ).then( () => counter++ );
			moduleLoader.register( { name: 'a', dependencies: [], start: () => { expect( counter ).to.be.eql( 0 ); return delayedCount(); } } );
			moduleLoader.register( { name: 'b', dependencies: [ 'a' ], start: () => { expect( counter ).to.be.eql( 1 ); return delayedCount(); } } );
			moduleLoader.register( { name: 'c', dependencies: [ 'b' ], start: () => { expect( counter ).to.be.eql( 2 ); return delayedCount(); } } );
			moduleLoader.register( { name: 'd', dependencies: [ 'b' ], start: () => { expect( counter ).to.be.eql( 2 ); return delayedCount(); } } );
			return moduleLoader.start();

		} );

		it( 'should load module groups in sequence', function() {

			// TODO: Fasten this.
			this.slow( 2000 );
			this.timeout( 5000 );

			let maxGroups = 5,
				groups = Array( maxGroups ).fill( false ),
				status = i => `[ ${ groups.map( ( loaded, idx ) => ( idx === i ) ? 'x' : ( loaded ? '✓' : '-' ) ).join( ' ' ) } ]`,
				start = ( name, i ) => {
					if ( i > 0 )
						expect( groups[ i - 1 ], `Module '${ name }' should be loaded after dependencies of group ${ i - 1 } have been already loaded: ${ status( i ) }` ).to.be.true;
					if ( i < maxGroups - 1 )
						expect( groups[ i + 1 ], `Module '${ name }' should have been loaded before dependencies of group ${ i + 1 } started ${ status( i ) }` ).to.be.false;
					groups[ i ] = true;
					return Bluebird.delay( 100 ).return( name );
				};

			moduleLoader.register( { name: 'd', dependencies: [ 'a1', 'b1', 'c' ], start: () => start( 'd', 4 ) } );

			moduleLoader.register( { name: 'b1', dependencies: [ 'b' ], start: () => start( 'b1', 2 ) } );
			moduleLoader.register( { name: 'b2', dependencies: [ 'a', 'b' ], start: () => start( 'b2', 2 ) } );

			moduleLoader.register( { name: 'c', dependencies: [ 'b2' ], start: () => start( 'c', 3 ) } );
			moduleLoader.register( { name: 'c1', dependencies: [ 'a1', 'b1' ], start: () => start( 'c1', 3 ) } );
			moduleLoader.register( { name: 'c2', dependencies: [ 'a2', 'b2' ], start: () => start( 'c2', 3 ) } );

			moduleLoader.register( { name: 'a', dependencies: [], start: () => start( 'a', 0 ) } );
			moduleLoader.register( { name: 'b', dependencies: [ 'a' ], start: () => start( 'b', 1 ) } );
			moduleLoader.register( { name: 'a1', dependencies: [ 'a' ], start: () => start( 'a1', 1 ) } );
			moduleLoader.register( { name: 'a2', dependencies: [ 'a' ], start: () => start( 'a2', 1 ) } );

			return moduleLoader.start();

		} );

		it( 'should eventually fullfill a Promise when some modules are registered', function() {
			moduleLoader.register( { name: 'a', dependencies: [] } );
			moduleLoader.register( { name: 'b', dependencies: [ 'a' ] } );
			expect( moduleLoader.start() ).to.be.an.instanceOf( Bluebird );
			return expect( moduleLoader.start() ).to.eventually.be.fulfilled;
		} );

		it( 'should eventually reject a Promise if a start function does not return a value', function() {
			moduleLoader.register( { name: 'a', dependencies: [], start: function() { } } );
			expect( moduleLoader.start() ).to.be.an.instanceOf( Bluebird );
			return expect( moduleLoader.start() ).to.eventually.be.rejected;
		} );

		it( 'should start root modules without parameters', function() {
			moduleLoader.register( {
				name: 'a',
				dependencies: [],
				start: ( a ) => {
					expect( a ).to.be.undefined;
					return 0;
				}
			} );
			return moduleLoader.start();
		} );

		it( 'should start modules with their respective dependencies already resolved', function() {
			moduleLoader.register( {
				name: 'a', dependencies: [], start: () => {
					return 1;
				}
			} );
			moduleLoader.register( {
				name: 'b', dependencies: [ 'a' ], start: ( a ) => {
					expect( a ).to.be.eql( 1 );
					return a + 1;
				}
			} );
			moduleLoader.register( {
				name: 'c', dependencies: [ 'a', 'b' ], start: ( a, b ) => {
					expect( a ).to.be.eql( 1 );
					expect( b ).to.be.eql( 2 );
					return a + b;
				}
			} );
			moduleLoader.register( {
				name: 'd', dependencies: [ 'a', 'c' ], start: ( a, c ) => {
					expect( a ).to.be.eql( 1 );
					expect( c ).to.be.eql( 3 );
					return a + c;
				}
			} );
			return moduleLoader.start();
		} );

		/**
		 * A module value changed by another module is dangerous, as it is prone to race conditions and order requirements which cannot be satisfied by this library.
		 * On the other hand, forcing a different instance of a dependency per module means that no communication can ever be accomplished between modules.
		 * Between the two evils, we prefer the shared instance way, moving the race condition problems up in the hands of the user.
		 */
		it( 'should allow different modules to share state between dependencies', function() {
			moduleLoader.register( { name: 'a', dependencies: [], start: () => { return { value: 1 }; } } );
			moduleLoader.register( {
				name: 'b', dependencies: [ 'a' ], start: ( a ) => {
					expect( a.value ).to.be.eql( 1 );
					a.value = 0;
					return 1;
				}
			} );
			moduleLoader.register( {
				name: 'c', dependencies: [ 'a', 'b' ], start: ( a, b ) => {
					expect( a.value ).to.be.eql( 0 );
					expect( b ).to.be.eql( 1 );
					return 1;
				}
			} );
			return moduleLoader.start();
		} );

		it( 'should support array syntax ', function() {
			let counter = 0, delayedCount = () => Bluebird.delay( 10 ).then( () => counter++ );
			moduleLoader.register( { name: 'a', dependencies: [], start: delayedCount } );
			moduleLoader.register( [ 'a', () => expect( counter ).to.be.eql( 1 ) ] );
			return moduleLoader.start();
		} );

		it( 'should support object instance mode ', function() {
			let counter = 0, delayedCount = () => Bluebird.delay( 10 ).then( () => counter++ );
			moduleLoader.register( 'a1', { start: delayedCount } );
			moduleLoader.register( 'a2', [], { start: delayedCount } );
			moduleLoader.register( 'b', [ 'a1', 'a2' ], { start: () => { expect( counter ).to.be.eql( 2 ); return delayedCount(); } } );
			moduleLoader.register( 'c', [ 'b' ], { start: () => { expect( counter ).to.be.eql( 3 ); return delayedCount(); } } );
			return moduleLoader.start();
		} );

		it( 'should use the proper this object when in object instance mode', function() {
			let Cls = function() {
				this.times = 1;
				this.start = function() {
					expect( this.times ).to.be.eql( 1 );
					this.times = 2;
					return this;
				};
				return this;
			};
			let obj = new Cls();

			moduleLoader.register( 'obj', obj );
			return moduleLoader.start().then( () => expect( obj.times ).to.be.eql( 2 ) );
		} );

		it( 'should support ES6 classes', function() {

			let count = 0;
			class Test_A {
				constructor() { this.test = 'a'; }
				start() { return this; }
			}
			class Test_B {
				constructor() { this.test = 'b'; }
				start( a ) {
					count++;
					expect( a ).to.be.instanceof( Test_A );
					expect( a.test ).to.be.eql( 'a' );
					return this;
				}
			}

			moduleLoader.register( 'a', new Test_A() );
			moduleLoader.register( 'b', 'a', new Test_B() );
			return moduleLoader.start().then( () => {
				expect( count ).to.be.eql( 1 );
			} );
		} );

		it( 'should distinguish between object instance mode and start function', function() {
			moduleLoader.register( 'a', [], { start: function() { return this; }, value: 1 } );
			moduleLoader.register( 'b', [ 'a' ], function( a ) { return expect( a.value ).to.be.eql( 1 ); } );
			return moduleLoader.start();
		} );

		it( 'should eventually reject undefined return values for named modules', function() {
			moduleLoader.register( {
				name: 'a',
				start: () => undefined
			} );
			return expect( moduleLoader.start() ).to.be.eventually.rejected;
		} );

		it( 'should eventually allow undefined return values for anonymous modules', function() {
			moduleLoader.register( {
				start: () => undefined
			} );
			return expect( moduleLoader.start() ).to.be.eventually.fulfilled;
		} );

		it( 'should differentiate between anonymous modules', function() {
			let counter = 0;
			let startA = () => counter += 5;
			let startB = () => counter -= 3;
			moduleLoader.register( { start: startA } );
			moduleLoader.register( { start: startB } );
			return moduleLoader.start().then( () => expect( counter ).to.be.eql( 2 ) );
		} );

	} );

	describe( '#resolve', function() {

		beforeEach( () => {
			moduleLoader.register( {
				name: 'a',
				dependencies: [],
				start: () => { return 1; }
			} );
			moduleLoader.register( {
				name: 'b',
				dependencies: [ 'a' ],
				start: ( a ) => Bluebird.delay( 25 ).then( () => a + 1 )
			} );
			moduleLoader.register( {
				name: 'c',
				dependencies: [ 'a', 'b' ],
				start: ( a, b ) => a + b + 1
			} );
		} );

		it( 'should throw an error if the given argument is not a valid dependency name', function() {
			expect( () => moduleLoader.resolve() ).to.throw();
			expect( () => moduleLoader.resolve( 2 ) ).to.throw();
			expect( () => moduleLoader.resolve( [ 'a', 2 ] ) ).to.throw();
			expect( () => moduleLoader.resolve( '$' ) ).to.throw();
			expect( () => moduleLoader.resolve( [ 'a', '$' ] ) ).to.throw();
			expect( () => moduleLoader.resolve( null ) ).to.throw();
			expect( () => moduleLoader.resolve( undefined ) ).to.throw();
			expect( () => moduleLoader.resolve( {} ) ).to.throw();
		} );

		it( 'should return undefined if the given argument is not a registered dependency', function() {
			moduleLoader.register( { name: 'x', dependencies: [] } );
			return expect( moduleLoader.resolve( 'y' ) ).to.be.eventually.undefined;
		} );

		it( 'should eventually return the module calculated value', function() {
			return expect( moduleLoader.resolve( 'a' ) ).to.be.eventually.eql( 1 );
		} );

		it( 'should eventually return a value wether it has been started explicitly or not', function() {
			let promise1 = expect( moduleLoader.resolve( 'a' ) ).to.be.eventually.eql( 1 );
			moduleLoader.start();
			let promise2 = expect( moduleLoader.resolve( 'b' ) ).to.be.eventually.eql( 2 );
			return Promise.all( [ promise1, promise2 ] );
		} );

		it( 'should eventually return the module promised value', function() {
			return expect( moduleLoader.resolve( 'b' ) ).to.be.eventually.eql( 2 );
		} );

		it( 'should eventually return the module chained value', function() {
			return expect( moduleLoader.resolve( 'c' ) ).to.be.eventually.eql( 4 );
		} );

		it( 'should eventually allow resolution of multiple modules', function() {
			return expect( moduleLoader.resolve( [ 'a', 'b' ] ) ).to.be.eventually.deep.equal( [ 1, 2 ] );
		} );

		it( 'should eventually allow resolution of all listed modules', function() {
			let resolution = moduleLoader.resolve( moduleLoader.list() );
			return expect( resolution ).to.be.eventually.fulfilled;
		} );

	} );

	describe( '#stop', function() {

		it( 'should throw an error if the loader has not been started', function() {
			expect( () => moduleLoader.stop() ).to.throw( Error );
		} );

		it( 'should eventually return a resolved Promise', function() {

			moduleLoader.register( 'a', [] );
			moduleLoader.register( 'b', [ 'a' ] );
			moduleLoader.register( 'c', [ 'a', 'b' ] );

			let promise = moduleLoader.start().then( () => moduleLoader.stop() );
			expect( promise ).to.be.an.instanceOf( Bluebird );
			return expect( promise ).to.be.eventually.fulfilled;

		} );

		it( 'should stop modules in reverse order', function() {

			let x = 0;
			moduleLoader.register( { // First module
				name: 'a',
				dependencies: [],
				start: () => x++,
				stop: () => { expect( x ).to.be.eql( 1 ); x--; }
			} );
			moduleLoader.register( { // Third module
				name: 'c',
				dependencies: [ 'a', 'b' ],
				start: () => x++,
				stop: () => { expect( x ).to.be.eql( 3 ); x--; }
			} );
			moduleLoader.register( { // Second module
				name: 'b',
				dependencies: [ 'a' ],
				start: () => x++,
				stop: () => { expect( x ).to.be.eql( 2 ); x--; }
			} );

			return moduleLoader.start().then( () => moduleLoader.stop() ).then( () => expect( x ).to.be.eql( 0 ) );

		} );

		it( 'should prevent modules from starting up when stopping immediately', function() {

			let run = false;
			moduleLoader.register( {
				name: 'a',
				dependencies: [],
				start: () => run = true
			} );
			moduleLoader.register( {
				name: 'b',
				dependencies: 'a',
				start: () => Bluebird.delay( 500 )
			} );
			moduleLoader.register( {
				name: 'xxx',
				dependencies: 'b',
				start: () => {
					return Bluebird.reject( new Error( 'Module xxx should not have been started' ) );
				}
			} );

			let startPromise = moduleLoader.start();
			let stopPromise = moduleLoader.stop();

			return Bluebird.all( [ startPromise.reflect(), stopPromise.reflect() ] ).spread( ( startIntrospection, stopIntrospection ) => {
				expect( run, 'No module should start' ).to.be.false;
				expect( startIntrospection.isRejected(), 'Should cancel startup procedure' ).to.be.false;
				expect( stopIntrospection.isFulfilled() ).to.be.true;
			} );

		} );

		it( 'should finish current module initialization but not start any more modules', function() {

			let run = false;
			moduleLoader.register( {
				name: 'a',
				dependencies: [],
				start: () => Bluebird.delay( 100 ).then( () => run = true )
			} );
			moduleLoader.register( {
				name: 'xxx',
				dependencies: 'a',
				start: () => {
					return Bluebird.reject( new Error( 'Module xxx should not have been started' ) );
				}
			} );

			let startPromise = moduleLoader.start();
			let stopPromise = Bluebird.delay( 25 ).then( () => moduleLoader.stop() );

			return Bluebird.all( [ startPromise.reflect(), stopPromise.reflect() ] ).spread( ( startIntrospection, stopIntrospection ) => {
				expect( run, 'No dependency modules should have already been started' ).to.be.true;
				expect( startIntrospection.isRejected(), 'Should have canceled startup procedure' ).to.be.false;
				expect( stopIntrospection.isFulfilled() ).to.be.true;
			} );

		} );

		it( 'should gracefully stop modules started while stopping', function() {

			let stoppedA = false, stoppedB = false;
			moduleLoader.register( {
				name: 'a',
				dependencies: [],
				stop: () => Bluebird.delay( 50 ).then( () => stoppedA = true )
			} );
			moduleLoader.register( {
				name: 'b',
				dependencies: 'a',
				start: () => Bluebird.delay( 200 ).return( {} ),
				stop: () => Bluebird.delay( 50 ).then( () => stoppedB = true )
			} );
			moduleLoader.register( {
				name: 'xxx',
				dependencies: 'b',
				start: () => {
					return Bluebird.reject( new Error( 'Module xxx should not have been started' ) );
				}
			} );

			let startPromise = moduleLoader.start();
			let stopPromise = Bluebird.delay( 100 ).then( () => moduleLoader.stop() );

			return Bluebird.all( [ startPromise.reflect(), stopPromise.reflect() ] ).spread( ( startIntrospection, stopIntrospection ) => {
				expect( stoppedA, 'Should stop module A which was already started' ).to.be.true,
				expect( stoppedB, 'Should stop module B which was in the process of being started during the stop event' ).to.be.true,
				expect( startIntrospection.isRejected(), 'Should cancel startup procedure' ).to.be.false;
				expect( stopIntrospection.isFulfilled() ).to.be.true;
			} );

		} );

		it( 'should not stop modules twice if called multiple times', function() {

			let x = 0;
			moduleLoader.register( {
				name: 'a',
				dependencies: [],
				stop: () => x++
			} );

			return moduleLoader.start().then( () => {
				return Promise.all( [ moduleLoader.stop(), moduleLoader.stop() ] );
			} ).then( () => {
				expect( x ).to.be.eql( 1 );
			} );

		} );

		it( 'should be idempotent', function() {

			let x = 0;
			moduleLoader.register( {
				name: 'a',
				dependencies: [],
				stop: () => x++
			} );

			return moduleLoader.start().then( () => {
				expect( moduleLoader.stop() ).to.be.eql( moduleLoader.stop() );
				return moduleLoader.stop().then( () => expect( x ).to.be.eql( 1 ) );
			} );

		} );

		it( 'should not stop unstarted modules', function() {

			moduleLoader.register( 'a', '' );
			moduleLoader.register( {
				name: 'b',
				dependencies: 'a',
				start: () => Bluebird.delay( 1500 )
			} );
			moduleLoader.register( {
				name: 'c',
				dependencies: 'b',
				stop: () => {
					return Bluebird.reject( new Error( 'Module c should not have been stopped, since it has not even started' ) );
				}
			} );

			let startPromise = moduleLoader.start();
			let stopPromise = moduleLoader.stop();

			return Bluebird.all( [ startPromise.reflect(), stopPromise.reflect() ] ).spread( ( startIntrospection, stopIntrospection ) => {
				expect( stopIntrospection.isFulfilled(), 'Should complete shutdown procedure ignoring unstarted modules' ).to.be.true;
			} );

		} );

		it( 'should pass the resolved module and their dependencies as arguments', function() {

			let a = { value: 1 };
			let b = { value: 2 };

			moduleLoader.register( 'a', [], () => a, ( a1 ) => {
				expect( a1 ).to.be.eql( a );
			} );
			moduleLoader.register( 'b', [ 'a' ], () => b, ( b1, a1 ) => {
				expect( a1 ).to.be.eql( a );
				expect( b1 ).to.be.eql( b );
			} );

			return moduleLoader.start().then( () => moduleLoader.stop() );

		} );

		it( 'should support array syntax ', function() {
			let counter = 3, delayedCount = () => Bluebird.delay( 10 ).then( () => counter-- );
			moduleLoader.register( { name: 'a', dependencies: [], stop: () => { expect( counter ).to.be.eql( 1 ); return delayedCount(); } } );
			moduleLoader.register( { name: 'b', dependencies: [ 'a' ], stop: () => { expect( counter ).to.be.eql( 2 ); return delayedCount(); } } );
			moduleLoader.register( [ 'b', () => { return 1; }, () => { expect( counter ).to.be.eql( 3 ); return delayedCount(); } ] );
			return moduleLoader.start().then( () => moduleLoader.stop() );
		} );

		it( 'should support object syntax ', function() {

			class Test_A {
				constructor() { this.test = 1; }
			}
			let a = new Test_A();

			class Test_B {
				start( dep1 ) {
					expect( dep1 ).to.be.instanceof( Test_A );
					return this;
				}
				stop( me, dep1 ) {
					expect( me ).to.be.eql( b );
					expect( dep1 ).to.be.instanceof( Test_A );
					return this;
				}
			}
			let b = new Test_B();

			moduleLoader.register( 'a', a );
			moduleLoader.register( 'b', [ 'a' ], b );

			let p = moduleLoader.start().then( () => moduleLoader.stop() );
			return expect( p ).to.eventually.be.fulfilled;
		} );

	} );

	describe( '#list', function() {

		it( 'should list all registered modules', function() {
			moduleLoader.register( { name: 'a', dependencies: [] } );
			moduleLoader.register( { name: 'b', dependencies: [] } );
			expect( moduleLoader.list() ).to.be.eql( [ 'a', 'b' ] );
		} );

	} );

	describe( '#registerFile', function() {

		let path = require( 'path' );
		let regFile = filename => moduleLoader.registerFile( path.join( __dirname, 'files', filename ) );

		it( 'should allow registering external files that define a module that returns an object constructor', function() {
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'a.js' ) ) ).to.not.throw( Error );
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'a2.js' ) ) ).to.not.throw( Error );
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'b.js' ) ) ).to.not.throw( Error );
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'c' ) ) ).to.not.throw( Error );
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'd' ) ) ).to.not.throw( Error );
		} );

		it( 'should allow registering external files that define a module that returns an object value', function() {
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'object.js' ) ) ).to.not.throw( Error );
		} );

		it( 'should not allow registering external files that do not define a module', function() {
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'err.js' ) ) ).to.throw( Error );
		} );

		it( 'should not allow registering non-existing external files', function() {
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'missing.js' ) ) ).to.throw( Error );
		} );

		it( 'should register dependencies for injection', function() {
			[ 'a', 'a2', 'b', 'c', 'd', 'object' ].forEach( regFile );
			return moduleLoader.start().then( () =>
				Promise.all( [
					expect( moduleLoader.resolve( 'a' ) ).to.eventually.have.property( 'ok', 1 ),
					expect( moduleLoader.resolve( 'b' ) ).to.eventually.have.property( 'ok', 2 ),
					expect( moduleLoader.resolve( 'c' ) ).to.eventually.have.property( 'ok', 3 ),
					expect( moduleLoader.resolve( 'd' ) ).to.eventually.have.property( 'ok', 4 ),
					expect( moduleLoader.resolve( 'a2' ) ).to.eventually.have.property( 'ok', 5 ),
					expect( moduleLoader.resolve( 'object' ) ).to.eventually.have.property( 'ok', 6 )
				] )
			);
		} );

		it( 'should register dependencies with camel-case naming', function() {
			[ 'a', 'ClassName', 'long-name' ].forEach( regFile );
			return moduleLoader.start().then( () =>
				Promise.all( [
					expect( moduleLoader.resolve( 'a' ) ).to.not.be.eventually.undefined,
					expect( moduleLoader.resolve( 'className' ) ).to.not.be.eventually.undefined,
					expect( moduleLoader.resolve( 'longName' ) ).to.not.be.eventually.undefined,
					expect( moduleLoader.resolve( 'ClassName' ) ).to.be.eventually.undefined,
					expect( moduleLoader.resolve( 'long-name' ) ).to.be.eventually.undefined
				] )
			);
		} );

	} );

	describe( '#registerDirectory', function() {

		let testDirectory;

		beforeEach( () => {
			const path = require( 'path' );
			testDirectory = path.join( __dirname, 'files', 'dir' );
			moduleLoader.register( { name: 'a', dependencies: [] } );
		} );

		it( 'should register all modules in a folder', function() {
			moduleLoader.registerDirectory( testDirectory );
			return moduleLoader.start().then( () =>
				Promise.all( [
					expect( moduleLoader.resolve( 'a' ) ).to.not.be.eventually.undefined,
					expect( moduleLoader.resolve( 'database' ) ).to.not.be.eventually.undefined,
					expect( moduleLoader.resolve( 'webServer' ) ).to.not.be.eventually.undefined,
					expect( moduleLoader.resolve( 'logger' ) ).to.be.eventually.undefined
				] )
			);
		} ).slow( 200 );

		it( 'should register all modules in a folder and its subfolders, if asked', function() {
			moduleLoader.registerDirectory( testDirectory, true );
			return moduleLoader.start().then( () =>
				Promise.all( [
					expect( moduleLoader.resolve( 'a' ) ).to.not.be.eventually.undefined,
					expect( moduleLoader.resolve( 'database' ) ).to.not.be.eventually.undefined,
					expect( moduleLoader.resolve( 'webServer' ) ).to.not.be.eventually.undefined,
					expect( moduleLoader.resolve( 'logger' ) ).to.not.be.eventually.undefined
				] )
			);
		} ).slow( 200 );

	} );

	describe( '#registerValue', function() {

		it( 'should eventually resolve the registered value', function() {
			moduleLoader.registerValue( 'a', 1 );
			moduleLoader.registerValue( 'b', 'b' );
			moduleLoader.registerValue( 'c', [ 1, 2 ] );
			moduleLoader.registerValue( 'd', { d: 1 } );
			return moduleLoader.start().then( () =>
				Promise.all( [
					expect( moduleLoader.resolve( 'a' ) ).to.be.eventually.deep.equal( 1 ),
					expect( moduleLoader.resolve( 'b' ) ).to.be.eventually.deep.equal( 'b' ),
					expect( moduleLoader.resolve( 'c' ) ).to.be.eventually.deep.equal( [ 1, 2 ] ),
					expect( moduleLoader.resolve( 'd' ) ).to.be.eventually.deep.equal( { d: 1 } )
				] )
			);
		} );

		it( 'should not allow null or undefined values', function() {
			expect( () => moduleLoader.registerValue( 'e', null ) ).to.throw( Error );
			expect( () => moduleLoader.registerValue( 'e', undefined ) ).to.throw( Error );
		} );

		it( 'should not allow values with null or undefined names', function() {
			expect( () => moduleLoader.registerValue( null, 1 ) ).to.throw( Error );
			expect( () => moduleLoader.registerValue( undefined, 1 ) ).to.throw( Error );
			expect( () => moduleLoader.registerValue( null, 1 ) ).to.throw( Error );
			expect( () => moduleLoader.registerValue( {}, 1 ) ).to.throw( Error );
			expect( () => moduleLoader.registerValue( '', 1 ) ).to.throw( Error );
			expect( () => moduleLoader.registerValue( 2, 1 ) ).to.throw( Error );
		} );

	} );

	describe.skip( '#registerClass', function() {

		it( 'should allow registering a class', function() {
			class Test1 {}
			expect( () => moduleLoader.registerClass( Test1 ) ).to.not.throw();
		} );

		it( 'should allow registering a function', function() {
			function Test1() {}
			expect( () => moduleLoader.registerClass( Test1 ) ).to.not.throw();
		} );

		it( 'should allow registering an async function', function() {
			async function Test1() {}
			expect( () => moduleLoader.registerClass( Test1 ) ).to.not.throw();
		} );
		
		it( 'should not allow registering null or undefined objects', function() {
			expect( () => moduleLoader.registerClass( null ) ).to.throw( Error );
			expect( () => moduleLoader.registerClass( undefined ) ).to.throw( Error );
		} );
		
		it( 'should not allow registering not-instantiable objects', function() {
			expect( () => moduleLoader.registerClass( 1 ) ).to.throw( Error );
			expect( () => moduleLoader.registerClass( "" ) ).to.throw( Error );
			expect( () => moduleLoader.registerClass( "abc" ) ).to.throw( Error );
			expect( () => moduleLoader.registerClass( [] ) ).to.throw( Error );
			expect( () => moduleLoader.registerClass( [ 1 ] ) ).to.throw( Error );
		} );
		
		it( 'should consider the camelCase version of a class name as the module name', function() {
			class Test {}
			class Test1 {}
			class TestAction {}
			let t = class TestNamed {};
			expect( moduleLoader.registerClass( Test ).name ).to.be.eql( 'test' );
			expect( moduleLoader.registerClass( Test1 ).name ).to.be.eql( 'test1' );
			expect( moduleLoader.registerClass( TestAction ).name ).to.be.eql( 'testAction' );
			expect( moduleLoader.registerClass( t ).name ).to.be.eql( 'testNamed' );
		});

		it( 'should consider the camelCase version of a function name as the module name', function() {
			function Test() {}
			let func = function Test1() { };
			function TestAction() {}
			expect( moduleLoader.registerClass( Test ).name ).to.be.eql( 'test' );
			expect( moduleLoader.registerClass( func ).name ).to.be.eql( 'test1' );
			expect( moduleLoader.registerClass( TestAction ).name ).to.be.eql( 'testAction' );
		});

		it( 'should consider an anonymous function as an anonymous module', function() {
			let f1 = function() { };
			let f2 = () => {};
			let f3 = async x => {};
			expect( moduleLoader.registerClass( f1 ).anonymous ).to.be.eql( true );
			expect( moduleLoader.registerClass( f2 ).anonymous ).to.be.eql( true );
			expect( moduleLoader.registerClass( f3 ).anonymous ).to.be.eql( true );
		});

		it( 'should consider an anonymous class as an anonymous module', function() {
			let c1 = class {};
			expect( moduleLoader.registerClass( c1 ).anonymous ).to.be.eql( true );
		});

		it( 'should consider a class with an empty constructor as a no-dependency module', function() {
			class Test1 {}
			class Test2 { constructor() { } }
			expect( moduleLoader.registerClass( Test1 ).dependencies ).to.be.eql( [] );
			expect( moduleLoader.registerClass( Test2 ).dependencies ).to.be.eql( [] );
		}  );
		
		it( 'should consider a function with a no arguments as a no-dependency module', function() {
			function Test1() { }
			let func = function Test2() { };
			let f3 = () => {};
			expect( moduleLoader.registerClass( Test1 ).dependencies ).to.be.eql( [] );
			expect( moduleLoader.registerClass( func ).dependencies ).to.be.eql( [] );
			expect( moduleLoader.registerClass( f3 ).dependencies ).to.be.eql( [] );
		} );
		
		it( 'should automatically understand a class dependencies from the constructor arguments', function() {
			class Test1 { constructor( a ) { } }
			class Test2 { constructor( test1, b ) { } }
			expect( moduleLoader.registerClass( Test1 ).dependencies ).to.be.eql( [ 'a' ] );
			expect( moduleLoader.registerClass( Test2 ).dependencies ).to.be.eql( [ 'test1', 'b' ] );
		} );
		
		it( 'should automatically understand a function dependencies from the function arguments', async function() {
			function Test1( a ) { }
			let func = function Test2( test1, b ) { };
			let f3 = ( a, b, c ) => { };
			expect( moduleLoader.registerClass( Test1 ).dependencies ).to.be.eql( [ 'a' ] );
			expect( moduleLoader.registerClass( func ).dependencies ).to.be.eql( [ 'test1', 'b' ] );
			expect( moduleLoader.registerClass( f3 ).dependencies ).to.be.eql( [ 'a', 'b', 'c' ] );
		} );
		
		it( 'should use the explicitly defined class dependencies when available instead of guessing them', function() {
			class Test1 { constructor() { } static get dependencies() { return [ 'a' ]; } }
			class Test2 { constructor() { } }
			Test2.dependencies = [ 'a' ];
			class Test3 { constructor( b ) { } }
			Test3.dependencies = 'a';
			expect( moduleLoader.registerClass( Test1 ).dependencies ).to.be.eql( [ 'a' ] );
			expect( moduleLoader.registerClass( Test2 ).dependencies ).to.be.eql( [ 'a' ] );
			expect( moduleLoader.registerClass( Test3 ).dependencies ).to.be.eql( [ 'a' ] );
		} );

		it( 'should use the explicitly defined function dependencies when available instead of guessing them', function() {
			function Test1() { }
			Test1.dependencies = [ 'a' ];
			let func = () => {};
			func.dependencies = [ 'a' ];
			expect( moduleLoader.registerClass( Test1 ).dependencies ).to.be.eql( [ 'a' ] );
			expect( moduleLoader.registerClass( func ).dependencies ).to.be.eql( [ 'a' ] );
		} );

		it( 'should not allow explicitly defined invalid dependencies', function() {
			class Test1 { constructor() { } static get dependencies() { return [ 1 ]; } }
			class Test2 { constructor() { } static get dependencies() { return {}; } }
			class Test3 { constructor() { } static get dependencies() { return () => {}; } }
			class Test4 { constructor() { } static get dependencies() { return 1; } }
			function Test5() {}
			Test5.dependencies = [ 1 ];
			expect( () => moduleLoader.registerClass( Test1 ) ).to.throw( Error );
			expect( () => moduleLoader.registerClass( Test2 ) ).to.throw( Error );
			expect( () => moduleLoader.registerClass( Test3 ) ).to.throw( Error );
			expect( () => moduleLoader.registerClass( Test4 ) ).to.throw( Error );
			expect( () => moduleLoader.registerClass( Test5 ) ).to.throw( Error );
		} );

		it( 'should eventually return an instance of the class when starting', async function() {
			class Test1 {};
			moduleLoader.registerClass( Test1 );
			return expect( moduleLoader.start() ).to.eventually.be.fulfilled.then( _ => expect( moduleLoader.resolve( 'test1' ) ).to.be.instanceOf( Test1 ) );
		} );

		it( 'should eventually return an instance of a function when starting', async function() {
			function Test1() { return this; }
			moduleLoader.registerClass( Test1 );
			return expect( moduleLoader.start() ).to.eventually.be.fulfilled.then( _ => expect( moduleLoader.resolve( 'test1' ) ).to.be.instanceOf( Test1 ) );
		} );

		it( 'should eventually return an instance of an async function when starting', async function() {
			async function Test1() { 
				await Bluebird.delay( 50 );
				return this;
			};
			moduleLoader.registerClass( Test1 );
			return expect( moduleLoader.start() ).to.eventually.be.fulfilled.then( _ => expect( moduleLoader.resolve( 'test1' ) ).to.be.instanceOf( Test1 ) );
		} );
		
		it( 'should eventually reject a function that returns something other than an instance of that function', function() {
			function Test1() { return 1; }
			moduleLoader.registerClass( Test1 );
			return expect( moduleLoader.start() ).to.eventually.be.rejected;
		} );
		
		it( 'should eventually invoke the start method if present', async function() {
			let startedA = false, startedB = false;
			class TestA {
				start() {
					startedA = true;
				}
			}
			function TestB() { 
				this.start = () => startedB = true;
				return this;
			}
			moduleLoader.registerClass( TestA );
			moduleLoader.registerClass( TestB );
			return expect( moduleLoader.start() ).to.eventually.be.fulfilled.then( _ => {
				expect( startedA ).to.be.true;
				expect( startedB ).to.be.true;
			} );
		} );
		
		it( 'should eventually invoke the stop method if present', async function() {
			let stoppedA = false, stoppedB = false;
			class TestA {
				stop() {
					stoppedA = true;
				}
			}
			function TestB() {
				this.stop = () => stoppedB = true;
				return this;
			}
			moduleLoader.registerClass( TestA );
			moduleLoader.registerClass( TestB );
			return expect( moduleLoader.start().delay( 50 ).then( () => moduleLoader.stop() ) ).to.eventually.be.fulfilled.then( _ => {
				expect( stoppedA ).to.be.true;
				expect( stoppedB ).to.be.true;
			} );
		} );

		it( 'should eventually ignore the start and stop field of a class', function() {
			class TestA {
				constructor() {
					this.stop = 2;
					return this;
				}
				get start() {
					return 1;
				}
			}
			function TestB() {
				this.start = 2;
				return this;
			}
			TestB.prototype.stop = 1;
			moduleLoader.registerClass( TestA );
			moduleLoader.registerClass( TestB );
			return expect( moduleLoader.start() ).to.eventually.be.fulfilled;
		} );

	} );

} );