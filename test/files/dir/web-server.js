
module.exports = function( database ) {
	this.database = database;
	this.serve = () => true;
	return this;
};