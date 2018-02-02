define(function() {

	function escapeHtml(html) {
		var span;
		if ( !document || 
				!document.createElement ||
					!(span = document.createElement('span')) ||
						!("innerText" in span) ||
							!("innerHTML" in span) ) {
							
			return "{{DOCUMENT ERROR}}";
		}

		escapeHtml = function(html) {
			span.innerText = html;
			return span.innerHTML;
		}
		
		return escapeHtml(html);
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
		"t",
		"p"
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
	
	
	return {
		escapeHtml: escapeHtml,
		intOrNA: intOrNA,
		doubleOrNA: doubleOrNA,
		currTimeMiliSec: currTimeMiliSec,
		currTimeSec: currTimeSec,
		stringNormalizeLen: stringNormalizeLen,
		deltaSecToString: deltaSecToString,
		deltaMiliSecToString: deltaMiliSecToString,
		miliSecToString: miliSecToString,
		hrp: hrp,
		
		doubleOrNA_kStyle: doubleOrNA_kStyle,
	};

});