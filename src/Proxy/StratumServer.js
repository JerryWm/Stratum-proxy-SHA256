
const EventEmitter = require("events").EventEmitter;

const fs = require('fs');
const Logger = require("./Logger");
const Common = require("./Common");
const StratumConfig = require("./StratumConfig");
const StratumCommon = require("./StratumCommon");
const HashRate = require("./HashRate");
const Paths = require("./Paths");

const ShareStratumServer = require("./../Share/Stratum/StratumServer");

const StratumStructures = require("./StratumStructures");


/**
	bind_address,
	start_difficulty,
	share_time,
*/
/**
	onClose,
	
	onWorkerConnect,
	onWorkerDisconnect,
	onWorkerLogin,
	onWorkerHashRate,
	onWorkerGetJob,
	onWorkerResultJob,
	
	
*/

class TimeEvents {
	constructor() {
		this.data = [];
	}
	on(sec, cb, time) {
		if ( time === undefined ) {time = Common.currTimeSec();}
		
		this.data.push({
			interval: sec,
			lastTime: time,
			cb: cb,
		});
	}
	emit(time) {
		if ( time === undefined ) {time = Common.currTimeSec();}
		
		for(let v of this.data) {
			if ( v.lastTime + v.interval <= time ) {
				v.lastTime = time;
				v.cb();
			}
		}
	}
}

const stratumServerOptionsFilter = {
	start_difficulty: {def: 10000, min: 10, max: undefined},
	
	min_difficulty: {def: 10, min: 10, max: undefined},
	
	share_time: {def: 20, min: 1, max: undefined},
};


/**
	EventEmitter {
		stratum:server:open
		stratum:server:close
		stratum:server:listening
		
		stratum:server:worker:connect
		stratum:server:worker:disconnect
		stratum:server:worker:close
		stratum:server:worker:login
		stratum:server:worker:share
		stratum:server:worker:info
		stratum:server:worker:get_job
		stratum:server:worker:set_difficulty
		stratum:server:worker:
		stratum:server:worker:

		
	}
*/
class StratumServer {
	constructor(options, events, logger) {
		this.prefix = "stratum:server:";
		this.events = events;
		this.id = Common.getGlobalUniqueId();
		this.logger = new Logger(logger, "STRATUM-SERVER #" + this.id);

		
		
		this.options = {
			bind_address: options.bind_address,
			ssl: !!options.ssl,
			
			
			min_difficulty: options.min_difficulty || null,
			max_difficulty: options.max_difficulty || null,
			max_extranonce2_size: options.max_extranonce2_size || null,
		};
		
		this.logger.notice(`Attempting opened server on ${this.logInfoServer(Logger.LOG_COLOR_MAGENTA_LIGHT, Logger.LOG_COLOR_GRAY)}`);
		this.stratumServer = new ShareStratumServer(this.options);
		this.stratumServer.on("open", (...argv) => this.events.emit(this.prefix+"open", this, ...argv));
		this.stratumServer.on("close", (error) => {
			this.logger.error('An error has occurred ' + error);
			this.events.emit(this.prefix+"close", this, error)
		});
		this.stratumServer.on("listening", (...argv) => {
			this.logger.success(`Opened server on ${this.logInfoServer(Logger.LOG_COLOR_MAGENTA, Logger.LOG_COLOR_GREEN)}`);
			this.events.emit(this.prefix + "listening", this, ...argv);
		});
		this.stratumServer.on("connection", (client) => {
			new StratumServerClient(Object.assign({}, this.options), this.events, client, this.logger);
			//this.events.emit(this.prefix+"connection", ...argv)
		});
	}
	
	logInfoServer(color, prevColor) {
		return `[${color}SSL ${this.options.ssl?"ON":"OFF"}${prevColor}] "${color}${this.options.bind_address}${prevColor}"`;
	}

}

