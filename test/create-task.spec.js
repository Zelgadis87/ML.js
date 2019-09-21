
/* eslint-env mocha */

const a = 1 // eslint-disable-line no-unused-vars
	, Bluebird = require( 'bluebird' )
	, chai = require( 'chai' )
	, expect = chai.use( require( 'chai-as-promised' ) ).expect
	;

describe( 'createTask', function() {

	let createTask = require( '../src/create-task' );

	it( 'should not allow a new task with a non-function argument', function() {
		expect( createTask.bind( null, null ) ).to.throw( Error );
		expect( createTask.bind( null, undefined ) ).to.throw( Error );
		expect( createTask.bind( null, 1 ) ).to.throw( Error );
		expect( createTask.bind( null, "" ) ).to.throw( Error );
		expect( createTask.bind( null, [] ) ).to.throw( Error );
	} );

	it( 'should create a new task when invoked with a function argument', function() {
		expect( createTask.bind( null, () => {} ) ).to.not.throw( Error );
	} );

	it( 'should not allow a double execution', function() {
		let task = createTask( () => {} );
		expect( task.execute.bind( task ) ).to.not.throw( Error );
		expect( task.execute.bind( task ) ).to.throw( Error );
	} );

	it( 'should eventually invoke the original function when requested', async function() {
		let executed = false;
		let task = createTask( () => executed = true );

		expect( executed ).to.be.false;
		await Bluebird.delay( 50 );
		expect( executed ).to.be.false;
		await task.execute();
		expect( executed ).to.be.true;
	} );

	it( 'should eventually execute the function with the given argument', async function() {
		let task = createTask( x => expect( x ).to.be.eql( 1 ) );
		return expect( task.execute( 1 ) ).to.eventually.be.fulfilled;
	} );

	it( 'should eventually execute the task and propagate value as a promise', async function() {
		let p1 = x => { expect( x ).to.be.eql( 1 ); return x + 1; };
		let p2 = x => { expect( x ).to.be.eql( 2 ); return x + 1; };
		let task = createTask( p1 );
		return expect( task.execute( 1 ).then( p2 ) ).to.eventually.be.fulfilled.then( x => expect( x ).to.be.eql( 3 ) );
	} );

	it( 'should eventually be rejected if task fails', async function() {
		let err = new Error(), task = createTask( () => { throw err; } );
		return expect( task.execute() ).to.eventually.be.rejectedWith( err );
	} );

} );