
const EventEmitter = require("events").EventEmitter;

const Logger = require("./Logger");
const Common = require("./Common");
const WebServer = require("./WebServer");
const StratumConfig = require("./StratumConfig");
const StratumCommon = require("./StratumCommon");

const StratumClient = require("./StratumClient");
const StratumServer = require("./StratumServer");

const LoopData = require("./../Share/Common/LoopData");

const STRATUM_PROXY_SERVER_RECONNECT_INTERVAL = 5e3;
const STRATUM_PROXY_CLIENT_RECONNECT_INTERVAL = 5e3;
const HTTP_SERVER_RECONNECT_INTERVAL = 5e3;

const STRATUM_LOOP_CONNECT_POOL_TIMEOUT = 5e3;



let MAX_WORKERS = 100;

class WrapperPool {
	constructor(id, pool, options) {
		this.id = id;
		this.pool = pool;
		
		this.options = Object.assign({maxWorkersCount: 1}, options);
		
		this.workersCount = 0;
		this.workers = {};

		this.job_id = null;		
	}
	
	clear() {
		this.workersCount = 0;
		this.workers = {};
	}
	
	addWorker(id, worker) {
		if ( this.workersCount >= this.options.maxWorkersCount ) {
			return false;
		}
		
		this.workers[id] = worker;
		this.workersCount++;
		///console.log('...this.jobForWorker')
		this.jobForWorker(id);
		
		return true;
	}
	delWorker(id) {
		let wrapperWorker = this.workers[id]; if ( !wrapperWorker ) { return; }
		if ( wrapperWorker.pool ) {
			wrapperWorker.delPool();
		}
		
		delete this.workers[id];
		this.workersCount--;
	}
	delWorkers() {
		let arr = [];
		for(let worker_id in this.workers) {
			arr.push(worker_id);
		}
		
		for(let worker_id of arr) {
			this.delWorker(worker_id);
		}
	}
	
	newJob() {
		for(let i in this.workers) {
			this.jobForWorker(this.workers[i].id);
		}
	}
	jobForWorker(id) {
		let job = this.pool.getJob();
		if ( !job ) {
			return;
		}
		
		
		this.job_id = job.job_id;
		
		let worker = this.workers[id];
		if ( !worker ) {
			return;
		}

		worker.worker.setJob(job);
	}

	submitShare(share) {
		if ( this.pool ) {
			this.pool.submitShare(share);
		}
	}
	

}

class WrapperWorker {
	constructor(id, worker, events) {
		this.id = id;
		this.worker = worker;
		this.events = events;
		this.pool = null;
	}
	
	addPool(pool) {
		this.pool = pool;
		//console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.stratum:proxy:pool_add_worker")
		this.events.emit("stratum:proxy:pool_add_worker", this.pool.pool, this.worker);
	}
	delPool() {
		if ( this.pool ) {
			//console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@.stratum:proxy:pool_del_worker")
			this.events.emit("stratum:proxy:pool_del_worker", this.pool.pool, this.worker);
		}
		this.pool = null;
	}
	
	setWorker(worker) {
		this.worker = worker;
	}
}


const MAX_WORKER_COUNT_TIME_INTERVAL_SEC = 5*60;

class MaxWorkerCount {
	constructor(events) {
		this.events = events;
		this.worker_count = 0;
		this.max_worker_count = 0;
		this.last_update_time_sec = Common.currTimeSec();

		this.time_interval_sec = MAX_WORKER_COUNT_TIME_INTERVAL_SEC;
		
		events.on("stratum:server:worker:connect"         , this.workerConnect      .bind(this));
		this.events.on("stratum:server:worker:disconnect"      , this.workerDisconnect   .bind(this));
	}
	
	workerConnect() {
		this.worker_count++;
		this.max_worker_count = Math.max(this.max_worker_count, this.worker_count);
		this.last_update_time_sec = Common.currTimeSec();
	}
	workerDisconnect() {
		this.worker_count--;
		this.last_update_time_sec = Common.currTimeSec();
	}
	
	getMaxWorkerCount() {
		if ( Common.currTimeSec() > this.last_update_time_sec + this.time_interval_sec ) {
			this.max_worker_count = this.worker_count;
		}
		
		return this.max_worker_count;
	}
}


