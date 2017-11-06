
function d( c ) {
	this.ok = c.ok + 1;
	this.toString = () => "I'm the D module";
	return this;
}

module.exports = d;