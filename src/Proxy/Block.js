
const Common = require("./Common");

var BLOCK_OFFSETS = {
	VERSION    : 0,
	PREVHASH   : 0+4,
	MERKLE_ROOT: 0+4+32,
	NTIME      : 0+4+32+32,
	NBITS      : 0+4+32+32+4,
	NONCE      : 0+4+32+32+4+4,
};


class Job {
	constructor(job) {
		this.offset_ntime = BLOCK_OFFSETS.NTIME;
		this.offset_nbits = BLOCK_OFFSETS.NBITS;
		
		
		
		this.extranonce1 = job.extranonce1;
		this.extranonce2_size = job.extranonce2_size;
		this.job_id = job.job_id;
		this.difficulty = job.difficulty;
		this.difficulty_pool = job.difficulty;
		this.difficulty_real = job.difficulty * 4294967296;
		this.prevhash = job.prevhash;
		this.coinb1 = job.coinb1;
		this.coinb2 = job.coinb2;
		this.merkle_branch = job.merkle_branch;
		this.version = job.version;
		this.nbits = job.nbits;
		this.ntime = job.ntime;
		this.clean_jobs = job.clean_jobs;
		
		////////
		this.extranonce1_blob = new Buffer(this.extranonce1, "hex");
	
		this.extranonce2_blob = new Buffer(this.extranonce2_size);
		this.extranonce2_blob.fill(0);
		
		////////
		this.prevhash_blob = new Buffer(this.prevhash, "hex");
		this.coinb1_blob   = new Buffer(this.coinb1  , "hex");
		this.coinb2_blob   = new Buffer(this.coinb2  , "hex");
		this.version_blob  = new Buffer(this.version , "hex");
		this.nbits_blob    = new Buffer(this.nbits   , "hex");
		this.ntime_blob    = new Buffer(this.ntime   , "hex");
		
		this.merkle_branch_blob = this.merkle_branch.map(v => new Buffer(v, "hex"));

		this.difficulty = this.difficulty;
		this.difficulty_pool = this.difficulty_pool;
		this.difficulty_real = this.difficulty_real;
		
		this.target_blob = this.diffToTarget(this.difficulty);
		
		this.makeCoinbase();
		
		this.block_height = this.getBlockHeight();
		
		this.block_header_blob = null;
	}

	makeCoinbase() {
		this.coinbase_blob = new Buffer(this.coinb1_blob.length + this.extranonce1_blob.length + this.extranonce2_blob.length + this.coinb2_blob.length);
		
		let ofs = 0;
		this.coinb1_blob.copy(this.coinbase_blob, ofs); ofs += this.coinb1_blob.length;

		this.extranonce1_blob.copy(this.coinbase_blob, ofs); ofs += this.extranonce1_blob.length;
		this.extranonce2_blob.copy(this.coinbase_blob, ofs); ofs += this.extranonce2_blob.length;

		this.coinb2_blob.copy(this.coinbase_blob, ofs); ofs += this.coinb2_blob.length;
	}
	sha256d_gen_merkle_root() {
		let tmp = new Buffer(64);
	
		let merkle_root = Common.sha256d(this.coinbase_blob);
	
		for(let merkle of this.merkle_branch_blob) {
			merkle_root.copy(tmp, 0, 0, 32);
			merkle.copy(tmp, 32, 0, 32);
		
			merkle_root = Common.sha256d(tmp);
		}
	
		return merkle_root;
	}
	getBlockHeight() {
		let height = 0;
		
		for(let i = 32; i < 32 + 128 - 1; i++) {
			if ( this.coinbase_blob[i] === 0xFF && this.coinbase_blob[i + 1] === 0xFF ) {
				for(; this.coinbase_blob[i] === 0xFF; i++);
				i++;
				let len = this.coinbase_blob[i++];

				for(let j = 0; j < len; j++) {
					height |= this.coinbase_blob[i++] << (j << 3);
				}
				
				break;
			}
		}
		
		return height;
	}
	diffToTarget(diff, fr = 1.0) {
		diff /= fr;
		
		let target = new Buffer(32);
		for(let i = 0; i < 32; i++) { target[i] = 0xFF; }

		let k;
		for(k = 6; k > 0 && diff > 1.0; k--) {
			diff /= 4294967296.0;
		}
		
		let m = (4294901760.0 / diff);
		
		
		if ( m == 0 && k == 6 ) {
			return target;
		}
		
		for(let i = 0; i < 32; i++) { target[i] = 0x00; }
		target.writeInt32LE(0|(m % 4294967296.0), k*4);
		target.writeInt32LE(0|(m / 4294967296.0), (k+1)*4);
		
		//console.log("k: " + k+ "  diff: " + diff.toFixed(4));
		
		return target;
	}	