class PoolGroup {
	constructor(pool_info, getMaxWorkerCount, events, logger) {
		this.id = Common.getGlobalUniqueId();
		this.pool_info = Object.assign({
			retry_count_connect: 5
		}, pool_info);
		this.getMaxWorkerCount = getMaxWorkerCount;
		this.events = events;
		this.logger = logger;
		this.prefix = "stratum:client_group:";

		this.pools = Object.create(null);
		this.pools_open = Object.create(null);
		this.pools_connect = Object.create(null);
		this.pools_job = Object.create(null);
		this.pools_job_workers = Object.create(null);
		
		this.worker_group = null;
		
		this.pool_close_count = 0;
		this.retry_count_connect = this.pool_info.retry_count_connect;
		
		this.closed = false;
		
		this.connected = false;
		
		this.setEvents();


		this.events.emit(this.prefix + "open", this);
				
		this.doConnect();
		this.doFreeWorkersToFreePools();
	}
	
	setEvent(event_name, cb, poolIdFl = true) {
		this.__set_events = this.__set_events || [];
		
		let wcb = (obj, ...argv) => {
			if ( !poolIdFl || this.pools[obj.id] ) {
				//console.log("> pools "+event_name)
				cb(obj, ...argv);
			}
		};
		
		this.__set_events.push({
			event_name: event_name,
			cb: wcb,
		});
		
		this.events.on(event_name, wcb);
	}
	delEvents() {
		if ( !this.closed ) {
			return;
		}
		
		if ( Object.keys(this.pools).length ) {
			return;
		}
		
		if ( !this.__set_events ) {
			return;
		}
		
		for(let event of this.__set_events) {
			//console.log(event.event_name)
			this.events.removeListener(event.event_name, event.cb);
		}
		
		this.__set_events = null;
	}

	
	setEvents() {		
		this.setEvent("stratum:client:open"           , this.poolOpen         .bind(this));
		this.setEvent("stratum:client:close"          , this.poolClose        .bind(this));
		this.setEvent("stratum:client:connect"        , this.poolConnect      .bind(this));
		this.setEvent("stratum:client:disconnect"     , this.poolDisconnect   .bind(this));
		this.setEvent("stratum:client:accepted_job"   , this.poolAcceptedJob  .bind(this));
		
		this.setEvent("stratum:server:worker:disconnect" , this.workerDisconnect    .bind(this));
	}
	
	poolOpen(origPool) {
		this.pools_open[origPool.id] = origPool;
	}
	poolClose(origPool) {
		delete this.pools_open[origPool.id];
		delete this.pools_connect[origPool.id];
		delete this.pools_job[origPool.id];
		delete this.pools[origPool.id];
		
		this.pool_close_count++;
		if ( this.pool_close_count >= this.getMaxWorkerCount() ) {
			this.retry_count_connect--;
			this.pool_close_count = 0;
			
			if ( !this.retry_count_connect ) {
				this.close("Pool close");
			}
		}
		
		this.delEvents();
	}
	poolConnect(origPool) {
		this.pools_connect[origPool.id] = origPool;
	}
	poolDisconnect(origPool) {
		delete this.pools_connect[origPool.id];
		delete this.pools_job[origPool.id];
	}
	poolAcceptedJob(origPool) {
		if ( !this.pools_job[origPool.id] ) {
			this.pools_job[origPool.id] = new WrapperPool(origPool.id, origPool, {});
			this.freeWorkersToFreePools();
			
			if( Object.keys(this.pools_job).length >= this.getMaxWorkerCount() ) {
				if ( !this.connected ) {
					this.events.emit(this.prefix + "connect", this);
				}
				this.connected = true;
			}
		}
		
		this.pools_job[origPool.id].newJob();
	}
	
	workerDisconnect(origWorker) {
		for(let pool_id in this.pools_job) {
			this.pools_job[pool_id].delWorker(origWorker.id);
		}
	}
	
	
	
	attachWorkerGroup(workerGroup) {
		this.detachWorkerGroup();
		
		this.worker_group = workerGroup;
		
		this.freeWorkersToFreePools();
	}
	detachWorkerGroup() {
		for(let pool_id in this.pools_job) {
			//console.log('detachWorkerGroup,',pool_id)
			this.pools_job[pool_id].delWorkers();
		}
		
		if ( !this.worker_group ) {
			return;
		}

		this.worker_group.delPools();
		
		this.worker_group = null;
	}
	
