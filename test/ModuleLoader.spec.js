
/* eslint-env mocha */

const chai = require( 'chai' )
	, expect = chai.use( require( 'chai-as-promised' ) ).expect
	, _ = require( 'lodash' )
	, Bluebird = require( 'bluebird' )
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
			expect( () => moduleLoader.register( null ) ).to.throw( Error );
			expect( () => moduleLoader.register( undefined ) ).to.throw( Error );
			expect( () => moduleLoader.register( null ) ).to.throw( Error );
			expect( () => moduleLoader.register( {} ) ).to.throw( Error );
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

		it( 'should not allow a module to change name', function() {
			let module = { name: 'a' };
			moduleLoader.register( module );

			module.name = 'b';
			expect( module.name ).to.be.eql( 'a' );
		} );

		it( 'should allow a module with minimal configuration', function() {
			expect( () => moduleLoader.register( 'a' ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( { name: 'b' } ) ).to.not.throw( Error );
		} );

		it( 'should allow a module with a valid object definition', function() {
			expect( () => moduleLoader.register( { name: 'a', dependencies: [], start: _.noop, stop: _.noop } ) ).to.not.throw( Error );
		} );

		it( 'should allow a module with a valid spread definition', function() {
			expect( () => moduleLoader.register( 'a', [] ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( 'b', [], _.noop ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( 'c', [], _.noop, _.noop ) ).to.not.throw( Error );
		} );

		it( 'should allow a module with a name and an object definition', function() {
			expect( () => moduleLoader.register( 'a', { start: _.noop, stop: _.noop } ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( 'b', { start: _.noop } ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( 'c', { stop: _.noop } ) ).to.not.throw( Error );
		} );

		it( 'should allow a module with a namem, dependencies and an object definition', function() {
			expect( () => moduleLoader.register( 'a', [], { start: _.noop, stop: _.noop } ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( 'b', [ 'a' ], { start: _.noop } ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( 'c', [ 'a' ], { stop: _.noop } ) ).to.not.throw( Error );
		} );

		it( 'should allow a module definition with an empty string as dependency', function() {
			expect( () => moduleLoader.register( { name: 'a', dependencies: '' } ) ).to.not.throw( Error );
		} );

		it( 'should allow a module with a string dependency', function() {
			expect( () => moduleLoader.register( { name: 'a', dependencies: 'b', start: _.noop, stop: _.noop } ) ).to.not.throw( Error );
		} );

		it( 'should allow modules registration out of order', function() {
			expect( () => moduleLoader.register( { name: 'b', dependencies: [], start: _.noop, stop: _.noop } ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( { name: 'a', dependencies: 'b', start: _.noop, stop: _.noop } ) ).to.not.throw( Error );
		} );

		it( 'should throw an error is start or stop are not functions', function() {
			expect( () => moduleLoader.register( { name: 'a', dependencies: [], start: '', stop: _.noop } ) ).to.throw( Error );
			expect( () => moduleLoader.register( { name: 'a', dependencies: [], start: _.noop, stop: '' } ) ).to.throw( Error );
		} );

		it( 'should support registering anonymous modules', function() {
			expect( () => moduleLoader.register( [], _.noop ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( [], _.noop, _.noop ) ).to.not.throw( Error );
		} );

		it( 'should not support array syntax without a start function', function() {
			expect( () => moduleLoader.register( [] ) ).to.throw( Error );
			expect( () => moduleLoader.register( [ 'a', 'b' ] ) ).to.throw( Error );
		} );

		it( 'should support array syntax with only a start function', function() {
			expect( () => moduleLoader.register( [ 'a', 'b', _.noop ] ) ).to.not.throw( Error );
		} );

		it( 'should support array syntax with start and stop functions', function() {
			expect( () => moduleLoader.register( [ 'a', 'b', _.noop, _.noop ] ) ).to.not.throw( Error );
		} );

		it( 'should support array syntax without dependencies', function() {
			expect( () => moduleLoader.register( [ _.noop ] ) ).to.not.throw( Error );
			expect( () => moduleLoader.register( [ _.noop, _.noop ] ) ).to.not.throw( Error );
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
			expect( () => moduleLoader.start() ).to.not.throw();
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

		it( 'should throw an error if a circular dependency is found', function() {

			moduleLoader.register( { name: 'a', dependencies: [] } );
			moduleLoader.register( { name: 'b', dependencies: [ 'c' ] } );
			moduleLoader.register( { name: 'c', dependencies: [ 'a', 'b' ] } );
			expect( () => moduleLoader.start() ).to.throw( Error );

		} );

		// Please note that this test is actually included in the circular dependency one since,
		// without a root module, a circular dependency is mathematically required to happen.
		// The test is only here to cover for the more descriptive error message returned to
		// the user in this particular case.
		it( 'should throw an error if no root modules are found', function() {

			moduleLoader.register( { name: 'a', dependencies: [ 'b' ] } );
			moduleLoader.register( { name: 'b', dependencies: [ 'c' ] } );
			moduleLoader.register( { name: 'c', dependencies: [ 'a' ] } );
			expect( () => moduleLoader.start() ).to.throw( Error );

		} );

		it( 'should throw an error if an unknown dependency is found', function() {

			moduleLoader.register( { name: 'a', dependencies: [] } );
			moduleLoader.register( { name: 'b', dependencies: [ 'c' ] } );
			expect( () => moduleLoader.start() ).to.throw( Error );

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

		it( 'should return a resolved Promise when no modules are registered', function() {
			expect( moduleLoader.start() ).to.be.an.instanceOf( Bluebird );
			return expect( moduleLoader.start() ).to.eventually.be.fulfilled;
		} );

		it( 'should return a resolved Promise when some modules are registered', function() {
			moduleLoader.register( { name: 'a', dependencies: [] } );
			moduleLoader.register( { name: 'b', dependencies: [ 'a' ] } );
			expect( moduleLoader.start() ).to.be.an.instanceOf( Bluebird );
			return expect( moduleLoader.start() ).to.eventually.be.fulfilled;
		} );

		it( 'should return a rejected Promise if a start function does not return a value', function() {
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

		it( 'should throw an error when the loader has not been started', function() {
			return expect( () => moduleLoader.resolve( 'a' ) ).to.throw( Error );
		} );

		it( 'should throw an error if the given argument is not a valid dependency name', function() {
			moduleLoader.start();
			expect( () => moduleLoader.resolve() ).to.throw( Error );
			expect( () => moduleLoader.resolve( 2 ) ).to.throw( Error );
			expect( () => moduleLoader.resolve( [ 2 ] ) ).to.throw( Error );
		} );

		it( 'should return undefined if the given argument is not a registered dependency', function() {
			moduleLoader.register( { name: 'x', dependencies: [] } );
			moduleLoader.start();
			return expect( moduleLoader.resolve( 'y' ) ).to.be.eventually.undefined;
		} );

		it( 'should eventually return the module calculated value', function() {
			moduleLoader.start();
			return expect( moduleLoader.resolve( 'a' ) ).to.be.eventually.eql( 1 );
		} );

		it( 'should eventually return the module promised value', function() {
			moduleLoader.start();
			return expect( moduleLoader.resolve( 'b' ) ).to.be.eventually.eql( 2 );
		} );

		it( 'should eventually return the module chained value', function() {
			moduleLoader.start();
			return expect( moduleLoader.resolve( 'c' ) ).to.be.eventually.eql( 4 );
		} );

		it( 'should allow resolution of multiple modules', function() {
			moduleLoader.start();
			return expect( moduleLoader.resolve( [ 'a', 'b' ] ) ).to.be.eventually.deep.equal( [ 1, 2 ] );
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
			moduleLoader.register( {
				name: 'a',
				dependencies: [],
				start: () => x++,
				stop: () => { expect( x ).to.be.eql( 1 ); x--; }
			} );
			moduleLoader.register( {
				name: 'c',
				dependencies: [ 'a', 'b' ],
				start: () => x++,
				stop: () => { expect( x ).to.be.eql( 3 ); x--; }
			} );
			moduleLoader.register( {
				name: 'b',
				dependencies: [ 'a' ],
				start: () => x++,
				stop: () => { expect( x ).to.be.eql( 2 ); x--; }
			} );

			return moduleLoader.start().then( () => moduleLoader.stop() );

		} );

		it( 'should prevent pending modules from starting up', function() {

			moduleLoader.register( 'a', '' );
			moduleLoader.register( {
				name: 'b',
				dependencies: 'a',
				start: () => Bluebird.delay( 1500 )
			} );
			moduleLoader.register( {
				name: 'c',
				dependencies: 'b',
				start: () => {
					return Bluebird.reject( new Error( 'Module c should not have been started' ) );
				}
			} );

			let startPromise = moduleLoader.start();
			let stopPromise = moduleLoader.stop();

			return Bluebird.all( [ startPromise.reflect(), stopPromise.reflect() ] ).spread( ( startIntrospection, stopIntrospection ) => {
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
				moduleLoader.stop().then( () => expect( x ).to.be.eql( 1 ) );
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
			moduleLoader.register( { name: 'a', dependencies: [], stop: () => { expect( counter ).to.be.eql( 3 ); return delayedCount(); } } );
			moduleLoader.register( { name: 'b', dependencies: [ 'a' ], stop: () => { expect( counter ).to.be.eql( 2 ); return delayedCount(); } } );
			moduleLoader.register( [ 'b', _.noop, () => expect( counter ).to.be.eql( 1 ) ] );
			return moduleLoader.start();
		} );

	} );

	describe( '#registerFile', function() {

		let path = require( 'path' );
		let regFile = filename => moduleLoader.registerFile( path.join( __dirname, 'files', filename ) );

		it( 'should allow registering external files that define a module', function() {
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'a.js' ) ) ).to.not.throw( Error );
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'a2.js' ) ) ).to.not.throw( Error );
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'b.js' ) ) ).to.not.throw( Error );
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'c' ) ) ).to.not.throw( Error );
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'd' ) ) ).to.not.throw( Error );
		} );

		it( 'should not allow registering external files that do not define a module', function() {
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'err.js' ) ) ).to.throw( Error );
		} );

		it( 'should not allow registering not existing external files', function() {
			expect( () => moduleLoader.registerFile( path.join( __dirname, 'files', 'missing.js' ) ) ).to.throw( Error );
		} );

		it( 'should register dependencies for injection', function() {
			[ 'a', 'a2', 'b', 'c', 'd' ].forEach( regFile );
			moduleLoader.start();
			expect( moduleLoader.resolve( 'a' ) ).to.eventually.have.property( 'ok', 1 );
			expect( moduleLoader.resolve( 'b' ) ).to.eventually.have.property( 'ok', 2 );
			expect( moduleLoader.resolve( 'c' ) ).to.eventually.have.property( 'ok', 3 );
			expect( moduleLoader.resolve( 'd' ) ).to.eventually.have.property( 'ok', 4 );
			expect( moduleLoader.resolve( 'a2' ) ).to.eventually.have.property( 'ok', 5 );

		} );

		it( 'should register dependencies with camel-case naming', function() {
			[ 'a', 'ClassName', 'long-name' ].forEach( regFile );
			moduleLoader.start();
			expect( moduleLoader.resolve( 'a' ) ).to.not.be.rejected;
			expect( moduleLoader.resolve( 'className' ) ).to.not.be.rejected;
			expect( moduleLoader.resolve( 'longName' ) ).to.not.be.rejected;
			expect( moduleLoader.resolve( 'ClassName' ) ).to.be.eventually.undefined;
			expect( moduleLoader.resolve( 'long-name' ) ).to.be.eventually.undefined;
		} );

	} );


} );