
class Job {
	constructor(obj) {
		this.difficulty = obj.difficulty;
		this.extranonce1 = obj.extranonce1;
		this.extranonce2_size = obj.extranonce2_size;
			
		this.job_id = obj.job_id;
		this.prevhash = obj.prevhash;
		this.coinb1 = obj.coinb1;
		this.coinb2 = obj.coinb2;
		this.merkle_branch = obj.merkle_branch;
		this.version = obj.version;
		this.nbits = obj.nbits;
		this.ntime = obj.ntime;
		this.clean_jobs = obj.clean_jobs;
	}
	
	copy() {
		return new Job(this);
	}
}

class Share {
	constructor(obj) {
		this.login = obj.login;
		this.job_id = obj.job_id;
		this.extranonce2 = obj.extranonce2;
		this.ntime = obj.ntime;
		this.nonce = obj.nonce;
	}
	
	copy() {
		return new Share(this);
	}
}

module.exports = {
	Job: Job,
	Share: Share,
};


