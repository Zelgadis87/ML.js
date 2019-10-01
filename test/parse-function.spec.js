
/* eslint-env mocha */

const a = 1 // eslint-disable-line no-unused-vars
	, chai = require( 'chai' )
	, expect = chai.expect
	;

describe.only( 'parseFunction', function() {

	let parseFunction = require( '../src/parse-function' );

	it( 'should not parse null or undefined', function() {
		expect( parseFunction.bind( null, null ) ).to.throw( Error );
		expect( parseFunction.bind( null, undefined ) ).to.throw( Error );
	} );

	it( 'should not parse a non-function', function() {
		expect( parseFunction.bind( null, 1 ) ).to.throw( Error );
		expect( parseFunction.bind( null, 'a' ) ).to.throw( Error );
		expect( parseFunction.bind( null, {} ) ).to.throw( Error );
		expect( parseFunction.bind( null, [] ) ).to.throw( Error );
	} );

	it( 'should parse an anonymous arrow function without arguments', function() {
		let ret = parseFunction( () => { } );
		expect( ret.name ).to.be.null;
		expect( ret.anonymous ).to.be.true;
		expect( ret.async ).to.be.false;
		expect( ret.args ).to.be.empty;
	}  );

	it( 'should parse an anonymous async arrow function without arguments', function() {
		let ret = parseFunction( async() => { } );
		expect( ret.name ).to.be.null;
		expect( ret.anonymous ).to.be.true;
		expect( ret.async ).to.be.true;
		expect( ret.args ).to.be.empty;
	} );

	it( 'should parse a named function without arguments', function() {
		let ret = parseFunction( function asd() { } );
		expect( ret.name ).to.be.eql( "asd" );
		expect( ret.anonymous ).to.be.false;
		expect( ret.async ).to.be.false;
		expect( ret.args ).to.be.empty;
	} );

	it( 'should parse a named async function without arguments', function() {
		let ret = parseFunction( async function asd() { } );
		expect( ret.name ).to.be.eql( 'asd' );
		expect( ret.anonymous ).to.be.false;
		expect( ret.async ).to.be.true;
		expect( ret.args ).to.be.empty;
	} );

	it( 'should parse an anonymous arrow function with one argument', function() {
		let ret = parseFunction( a => { } );
		expect( ret.name ).to.be.null;
		expect( ret.anonymous ).to.be.true;
		expect( ret.async ).to.be.false;
		expect( ret.args ).to.be.eql( [ 'a' ] );
	}  );

	it( 'should parse an anonymous async arrow function with one argument', function() {
		let ret = parseFunction( async a => { } );
		expect( ret.name ).to.be.null;
		expect( ret.anonymous ).to.be.true;
		expect( ret.async ).to.be.true;
		expect( ret.args ).to.be.eql( [ 'a' ] );
	} );

	it( 'should parse a named function with one argument', function() {
		let ret = parseFunction( function asd( a ) { } );
		expect( ret.name ).to.be.eql( "asd" );
		expect( ret.anonymous ).to.be.false;
		expect( ret.async ).to.be.false;
		expect( ret.args ).to.be.eql( [ 'a' ] );
	} );

	it( 'should parse a named async function with one argument', function() {
		let ret = parseFunction( async function asd( a ) { } );
		expect( ret.name ).to.be.eql( 'asd' );
		expect( ret.anonymous ).to.be.false;
		expect( ret.async ).to.be.true;
		expect( ret.args ).to.be.eql( [ 'a' ] );
	} );

	it( 'should parse a class without methods', function() {
		class asd1 { }
		let ret = parseFunction( asd1 );
		expect( ret.name ).to.be.eql( 'asd1' );
		expect( ret.anonymous ).to.be.false;
		expect( ret.async ).to.be.false;
		expect( ret.args ).to.be.empty;
	} );

	it( 'should parse a class without a constructor', function() {
		class asd1 { doSomething( a ) { } }
		let ret = parseFunction( asd1 );
		expect( ret.name ).to.be.eql( 'asd1' );
		expect( ret.anonymous ).to.be.false;
		expect( ret.async ).to.be.false;
		expect( ret.args ).to.be.empty;
	} );

	it( 'should parse a class with a constructor without arguments', function() {
		class asd2 { constructor() { } }
		let ret = parseFunction( asd2 );
		expect( ret.name ).to.be.eql( 'asd2' );
		expect( ret.anonymous ).to.be.false;
		expect( ret.async ).to.be.false;
		expect( ret.args ).to.be.empty;
	} );

	it( 'should parse a class with a constructor with arguments', function() {
		class asd3 { constructor( a, b, c ) { } }
		let ret = parseFunction( asd3 );
		expect( ret.name ).to.be.eql( 'asd3' );
		expect( ret.anonymous ).to.be.false;
		expect( ret.async ).to.be.false;
		expect( ret.args ).to.be.eql( [ 'a', 'b', 'c' ] );
	} );

	it( 'should parse a class with a superclass', function() {
		class sup { }
		class asd4 extends sup { constructor() { super(); } }
		let ret = parseFunction( asd4 );
		expect( ret.name ).to.be.eql( 'asd4' );
		expect( ret.anonymous ).to.be.false;
		expect( ret.async ).to.be.false;
		expect( ret.args ).to.be.empty;
	} );

} );