	incExtranonce2() {
		for(let i = 0; i < this.extranonce2_blob.length; i++) {
			this.extranonce2_blob[i]++;
			if ( this.extranonce2_blob[i] ) {
				break;
			}
		}
	}
	writeExtranonce2(extranonce2_blob) {
		let tmp_extranonce2_blob = new Buffer(this.extranonce2_size);
		tmp_extranonce2_blob.fill(0);
		extranonce2_blob.copy(tmp_extranonce2_blob);
		
		tmp_extranonce2_blob.copy(this.coinbase_blob, this.coinb1_blob.length + this.extranonce1_blob.length);
	}
	
	getBlockHeader(extranonce2_blob, ntime_blob, nonce_blob) {
		let blob = new Buffer(32*4);
		blob.fill(0);
		
		this.writeExtranonce2(extranonce2_blob);
		let merkle_root_blob = this.sha256d_gen_merkle_root();
		
		this.version_blob .copy(blob, BLOCK_OFFSETS.VERSION);
		
		this.prevhash_blob.copy(blob, BLOCK_OFFSETS.PREVHASH);
		
		this.swapDwordBlock(merkle_root_blob);
		merkle_root_blob.copy(blob, BLOCK_OFFSETS.MERKLE_ROOT);
		
		ntime_blob.copy(blob, this.offset_ntime, 0, 4);
		
		this.nbits_blob.copy(blob, this.offset_nbits);
		
		blob.writeInt32LE(0x80000000|0, 20*4);
		blob.writeInt32LE(0x00000280|0, 31*4);
		
		nonce_blob.copy(blob, BLOCK_OFFSETS.NONCE, 0, 4);
   
		return blob;
	}

	getStat() {
		return  {
			id             : this.id,
			job_id         : this.job_id,
			difficulty     : this.difficulty,
			difficulty_pool: this.difficulty_pool,
			difficulty_real: this.difficulty_real,
			block_height   : this.block_height,
		};
	}

	getHashBlob(share) {
		let block_header_blob = this.getBlockHeader(
			new Buffer(share.extranonce2, "hex"),
			new Buffer(share.ntime, "hex"),
			new Buffer(share.nonce, "hex")
		);
		
		return this.hashSha256d(block_header_blob);
	}
	getHash(share) {
		return this.getHashBlob(share).toString("hex");
	}
	testShare(share) {
		return this.cmpHash(this.getHashBlob(share), this.target_blob);
	}
	swapDword(data) {
		let buf = new Buffer(data.length);
		
		for(let i = 0; i < data.length / 4; i++) {
			buf[i*4 + 0] = data[i*4 + 3];
			buf[i*4 + 1] = data[i*4 + 2];
			buf[i*4 + 2] = data[i*4 + 1];
			buf[i*4 + 3] = data[i*4 + 0];
		}
		
		return buf;
	}
	swapDwordBlock(data) {
		for(let i = 0; i < data.length / 4; i++) {
			let l0 = data[i*4 + 0];
			let l1 = data[i*4 + 1];
			data[i*4 + 0] = data[i*4 + 3];
			data[i*4 + 1] = data[i*4 + 2];
			data[i*4 + 2] = l1;
			data[i*4 + 3] = l0;
		}
		
		return data;
	}
	hashSha256d(block_header_blob) {
		let blob = new Buffer(80);
		block_header_blob.copy(blob);
		return Common.sha256d(this.swapDword(blob));
	}
	cmpHash(hash, target) {
		for(let i = 31; i >=0; i--) {
			if ( hash[i] < target[i] ) { return true; }
			if ( hash[i] > target[i] ) { return false; }
		}
		
		return false;
	}
}

module.exports = {
	Job: Job,
	
	JobSha256d: Job,
};

