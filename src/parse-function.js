
const a = 1 // eslint-disable-line no-unused-vars
	, acorn = require( 'acorn' )
	, assert = require( 'assert' ).strict
	;

const ensureDefined = function( value, message ) {
	if ( value === null || value === undefined )
		throw new Error( message ? message : 'Value expected, got ' + value );
	return value;
};

class ResultBuilder {

	constructor( expr ) {
		this._expr = expr;
		this._name = null;
		this._args = null;
		this._async = null;
	}

	/**
	 * @param {string} value
	 */
	name( value ) {
		this._name = value;
		return this;
	}

	/**
	 * @param {string[]} value
	 */
	args( value ) {
		this._args = value;
		return this;
	}

	/**
	 * @param {boolean} value
	 */
	async( value ) {
		this._async = value;
		return this;
	}

	build() {
		let undefineds = [ 'name', 'args', 'async' ].map( property => {
			let internalName = '_' + property;
			let value = this[ internalName ];
			if ( value === undefined )
				return property;
			return false;
		} ).filter( Boolean );
		if ( undefineds.length )
			throw new Error( 'Cannot build result for ' + this._expr + ', the following properties have not been defined: ' + undefineds.join( ', ' ) );
		return new Result( this._name, this._args );
	}

}

class Result {
	
	constructor( name, args ) {
		this._name = name;
		this._args = ensureDefined( args );
	}

	get name() {
		return this._name;
	}

	get args() {
		return this._args;
	}

}

class State {

	constructor( stateName, exploreFn, transitions ) {
		assert.equal( typeof stateName, 'string' );
		assert.equal( typeof exploreFn, 'function' );

		this._name = stateName;
		this._exploreFn = exploreFn;
		this._transitions = Object.assign( {}, transitions );
	}

	get name() {
		return this._name;
	}

	explore( node, resultBuilder ) {
		let newState = this._transitions[ node.type ];
		assert( newState, 'No transition found from ' + this.name + ' for node ' + node.type );
		return newState.beExplored( this, node, resultBuilder );
	}

	/**
	 * private function
	 * @param {State} parentState 
	 * @param {*} node 
	 * @param {*} resultBuilder 
	 */
	beExplored( parentState, node, resultBuilder ) {
		this._exploreFn( this, node, resultBuilder );
	}

}

let ProgramArrowFunctionExpressionState = new State( 'ProgramArrowFunctionExpressionState', ( self, node, resultBuilder ) => {
	resultBuilder
		.name( null )
		.args( node.params.map( p => p.name ) )
		.async( node.async );
} );

let ProgramFunctionDeclarationState = new State( 'ProgramFunctionDeclarationState', ( self, node, resultBuilder ) => {
	resultBuilder
		.name( node.id ? node.id.name : null )
		.args( node.params.map( p => p.name ) )
		.async( node.async );
} );

let ProgramClassDeclarationState = new State( 'ProgramClassDeclarationState', ( self, node, resultBuilder ) => {
	assert( node.body );
	resultBuilder
		.name( node.id ? node.id.name : null )
		.async( false );
	return self.explore( node.body );
} );

let ProgramExpressionState = new State( 'ProgramExpressionState', ( self, node, resultBuilder ) => {
	assert( node.expression );
	return self.explore( node.expression, resultBuilder );
}, {
	ArrowFunctionExpression: ProgramArrowFunctionExpressionState
} );

let ProgramState = new State( 'ProgramState', ( self, node, resultBuilder ) => {
	assert( node.body );
	assert.equal( node.body.length, 1 );
	return self.explore( node.body[ 0 ], resultBuilder );
}, {
	ExpressionStatement: ProgramExpressionState,
	FunctionDeclaration: ProgramFunctionDeclarationState,
	ClassDeclaration: ProgramClassDeclarationState
} );

let InitialState = new State( 'InitialState', ( self, node, resultBuilder ) => {
	return self.explore( node, resultBuilder );
}, {
	Program: ProgramState
} );

module.exports = function parseFunction( fn ) {

	if ( fn === null || fn === undefined )
		throw new Error( 'Cannot parse null or undefined function' );
	if ( typeof fn !== 'function' )
		throw new Error( 'Cannot parse a non-function' );

	let parseTree = acorn.parse( fn );
	let resultBuilder = new ResultBuilder( fn.toString() );
	InitialState.explore( parseTree, resultBuilder );

	return resultBuilder.build();

};