
const a = 1 // eslint-disable-line no-unused-vars
	, acorn = require( 'acorn' )
	, assert = require( 'assert' ).strict
	;

const ensureDefined = function( value, key ) {
	if ( value === null || value === undefined )
		throw new Error( `${key} expected, got ${value}` );
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
		return new Result( this._name, this._async, this._args );
	}

}

class Result {

	constructor( name, async, args ) {
		this._name = name;
		this._async = async;
		this._args = ensureDefined( args, 'args' );
	}

	get name() {
		return this._name;
	}

	get args() {
		return this._args;
	}

	get async() {
		return this._async;
	}

	get anonymous() {
		return this._name === null;
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

	explore( node ) {
		let newState = this._transitions[ node.type ];
		assert( newState, 'No transition found from ' + this.name + ' for node ' + node.type );
		return newState.beExplored( this, node );
	}

	beExplored( parentState, node ) {
		return this._exploreFn( this, node );
	}

}

let ProgramArrowFunctionExpressionState = new State( 'ProgramArrowFunctionExpressionState', ( self, node ) => {
	return new ResultBuilder()
		.name( null )
		.args( node.params.map( p => p.name ) )
		.async( node.async );
} );

let ProgramFunctionDeclarationState = new State( 'ProgramFunctionDeclarationState', ( self, node ) => {
	return new ResultBuilder()
		.name( node.id ? node.id.name : null )
		.args( node.params.map( p => p.name ) )
		.async( node.async );
} );

let ClassBodyState = new State( 'ClassBodyState', ( self, node ) => {
	assert( node.body );

	let constructor = node.body.find( child => child.type === 'MethodDefinition' && child.kind === 'constructor' );
	let params = constructor ? constructor.value.params : [];

	return new ResultBuilder()
		.args( params.map( p => p.name ) )
		.async( false );
} );

let ProgramClassDeclarationState = new State( 'ProgramClassDeclarationState', ( self, node ) => {
	assert( node.body );
	return self.explore( node.body )
		.name( node.id ? node.id.name : null )
		.async( false );
}, {
	ClassBody: ClassBodyState
} );

let ProgramExpressionState = new State( 'ProgramExpressionState', ( self, node ) => {
	assert( node.expression );
	return self.explore( node.expression );
}, {
	ArrowFunctionExpression: ProgramArrowFunctionExpressionState
} );

let ProgramState = new State( 'ProgramState', ( self, node ) => {
	assert( node.body );
	assert.equal( node.body.length, 1 );
	return self.explore( node.body[ 0 ] );
}, {
	ExpressionStatement: ProgramExpressionState,
	FunctionDeclaration: ProgramFunctionDeclarationState,
	ClassDeclaration: ProgramClassDeclarationState
} );

let InitialState = new State( 'InitialState', ( self, node ) => {
	return self.explore( node );
}, {
	Program: ProgramState
} );

module.exports = function parseFunction( fn ) {

	if ( fn === null || fn === undefined )
		throw new Error( 'Cannot parse null or undefined function' );
	if ( typeof fn !== 'function' )
		throw new Error( 'Cannot parse a non-function' );

	let parseTree = acorn.parse( fn );
	let resultBuilder = InitialState.explore( parseTree );

	return resultBuilder.build();

};