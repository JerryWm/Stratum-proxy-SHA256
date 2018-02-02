
const Common = require("../Common");
const PackArray = require("../PackArray");
const WebStatBase = require("./WebStatBase");
const HashRate = require("../HashRate");

class Workers extends WebStatBase {
	constructor(events) {
		super(events);
		
		this.events = events;
	
		this.workers = {};
		this.workersArchive = new PackArray(1024*1024);
		
		this.workersSys = {};
		
		this.summary_hash_count = 0;
		
		events.on("web:server:connect_web_socket", (socket) => {
			this._workerUpdate();

			this.webEmit("workersArchive", this.workersArchive.getData(), socket);
			this.webEmit("workers", Common.objToArray(this.workers), socket);
		});		
		
		events.on("stratum:server:worker:connect"      , this.workerConnect      .bind(this));
		events.on("stratum:server:worker:disconnect"   , this.workerDisconnect   .bind(this));
		events.on("stratum:server:worker:authorize"    , this.workerAuthorize    .bind(this));
		events.on("stratum:server:worker:accepted_job" , this.workerAcceptedJob  .bind(this));

		events.on("stratum:server:worker:accepted_share", this.workerAcceptedShare .bind(this));
		events.on("stratum:server:worker:rejected_share", this.workerRejectedShare .bind(this));
		 
		 
		//events.on("stratum:client:accepted_share"      , this.workerAcceptedShare.bind(this));
		//events.on("stratum:client:rejected_share"      , this.workerRejectedShare.bind(this));
		events.on("stratum:proxy:pool_add_worker"      , this.workerPoolAddWorker.bind(this));
		events.on("stratum:proxy:pool_del_worker"      , this.workerPoolDelWorker.bind(this));
		
		///	TODO
		events.on("control:workers:server:worker:app:options", (origWorker, options) => {
			this._workerOptions(origWorker, options);
		});
	
	
	
		this.summaryHashRateLast = new HashRate.HashRateLast(100);
		setInterval(() => {
			this.summaryHashRateLast.addResultJob(this.summary_hash_count);

			let summaryHashRate = this.summaryHashRateLast.getHashRate();
			
			this.events.emit("workers:summary_hash_rate", summaryHashRate);
			this.webEmit("workers_summary_hash_rate", summaryHashRate);
		}, 1e3);
	}
	
	_workerUpdate(id) {
		if ( !id ) {
			for(let i in this.workers) {
				this._workerUpdate(i);
			}
			return;
		}
		
		let worker = this.workers[id];
		if ( !worker ) { return; }
		
		if ( worker.alive ) {
			worker.time_in_work = Common.currTimeMiliSec() - worker.connection_time;
		}
	}
	_workerUpdateMini(id, info) {
		let data = [
			id, 
			info.difficulty,
			info.job_count,
			info.accepted_share_count,
			info.rejected_share_count,
			info.hash_count,
			info.share_count,
			info.hashrate,
			info.pool_id,
			info.hash_rate,
			info.name
		];
		//console.log("Update mini worker", data)
		this.webEmit("worker_info_mini", data);		
	}
	workerConnect(origWorker) {
		let worker = this.workers[origWorker.id] = {
			id  : origWorker.id,
			
			agent         : origWorker.agent,
			address       : origWorker.address,
			pool_password : origWorker.pool_password,
			wallet_address: origWorker.wallet_address,
			
			name: "",
			
			pool_id: 0,
			
			time_in_work: 0,
			connection_time: Common.currTimeMiliSec(),
			disconnection_time: null,
			
			difficulty: null,
			
			worker_count: 0,
			job_count  : 0,
			accepted_share_count: 0,
			rejected_share_count: 0,
			
			hash_count: 0,
			share_count: 0,

			hashrate: {},
			
			hash_rate: origWorker.hash_rate,
			
			disconnection_error: "",
			
			ping: null,
			
			alive: true,
		};
		
		this.workersSys[origWorker.id] = {
			id: origWorker.id,
			hashRateLast: new HashRate.HashRateLast,
			hashRate: new HashRate.HashRate,
		};
		
		this.webEmit("workers", [worker]);
	}
	workerDisconnect(origWorker, msg) {
		let worker = this.workers[origWorker.id]; if ( !worker ) { return; }
		
		worker.disconnection_time = Common.currTimeMiliSec();
		worker.time_in_work = worker.disconnection_time - worker.connection_time;
		worker.disconnection_error = msg || "";
		worker.alive = false;

		this.webEmit("workers", [worker]);
		
		this.workersArchive.write("worker", worker);
		
		delete this.workers[worker.id];
		delete this.workersSys[origWorker.id];
	}
	workerAuthorize(origWorker) {
		let worker = this.workers[origWorker.id]; if ( !worker ) { return; }
		
		worker.wallet_address = origWorker.wallet_address;
		worker.pool_password = origWorker.pool_password;
		
		this.webEmit("workers", [worker]);
	}
	workerAcceptedJob(origWorker, job) {
		let worker = this.workers[origWorker.id]; if ( !worker ) { return; }
		
		worker.job_count++;
		worker.difficulty = origWorker.difficulty;
		
		this._workerUpdateMini(worker.id, {
			job_count: worker.job_count, 
			difficulty: worker.difficulty
		});
	}

	workerAcceptedShare(origPool, share) {
		if ( !share.worker_id ) { return; }
		let worker = this.workers[share.worker_id]; if ( !worker ) { return; }
		let workerSys = this.workersSys[share.worker_id];
		
		worker.accepted_share_count++;
		worker.share_count++;
		worker.hash_count += share.job.block_job.difficulty_real;
		this.summary_hash_count += share.job.block_job.difficulty_real;
		
		workerSys.hashRate.addResultJob(worker.hash_count);
		workerSys.hashRateLast.addResultJob(worker.hash_count);
		
		
		let hashrate = workerSys.hashRate.getHashRate([5, 10, 15, 30, 60, "all"]);
		hashrate["current"] = workerSys.hashRateLast.getHashRate();
		worker.hashrate = hashrate;
		
		this._workerUpdateMini(worker.id, {
			accepted_share_count: worker.accepted_share_count,
			share_count: worker.share_count,
			hash_count: worker.hash_count,
			hashrate: hashrate,
		});
	}
	workerRejectedShare(origPool, share) {
		if ( !share.worker_id ) { return; }
		let worker = this.workers[share.worker_id]; if ( !worker ) { return; }
		
		worker.rejected_share_count++;
		
		this._workerUpdateMini(worker.id, {
			rejected_share_count: worker.rejected_share_count,
		});
	}
	workerPoolAddWorker(origPool, origWorker) {
		let worker = this.workers[origWorker.id]; if ( !worker ) { return; }
		
		worker.pool_id = origPool.id;
		
		this._workerUpdateMini(worker.id, {pool_id: worker.pool_id});
	}
	workerPoolDelWorker(origPool, origWorker) {
		let worker = this.workers[origWorker.id]; if ( !worker ) { return; }
		
		worker.pool_id = 0;
		
		this._workerUpdateMini(worker.id, {pool_id: worker.pool_id});
	}

}

module.exports = Workers;
