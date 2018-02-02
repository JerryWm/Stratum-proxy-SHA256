
const Common = require("./Common");

class CommonCrypto {
}
CommonCrypto.swapDword = (data) => {
	let buf = new Buffer(data.length);
	
	for(let i = 0; i < data.length / 4; i++) {
		buf[i*4 + 0] = data[i*4 + 3];
		buf[i*4 + 1] = data[i*4 + 2];
		buf[i*4 + 2] = data[i*4 + 1];
		buf[i*4 + 3] = data[i*4 + 0];
	}
	
	return buf;
}
CommonCrypto.hashSha256d = (block_header_blob) => {
	let blob = new Buffer(80);
	block_header_blob.copy(blob);
	return Common.sha256d(CommonCrypto.swapDword(blob));
}
CommonCrypto.testShare = (hash, target) => {
	for(let i = 31; i >=0; i--) {
		if ( hash[i] < target[i] ) { return true; }
		if ( hash[i] > target[i] ) { return false; }
	}
	
	return false;
}



module.exports = CommonCrypto;



