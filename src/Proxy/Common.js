
const crypto = require('crypto');


class Common {
}
Common.revers2b = function(s) {
	let _s = "";
	for(let i = 0; i < s.length; i+=2) {
		_s = s.substr(i, 2) + _s;
	}
	return _s;
}
Common.parseIntByHex = function(hex) {
	return parseInt(Common.revers2b(hex), 16)|0;
}
Common.hexToUint32 = function(h) {
	return parseInt(Common.revers2b(h), 16)|0;	
}
Common.uint32ToHex = function(n) {
	let b0 = ((n >> (8*0)) & 0xFF).toString(16)
	let b1 = ((n >> (8*1)) & 0xFF).toString(16)
	let b2 = ((n >> (8*2)) & 0xFF).toString(16)
	let b3 = ((n >> (8*3)) & 0xFF).toString(16)
	
	if ( b0.length == 1 ) { b0 = "0"+b0; }
	if ( b1.length == 1 ) { b1 = "0"+b1; }
	if ( b2.length == 1 ) { b2 = "0"+b2; }
	if ( b3.length == 1 ) { b3 = "0"+b3; }
	
	return b0 + b1 + b2 + b3;
}
Common.strToHashSimplie = function(s) {
	let r = "";
	for(let i = 0; i < s.length; i++) {
		r += "_" + s.charCodeAt(i).toString(16);
	}
	return r;
}
Common.addressEx = function(address) {
	let m;
	if ( typeof address !== 'string' || !(m = address.match(/([^\\/]*?)\s*\:\s*(\d+)/)) ) {
		return null;
	}

	return [m[1], m[2]];
}
Common.randHex = function(len) {
	let s = "";
	while(len--)
		s += Math.random().toString(16).substr(4, 2);
	return s;
}
Common.getId = function(key) {
	var id_list = Object.create(null);
	
	Common.getId = function(key) {
		if ( id_list[key] === undefined ) {
			id_list[key] = 1;
		}
		
		return id_list[key]++;
	}
	
	return Common.getId(key);
}
Common.getGlobalUniqueId = function() {
	var id = 1;
	
	Common.getGlobalUniqueId = function() {
		return id++;
	}
	
	return Common.getGlobalUniqueId();
}
Common.objToArray = function(obj) {
	let arr = [];
	for(let i in obj) {
		arr.push(obj[i]);
	}
	return arr;
}
Common.setInterval = (key, timeout, cb) => {
	var kv_data = Object.create(null);

	Common.setInterval = (key, timeout, cb) => {
		timeout = parseInt(timeout);

		if ( kv_data[key] ) {
			kv_data[key].timeout = timeout;
			kv_data[key].cb = cb;
			return true;
		}
		
		kv_data[key] = {
			timeout: timeout,
			cb: cb
		};

		function tmi() {
			let data = kv_data[key];
			
			if ( !data.cb || isNaN(data.timeout) || !data.timeout ) {
				delete kv_data[key];
				return;
			}
			
			kv_data[key].cb();
			
			setTimeout(tmi, data.timeout);
		}
		tmi();
		
		return true;
	};
	
	Common.setInterval(key, timeout, cb);
}
Common.currTimeMiliSec = () => {
	return (new Date()).getTime();
}
Common.currTimeSec = () => {
	return (new Date()).getTime() * 1e-3;
}
Common.timeDeltaMiliSec = () => {
	var timeStart = Common.currTimeMiliSec();
	return () => {
		return Common.currTimeMiliSec() - timeStart;
	};
}
Common.extNonceJobBlob = (blob) => {
	return blob.substr(39*2, 8);
}

Common.parseIntegerFilter = (n, options) => {
	if ( n === null || n === undefined || isNaN(Number(n)) ) {
		n = options.def;
	} else {
		n = parseInt( Math.round(n) );
		
		if ( String(n) !== String(n|0) ) {
			n = options.def;
		}
	}

	n |= 0;

	if ( options.min === undefined ) { return n; }
	n = Math.max(n, options.min);
	
	if ( options.max === undefined ) { return n; }
	n = Math.min(n, options.max);
	
	return n;
}
Common.parseInteger = (n, def, min, max) => {
	return Common.parseIntegerFilter(n, {
		def: def,
		min: min,
		max: max,
	});
}

