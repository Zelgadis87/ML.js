
export function foo() {
	this.named = 'foo';
	return this;
};

export function bar() {
	this.named = 'bar';
	return this;
};

export default function def() {
	this.isDefault = true;
	return this;
};
