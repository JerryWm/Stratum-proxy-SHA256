


function _filterThrowError(error_text, options) {
	options = options || {};
	
	if ( options.error_template ) {
		error_text = options.error_template.replace(/\{\{error\}\}/g, error_text);
	}
	
	throw new Error(error_text);
}

function filterString(x, options) {
	options = options || {};
	
	let type = typeof x;
	
	if ( type !== "string" ) {
		throw _filterThrowError(`A string was expected, got ${type}`, options);
	}
	
	let length = x.length;
	
	if ( "length" in options ) {
		if ( length !== options.length ) {
			throw _filterThrowError(`A string length of ${options.length} was expected, got length ${length}`, options);
		}
	}
	
	if ( "min_length" in options ) {
		if ( length < options.min_length ) {
			throw _filterThrowError(`A string minimum length of ${options.min_length} was expected, got length ${length}`, options);
		}
	}
	
	if ( "max_length" in options ) {
		if ( length > options.max_length ) {
			throw _filterThrowError(`A string maximum length of ${options.max_length} was expected, got length ${length}`, options);
		}
	}
}
function filterStringHex(x, options) {
	options = Object.assign({}, options);

	if ( "length" in options ) {options.length *= 2;}
	if ( "min_length" in options ) {options.min_length *= 2;}
	if ( "max_length" in options ) {options.max_length *= 2;}

	filterString(x, options);
	
	if ( x.match(/[^0-9a-fA-F]/) ) {
		throw _filterThrowError(`Invalid content for a hex string`, options);
	}
	
	if ( x.length & 1 ) {
		throw _filterThrowError(`Invalid length`, options);
	}
}
function filterNumber(x, options) {
	options = options || {};
	
	let type = typeof x;
	
	if ( type !== "number" ) {
		throw _filterThrowError(`A number was expected, got ${type}`, options);
	}
	
	if ( !Number.isFinite(x) ) {
		throw _filterThrowError(`The number is not finite`, options);
	}
	
	if ( "min" in options ) {
		if ( x < options.min ) {
			throw _filterThrowError(`The minimum number is ${options.min}, got ${x}`, options);
		}
	}
	
	if ( "max" in options ) {
		if ( x > options.max ) {
			throw _filterThrowError(`The maximum number is ${options.max}, got ${x}`, options);
		}
	}
}
function filterNumberFloat(x, options) {
	options = options || {};
	
	filterNumber(x, options);
}
function filterNumberInt(x, options) {
	options = options || {};
	
	filterNumber(x, options);

	
}

function filterArray(x, obj) {
	obj = obj || {};
	
	let type = typeof x;
	
	if ( type !== "object" || !(x instanceof Array) ) {
		throw _filterThrowError(`A array was expected, got ${type}`, obj);
	}
	
	if ( obj.items instanceof Array ) {
		if ( obj.items.length !== x.length ) {
			throw _filterThrowError(`A array length of ${obj.items.length}, got length ${x.length}`, obj);
		}
		
		for(let i = 0; i < obj.items.length; i++) {
			filter(x[i], obj.items[i]);
		}
		
		return;
	}
	
	if ( obj.item_type ) {
		for(let i = 0; i < x.length; i++) {
			filter(x[i], obj.item_type);
		}
		
		return;
	}
}
function filter(val, obj) {
	switch(obj.type) {
		
		case "string":
			filterString(val, obj);
			break;
			
		case "hex":
			filterStringHex(val, obj);
			break;
		
		case "number":
			filterNumber(val, obj);
			break;
		
		case "number_float":
			filterNumberFloat(val, obj);
			break;
		
		case "array":
			filterArray(val, obj);
			break;
			
		case "any":
			break;
		
		default:
			throw _filterThrowError(`Unknown type ${obj.type}`, obj);
			
	}
}

module.exports = {
	filter: filter,
};

