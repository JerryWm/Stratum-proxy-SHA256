
const Common = require("../Common");
const PackArray = require("../PackArray");
const WebStatBase = require("./WebStatBase");

class Jobs extends WebStatBase {
	constructor(events) {
		super(events);

		this.jobs = {};
		this.jobsArchive = new PackArray(1024*1024);
		
		this.pools = Object.create(null);
		
		events.on("web:server:connect_web_socket", (socket) => {
			this._update();

			this.webEmit("jobsArchive", this.jobsArchive.getData(), socket);
			this.webEmit("jobs", Common.objToArray(this.jobs), socket);
		});			
		
		events.on("stratum:client:connect"       , this.poolConnect.bind(this));
		events.on("stratum:client:disconnect"    , this.poolDisconnect.bind(this));
		events.on("stratum:client:accepted_job"  , this.acceptedJob  .bind(this));
		events.on("stratum:client:accepted_share", this.acceptedShare.bind(this));
		events.on("stratum:client:rejected_share", this.rejectedShare.bind(this));
		
		events.on("stratum:proxy:pool_add_worker", this.poolAddWorker.bind(this));
		events.on("stratum:proxy:pool_del_worker", this.poolDelWorker.bind(this));
	}
	
	_update(id) {
		if ( !id ) {
			for(let i in this.jobs) {
				this._update(i);
			}
			return;
		}
		
		let job = this.jobs[id];
		if ( !job ) { return; }
		
		if ( job.alive ) {
			job.time_in_work = Common.currTimeMiliSec() - job.time_start;
		}
	}
	_updateMini(id, info) {
		let data = [
			id, 
			info.accepted_share_count,
			info.rejected_share_count,
		];

		this.webEmit("job_info_mini", data);				
	}
	
	poolAddWorker(origPool) {
		if ( this.pools[origPool.id] ) { this.pools[origPool.id].worker_count++; }
	}
	poolDelWorker(origPool) {
		if ( this.pools[origPool.id] ) { this.pools[origPool.id].worker_count--; }
	}
	
	poolConnect(origPool) {
		this.pools[ origPool.id ] = {
			worker_count: 0,
		};
	}
	poolDisconnect(origPool) {
		this._endJobForPool(origPool.id, "Pool disconnect");
		
		delete this.pools[ origPool.id ];
	}
	
	acceptedJob(origPool, origJob) {
		this._endJobForPool(origPool.id, "Switch job");
		
		let job = this.jobs[origJob.job_id] = {
			id: origJob.job_id,
			
			pool_id: origJob.pool_id,
			
			job_id: origJob.job.job_id,
			
			nonce : "00000000",
			
			difficulty     : origJob.block_job.difficulty_pool,
			difficulty_real: origJob.block_job.difficulty_real,
			
			block_height: origJob.block_job.block_height,
			
			accepted_share_count: 0,
			rejected_share_count: 0,
			
			time_in_work: 0,
			time_start  : Common.currTimeMiliSec(),
			time_end    : null,

			alive: true,
			
			worker_count: this.pools[origPool.id].worker_count
		};
		
		this.webEmit("jobs", [job]);
	}
	acceptedShare(origPool, share) {
		let job = this.jobs[share.job_id]; if ( !job ) { return; }
		
		job.accepted_share_count++;
		
		this._updateMini(job.id, {accepted_share_count: job.accepted_share_count});
	}
	rejectedShare(origPool, share) {
		let job = this.jobs[share.job_id]; if ( !job ) { return; }
	
		job.rejected_share_count++;
		
		this._updateMini(job.id, {rejected_share_count: job.rejected_share_count});
	}
	
	_endJobForPool(pool_id, end_message) {
		let rm_list = [];
		for(let job_id in this.jobs) {
			if ( this.jobs[job_id].pool_id === pool_id ) {
				this._endJob(job_id, end_message);
				rm_list.push(job_id);
			}
		}
		
		for(let job_id of rm_list) {
			delete this.jobs[job_id];
		}
	}
	_endJob(job_id, end_message) {
		let job = this.jobs[job_id]; if ( !job ) { return; }
		
		job.alive = false;
		job.time_end = Common.currTimeMiliSec();
		job.time_in_work = job.time_end - job.time_start;
		job.end_message = end_message || "";
		
		this.webEmit("jobs", [job]);
		
		this.jobsArchive.write("job", job);
	}

	
}

module.exports = Jobs;