	freeWorkersToFreePools() {
		if ( this.closed ) { return; }
		
		if ( !this.worker_group ) {
			return;
		}

		for(let pool_id in this.pools_job) {
			let wrapperPool = this.pools_job[pool_id];
			
			while(1) {
				let wrapperWorker = this.worker_group.getFreeWorker();
				
				if ( !wrapperWorker ) {
					return;
				}
				
				if ( !wrapperPool.addWorker(wrapperWorker.id, wrapperWorker) ) {
					break;
				}
				
				wrapperWorker.addPool(wrapperPool);
			}
		}
	}
	doFreeWorkersToFreePools() {
		if ( this.closed ) { return; }
		
		this.freeWorkersToFreePools();
		
		setTimeout(this.doFreeWorkersToFreePools.bind(this), 1e3);
	}
	
	doConnect() {
		if ( this.closed ) { return; }
			
		let max_worker_count = this.getMaxWorkerCount() || 1;

		let worker_count = max_worker_count - Object.keys(this.pools_open).length;
		
		for(let i = 0; i < worker_count; i++) {
			this.connect();
		}
		
		setTimeout(this.doConnect.bind(this), 2e3);
	}
	connect() {
		let pool_id = Common.getGlobalUniqueId();
		this.pools[pool_id] = true;
		
		new StratumClient(this.pool_info, this.events, this.logger, pool_id);
	}

	
	
	close(error) {
		if ( this.closed ) {
			return;
		}
		this.closed = true;
		
		for(let pool_id in this.pools_open) {
			this.pools_open[pool_id].close(error);
		}
		
		this.detachWorkerGroup();
		
		this.delEvents();
		
		if ( this.connected ) {
			this.connected = false;
			this.events.emit(this.prefix+"disconnect", this, error);
		}
		this.events.emit(this.prefix+"close", this, error);
	}
}

class WorkerGroup {
	constructor(events, logger) {
		this.id = Common.getGlobalUniqueId();
		this.events = events;
		this.logger = logger;
		
		this.workers = Object.create(null);
		
		
		
		this.workerShare = (origWorker, share) => {
			let wrapperWorker = this.workers[origWorker.id]; if ( !wrapperWorker ) { return; }
			
			if ( !wrapperWorker.pool ) { return; }
			
			wrapperWorker.pool.submitShare(share);
		};
		this.setEvents();
	}
	
	setEvents() {
		this.events.on("stratum:server:worker:share", this.workerShare);
	}
	delEvents() {
		this.events.removeListener("stratum:server:worker:share", this.workerShare);
	}
	
	getFreeWorker() {
		for(let worker_id in this.workers) {
			let wrapperWorker = this.workers[worker_id];
			if ( !wrapperWorker.pool ) {
				return wrapperWorker;
			}
		}
		
		return null;
	}
	
	delPool(pool_id) {
		for(let worker_id in this.workers) {
			
		}
	}
	delPools() {
		for(let worker_id in this.workers) {
			this.workers[worker_id].pool = null;
		}		
	}
	
	addWorker(worker_id, worker) {
		this.workers[worker_id] = worker;
	}
	delWorker(worker_id) {
		let wrapperWorker = this.workers[worker_id];
		if ( !wrapperWorker ) { return; }
		
		if ( wrapperWorker.pool ) {
			wrapperWorker.pool.delWorker(wrapperWorker.id);
			wrapperWorker.delPool();
		}
		
		delete this.workers[worker_id];
	}

	
	close() {
		this.delEvents();
	}
}

