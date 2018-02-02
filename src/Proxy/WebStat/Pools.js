
const Common = require("../Common");
const PackArray = require("../PackArray");
const WebStatBase = require("./WebStatBase");
const HashRate = require("../HashRate");

class Pools extends WebStatBase {
	constructor(events) {
		super(events);
		
		this.pools = {};
		this.poolsArchive = new PackArray(1024*1024);
		
		this.poolsSys = {};
	
		events.on("web:server:connect_web_socket", (socket) => {
			this._poolUpdate();

			this.webEmit("poolsArchive", this.poolsArchive.getData(), socket);
			this.webEmit("pools", Common.objToArray(this.pools), socket);
		});

		events.on("stratum:client:connect"       , this.poolConnect      .bind(this));
		events.on("stratum:client:disconnect"    , this.poolDisconnect   .bind(this));
		events.on("stratum:client:ping"          , this.poolPing         .bind(this));
		events.on("stratum:client:accepted_share", this.poolAcceptedShare.bind(this));
		events.on("stratum:client:rejected_share", this.poolRejectedShare.bind(this));
		events.on("stratum:client:accepted_job"  , this.poolAcceptedJob  .bind(this));
		events.on("stratum:proxy:pool_add_worker", this.poolAddWorker    .bind(this));
		events.on("stratum:proxy:pool_del_worker", this.poolDelWorker    .bind(this));

		
		
		setInterval(() => {
			for(let pool_id in this.pools) {
				this._poolUpdateHashRate(pool_id);
				
				this._poolUpdateMini(pool_id, {
					hashrate: this.pools[pool_id].hashrate,
				});
			}
		}, 10e3);
	}

	_poolUpdate(id) {
		if ( !id ) {
			for(let i in this.pools) {
				this._poolUpdate(i);
			}
			return;
		}
		
		let pool = this.pools[id];
		if ( !pool ) { return; }
		
		if ( pool.alive ) {
			pool.time_in_work = Common.currTimeMiliSec() - pool.connection_time;
		}
	}
	_poolUpdateMini(id, info) {
		
		let data = [
			id, 
			info.difficulty,
			info.worker_count,
			info.job_count,
			info.accepted_share_count,
			info.rejected_share_count,
			info.hash_count,
			info.share_count,
			info.ping,
			info.hashrate,
			info.difficulty_real,
		];
		
		this.webEmit("pool_info_mini", data);
	}
	_poolUpdateHashRate(pool_id) {
		let pool = this.pools[pool_id]; if ( !pool ) { return; }
		let poolSys = this.poolsSys[pool_id];
		
		poolSys.hashRate.addResultJob(pool.hash_count);
		poolSys.hashRateLast.addResultJob(pool.hash_count);
		
		let hashrate = poolSys.hashRate.getHashRate([5, 10, 15, 30, 60, 60*2, 60*3, 60*6, 60*12, 60*24, "all"]);
		hashrate["current"] = poolSys.hashRateLast.getHashRate();
		pool.hashrate = hashrate;
	}
	poolConnect(origPool) {
		
		let pool = this.pools[origPool.id] = {
			id  : origPool.id,

			pool_address  : origPool.pool.pool_address,
			pool_password : origPool.pool.pool_password,
			wallet_address: origPool.pool.wallet_address,
			
			time_in_work: 0,
			connection_time: Common.currTimeMiliSec(),
			disconnection_time: null,
			
			difficulty: origPool.difficulty_pool,
			difficulty_real: origPool.difficulty_real,
			
			worker_count: 0,
			job_count  : 0,
			accepted_share_count: 0,
			rejected_share_count: 0,
			
			hash_count: 0,
			share_count: 0,

			hashrate: {},
			
			disconnection_error: "",
			
			ping: origPool.ping,
			
			alive: true,
		};
		
		this.poolsSys[origPool.id] = {
			id: origPool.id,
			hashRateLast: new HashRate.HashRateLast,
			hashRate: new HashRate.HashRate,
		};

		this.webEmit("pools", [pool]);
	}
	poolDisconnect(origPool, msg) {
		let pool = this.pools[origPool.id]; if ( !pool ) { return; }
		
		pool.disconnection_time = Common.currTimeMiliSec();
		pool.time_in_work = pool.disconnection_time - pool.connection_time;
		pool.disconnection_error = msg;
		pool.alive = false;

		this.webEmit("pools", [pool]);
		
		this.poolsArchive.write("pool", pool);
		
		delete this.pools[pool.id];
		delete this.poolsSys[pool.id];
	}
	poolPing(origPool, ping) {
		let pool = this.pools[origPool.id]; if ( !pool ) { return; }
		
		pool.ping = ping;
		
		this._poolUpdateMini(pool.id, {ping: ping});
	}
	poolAcceptedShare(origPool, share) {
		let pool = this.pools[origPool.id]; if ( !pool ) { return; }
		let poolSys = this.poolsSys[origPool.id];
		
		pool.accepted_share_count++;
		pool.share_count++;
		pool.hash_count += share.job.block_job.difficulty_real;
		pool.ping = origPool.ping;
		
		this._poolUpdateHashRate(origPool.id);

		this._poolUpdateMini(pool.id, {
			accepted_share_count: pool.accepted_share_count,
			share_count         : pool.share_count,
			hash_count          : pool.hash_count,
			ping                : pool.ping,
			
			hashrate            : pool.hashrate,
		});
	}
	poolRejectedShare(origPool, share) {
		let pool = this.pools[origPool.id]; if ( !pool ) { return; }
		
		pool.rejected_share_count++;
		pool.share_count++;
		pool.ping = origPool.ping;

		this._poolUpdateMini(pool.id, {
			rejected_share_count: pool.rejected_share_count,
			share_count         : pool.share_count,
			hash_count          : pool.hash_count,
			ping                : pool.ping,
			
			hashrate            : pool.hashrate,
		});
	}
	poolAcceptedJob(origPool, job) {
		let pool = this.pools[origPool.id]; if ( !pool ) { return; }
		
		pool.job_count++;
		pool.difficulty = job.block_job.difficulty_pool;
		pool.difficulty_real = job.block_job.difficulty_real;
		
		this._poolUpdateMini(pool.id, {
			job_count: pool.job_count,
			difficulty        : pool.difficulty,
			difficulty_real   : pool.difficulty_real,
			hashrate          : pool.hashrate,
		});
	}
	poolAddWorker(origPool, origWorker) {
		let pool = this.pools[origPool.id]; if ( !pool ) { return; }
		
		pool.worker_count++;
		
		this._poolUpdateMini(pool.id, {worker_count: pool.worker_count});
	}
	poolDelWorker(origPool, origWorker) {
		let pool = this.pools[origPool.id]; if ( !pool ) { return; }
		
		pool.worker_count--;
		
		this._poolUpdateMini(pool.id, {worker_count: pool.worker_count});
	}
	
}

module.exports = Pools;