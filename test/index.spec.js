
/* eslint-env mocha */

const a = 1 // eslint-disable-line no-unused-vars
	, chai = require( 'chai' )
	, expect = chai.expect
	;

describe( 'index', function() {

	const ModuleLoader = require( '../src/ModuleLoader' );

	it( 'should return a new ModuleLoader instance', function() {
		const index = require( '../src/index' );
		return expect( index ).to.be.instanceof( ModuleLoader );
	} );

	it( 'should return the same ModuleLoader instance', function() {
		const index1 = require( '../src/index' );

		index1.$hash = 1;
		delete require.cache[index1];

		const index2 = require( '../src/index' );
		return expect( index1.$hash ).to.be.eql( index2.$hash );
	} );

} );