class StratumServerClient {
	constructor(options, events, stratumServerClient, logger) {
		this.prefix = "stratum:server:worker:";
		this.options = Object.assign({}, options);
		this.events = events;
		this.id = Common.getGlobalUniqueId();
		this.logger = new Logger(logger, "WORKER #" + this.id);

		this.disconnected = false;

		this.stratumServerClient = stratumServerClient;

		
		this.logger.notice(`Accepted worker`);
		
		this.stratumServerClient.on("disconnect", (...argv) => this.events.emit(this.prefix+"disconnect", this, ...argv));
		this.stratumServerClient.on("close", (error) => {
			if ( error ) {
				this.logger.error("Worker error: " + error);
			} else {
				this.logger.notice("Worker disconnected");
			}
			this.events.emit(this.prefix+"close", this, error);
		});
		this.stratumServerClient.on("share", this.onShare.bind(this));
		
		this.stratumServerClient.on("authorize", (info) => {
			this.wallet_address = info.login;
			this.pool_password = info.password;
			this.events.emit(this.prefix+"authorize", this);
		});
		
		this.address = this.stratumServerClient.jsonRpcClient.net.socket.remoteAddress+":"+this.stratumServerClient.jsonRpcClient.net.socket.remotePort;

		this.agent = "";
		this.wallet_address   = "";
		this.pool_password = "";
		this.difficulty = null;
		this.target = null;
		this.hashes = 0;
		this.shares = 0;
		this.job = null;
		this.pool_target = 0;
		this.start_difficulty = this.options.start_difficulty || 10000;
		
		this.hashRate = new HashRate.HashRate();
		this.hashRateLast = new HashRate.HashRateLast(10);
		
		this.jobs_pools = [];
		this.jobs_workers = [];

		this.startTime = Common.currTimeMiliSec();
		
		this.connectionTime = Common.currTimeSec();

		
		
		
		this.events.emit(this.prefix + "connect", this);
	}
	
	onShare(share) {
		let shareWorker = share.copy();
		let sharePool = share.copy();
		
		let jobsForWorker = this.jobs_workers.
			filter(job => (job.job.job_id === shareWorker.job_id) && (job.job.extranonce2_size === (shareWorker.extranonce2.length/2)));
			
		if ( !jobsForWorker.length ) {
			this.logger.warning("Worker send bad share");
			return;
		}
		
		let jobForWorker = jobsForWorker.find(job => job.block_job.testShare(shareWorker));
		if ( !jobForWorker ) {
			let wrapperShareWorker = new StratumStructures.Share(Common.getGlobalUniqueId(), this.id, jobsForWorker[jobsForWorker.length-1], shareWorker);
			this.events.emit(this.prefix+"rejected_share", this, wrapperShareWorker, "");
			return;
		}
		let wrapperShareWorker = new StratumStructures.Share(Common.getGlobalUniqueId(), this.id, jobForWorker, shareWorker);
		this.events.emit(this.prefix+"accepted_share", this, wrapperShareWorker);
		//console.log("Worker share")
		
		sharePool.extranonce2 += jobForWorker._extranonce2_postfix;
		
		let jobForPool = this.jobs_pools.
			filter(job => (job.job_id === jobForWorker.job_id) && (job.job.extranonce2_size === (sharePool.extranonce2.length/2))).
			find(job => job.block_job.testShare(sharePool));
		let wrapperSharePool = new StratumStructures.Share(Common.getGlobalUniqueId(), this.id, jobForPool, sharePool);

		if ( !jobForPool ) {
			return;
		}
		this.events.emit(this.prefix+"share", this, wrapperSharePool);
		//console.log("Pool share")
	}

	close(error) {
		this.stratumServerClient.close(error);
	}

	setJob(origJob) {
		if ( origJob.job.clean_jobs ) {
			this.jobs_pools = [];
			this.jobs_workers = [];			
		}
		
		let jobForPool   = origJob.copy();
		let jobForWorker = origJob.copy();
		
		this.jobs_pools.push(jobForPool);
		this.jobs_workers.push(jobForWorker);

		jobForWorker.job.difficulty = this.filterDifficulty(jobForWorker.job.difficulty, this.options.min_difficulty, this.options.max_difficulty);
		jobForWorker._extranonce2_postfix = this.filterExtranonce2(jobForWorker.job, this.options.max_extranonce2_size);
		jobForWorker.update();

		this.stratumServerClient.setJob(jobForWorker.job);
		
		this.events.emit(this.prefix+"accepted_job", this, jobForWorker);
	}
	
	filterDifficulty(difficulty, min, max) {
		if ( min ) { difficulty = Math.max(difficulty, min); }
		if ( max ) { difficulty = Math.min(difficulty, max); }
		return difficulty;
	}
	filterExtranonce2(job, max_extranonce2_size) {
		let extranonce2_postfix = "";
		
		if ( max_extranonce2_size && (job.extranonce2_size > max_extranonce2_size) ) {
			extranonce2_postfix = "00".repeat(job.extranonce2_size - max_extranonce2_size);
			job.extranonce2_size = max_extranonce2_size;
			job.coinb2 = extranonce2_postfix + job.coinb2;
		}
		
		return extranonce2_postfix;
	}
}

module.exports = StratumServer;
