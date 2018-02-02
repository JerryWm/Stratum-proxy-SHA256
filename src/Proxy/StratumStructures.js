
class Job {
	constructor(job_id, pool_id, job, JobConstructor) {
		this.job_id = job_id;
		this.pool_id = pool_id;
		
		this.job = job;
		this.block_job = null;

		this.JobConstructor = JobConstructor;
		
		this.update();
	}
	
	update() {
		this.block_job = new this.JobConstructor(this.job);
	}
	
	copy() {
		return new Job(this.job_id, this.pool_id, this.job.copy(), this.JobConstructor);
	}
}

class Share {
	constructor(share_id, worker_id, job, share) {
		this.share_id  = share_id;
		this.worker_id = worker_id;
		this.pool_id   = job ? job.pool_id : null;
		this.job_id    = job ? job.job_id : null;
		
		this.job = job ? job.copy() : null;
		this.share = share.copy();
	}
	
	copy() {
		return new Share(this.share_id, this.worker_id, this.job, this.share);
	}
	
	getHash() {
		if ( !this.job ) {
			return null;
		}
		
		return this.job.block_job.getHash(this.share);
	}
}

module.exports = {
	Job: Job,
	Share: Share,
};