Common.checkHex = function(hex, min_len, max_len) {
	if ( !Common.checkString(hex, min_len, max_len) ) { return false; }
	if ( hex.length & 1 ) { return false; }
	if ( hex.match(/[^0-9a-fA-F]/) ) { return false; }
	
	return true;
}
Common.checkString = function(str, min_len, max_len) {
	if ( typeof str !== "string" ) { return false; }
	if ( min_len !== undefined && str.length < min_len * 2 ) { return false; }
	if ( max_len !== undefined && str.length > max_len * 2 ) { return false; }
	
	return true;
}
Common.checkArray = function(arr, index) {
	if ( !( arr instanceof Array ) ) { return false; }
	if ( index !== undefined && index >= arr.length ) { return false; }
	
	return true;
}

Common.sha256d = (data) => {
	return crypto.createHash('sha256').update(
		crypto.createHash('sha256').update(data).digest()
	).digest();
}

Common.randomValueOfArray = (array) => {
	if ( !array.length ) {
		return null;
	}
	
	return array[ Math.max(0, Math.min(array.length - 1, Math.round(Math.random() * array.length)))];
}

Common.parseArgv = () => {
	let map = Object.create(null);
	
	for(let i = 0; i < process.argv.length; i++) {
		let arg = process.argv[i];
		if ( arg.length && arg[0] === "-" ) {
			map[arg.substr(1)] = process.argv[i+1];
			i++;
		}
	}
	
	return map;
}

	function doubleFixedStringRemoveLastZeros(s) {
		return String(s).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
	}
	function intOrNA(n) {
		if ( n === null || n === undefined ) {
			return "n/a";
		}
		
		return Math.round(n);
	}
	function doubleOrNA(n, fx) {
		if ( n === null || n === undefined ) {
			return "n/a";
		}
		
		fx = fx || 2;
		
		return doubleFixedStringRemoveLastZeros((n).toFixed(fx));
	}
	
	var kStyleMap = [
		"k",
		"m",
		"g",
		"t"
	];
	
	function doubleOrNA_kStyle(n, fx) {
		var s = doubleOrNA(n);
		if ( s === "n/a" ) {
			return s;
		}
		
		s = Number(s);
		var k = 0;
		while(s > 1e3) {
			s /= 1e3;
			k++;
			if ( k >= kStyleMap.length ) {
				break;
			}
		}
		k--;
		
		fx = fx || 1;
		s = doubleFixedStringRemoveLastZeros(s.toFixed(fx));
		if ( k >= 0 ) {
			s += kStyleMap[k];
		}
		
		return s;
	}

	function currTimeMiliSec() {
		return +(new Date());
	}
	function currTimeSec() {
		return currTimeMiliSec() * 1e-3;
	}
	
	
	function stringNormalizeLen(s, maxLen) {
		s = String(s);
		
		if ( s.length <= maxLen ) {
			return s;
		}
		
		return s.slice(0, (maxLen>>1)) + "..." + s.slice(-(maxLen>>1));
	}
	function deltaSecToString(sec) {
		sec = Math.round(sec);
		
		var s = "";
		
		var _h = Math.floor(sec/3600); sec %= 3600;
		var _m = Math.floor(sec/60);   sec %= 60;
		var _s = sec;
	
		if ( _h !== 0 ) s += _h + "h ";
		if ( _m !== 0 ) s += _m + "m ";
		                s += _s + "s ";
		
		return s;
	}
	function deltaMiliSecToString(sec) {
		return deltaSecToString(sec*1e-3);
	}
	
	function miliSecToString(msec) {
		var d = new Date(msec);
		return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
	}
	function hrp(hr) {
		return (hr === null || hr === undefined) ?
			"n/a" : parseFloat(hr).toFixed(2);
	}	
	
	function tabSpace(s, t_len) {
		s = String(s);
		if ( s.length < t_len ) {
			s = " ".repeat(t_len - s.length) + s;
		}
		return s;
	}
	
Common.intOrNA = intOrNA;
Common.doubleOrNA = doubleOrNA;
Common.stringNormalizeLen = stringNormalizeLen;
Common.deltaSecToString = deltaSecToString;
Common.deltaMiliSecToString = deltaMiliSecToString;
Common.miliSecToString = miliSecToString;
Common.hrp = hrp;
Common.doubleOrNA_kStyle = doubleOrNA_kStyle;
Common.tabSpace = tabSpace;
	

module.exports = Common;