/**
	onConnectPool
*/
class StratumProxy {
	constructor(options, pool_connect_info, events, logger) {
		this.logger = new Logger(logger, "STRATUM-PROXY");

		this.prefix = "stratum:proxy:";

		this.options = options;
		
		this.pool_connect_info = pool_connect_info;
		
		this.stratumClient = null;
		this.stratumServer = null;

		// TODO
		this.maxWorkersCount = 1;//100;
		this.emu_nicehash = false;
		
		this.worker_seq = 0;
		
		this.job = null;
		
		this._jobs = {};
		
		this.events = events;
		
		this.worker_group = new WorkerGroup(this.events, this.logger);
		
		this.pools = {};
		this.workers = {};
		
		this.workerToPool = {};
		this.poolToWorker = {};
		
		this.openNoConnectPools = {};
		this.freeWorkers = [];
		
		this.poolAddCount = 0;

		this.maxWorkerCount = new MaxWorkerCount(this.events);

		this.events.on("stratum:server:worker:connect"         , this.workerConnect      .bind(this));
		this.events.on("stratum:server:worker:disconnect"      , this.workerDisconnect   .bind(this));
		//this.events.on("stratum:server:worker:share"           , this.workerShare        .bind(this));
		
		//this.events.on("stratum:server:worker:login"         , this.workerLogin        .bind(this));
		//this.events.on("stratum:server:worker:info"          , this.workerInfo         .bind(this));
		//this.events.on("stratum:server:worker:set_difficulty", this.workerSetDifficulty.bind(this));

		
		this.events.on("stratum:client:open"           , this.poolOpen         .bind(this));
		this.events.on("stratum:client:close"          , this.poolClose        .bind(this));
		this.events.on("stratum:client:connect"        , this.poolConnect      .bind(this));
		this.events.on("stratum:client:disconnect"     , this.poolDisconnect   .bind(this));
		this.events.on("stratum:client:accepted_job"   , this.poolAcceptedJob  .bind(this));
	
		//this.events.on("stratum:client:accepted_share" , this.poolAcceptedShare.bind(this));
		//this.events.on("stratum:client:rejected_share" , this.poolRejectedShare.bind(this));
		//this.events.on("stratum:client:ping"           , this.poolPing         .bind(this));

		
		this.pool_group_list = Object.create(null);
		this.pool_group_active = null;
		
		
		
		this.events.on("stratum:client_group:connect", (poolGroup) => {
			this.pool_group_list[ poolGroup.id ] = poolGroup;
		});
		this.events.on("stratum:client_group:close", (poolGroup) => {
			let pool_group = this.pool_group_list[ poolGroup.id ];
			if ( pool_group ) {
				if ( pool_group === this.pool_group_active ) {
					this.pool_group_active.detachWorkerGroup();
					this.pool_group_active = null;
				}
			}
			
			delete this.pool_group_list[ poolGroup.id ];
		});
		
		this.events.on("control:client_group:connect", (pool_info) => {
			new PoolGroup(pool_info, this.maxWorkerCount.getMaxWorkerCount.bind(this.maxWorkerCount), this.events, this.logger);
		});
	
		this.events.on("control:client_group:active", (pool_group_id) => {
			if ( this.pool_group_active ) {
				this.pool_group_active.detachWorkerGroup();
				this.pool_group_active = null;
			}
			
			if ( this.pool_group_list[pool_group_id] ) {
				this.pool_group_active = this.pool_group_list[pool_group_id];
				this.pool_group_active.attachWorkerGroup(this.worker_group);
			}
		});
	
		this.startStratumServers();
	}

	startStratumServers() {
		var list = {};
		this.events.on("stratum:server:close", (server) => {
			let svOptions = list[server.id];
			if ( svOptions ) {
				setTimeout(() => {list[ (new StratumServer(svOptions, this.events, this.logger)).id ] = svOptions;}, STRATUM_PROXY_SERVER_RECONNECT_INTERVAL);
			}
			delete list[server.id];
		});
		
		for(let svOptions of this.options.servers) {
			list[ (new StratumServer(svOptions, this.events, this.logger)).id ] = svOptions;
		}
	}
	


	
	
	
	workerConnect(worker) {
		let wrapperWorker = new WrapperWorker(worker.id, worker, this.events);
		
		this.worker_group.addWorker(wrapperWorker.id, wrapperWorker);
		
		if ( this.pool_group_active ) {
			this.pool_group_active.freeWorkersToFreePools();
		}
	}
	workerDisconnect(worker) {
		this.worker_group.delWorker(worker.id);
	}
	workerShare(worker, share) {
		let wrapperWorker = this.workers[worker.id];
		
		if ( !wrapperWorker || !wrapperWorker.pool ) {
			return;
		}
		
		wrapperWorker.pool.submitShare(share);
	}
	
	
	
	poolOpen(pool) {
		this.openNoConnectPools[pool.id] = pool;
	}
	poolClose(pool) {
		delete this.openNoConnectPools[pool.id];
	}
	poolConnect(pool) {
		delete this.openNoConnectPools[pool.id];
		
		this.pools[pool.id] = new WrapperPool(pool.id, pool, {maxWorkersCount: this.maxWorkersCount, emu_nicehash: this.emu_nicehash,});
	}
	poolDisconnect(pool) {
		delete this.pools[pool.id];
	}
	poolAcceptedJob(pool, job) {
		let wrapperPool = this.pools[pool.id];

		if ( wrapperPool ) {
			wrapperPool.newJob(job);
		}
	}

}

module.exports = StratumProxy;
