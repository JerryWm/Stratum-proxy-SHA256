
const EventEmitter = require("events").EventEmitter;

const fs = require("fs");

const Logger = require("./Logger");
const Common = require("./Common");
const CommonCrypto = require('./CommonCrypto');
const HashRate = require("./HashRate");
const StratumConfig = require("./StratumConfig");
const StratumCommon = require("./StratumCommon");

const Block = require("./Block");

const spawn = require('child_process').spawn;


const ShareStratumClient = require("./../Share/Stratum/StratumClient");

const StratumStructures = require("./StratumStructures");


class SetIntervalMng {
	constructor(timeInterval) {
		this.list = [];
		this.iid = setInterval(this.frame.bind(this), timeInterval);
	}
	
	frame() {
		for(let cb of this.list) {
			cb();
		}
	}
	
	on(cb) {
		this.list.push(cb);
	}
	close() {
		clearInterval(this.iid);
	}
}


class StratumClient {	
	/**
	{
		EventEmitter {
			stratum:client:open
			stratum:client:close
			stratum:client:connect
			stratum:client:disconnect
			stratum:client:ping
			stratum:client:accepted_job
			stratum:client:accepted_share
			stratum:client:rejected_share
		}
	}
	*/
	constructor(options, events, logger) {
		this.prefix = "stratum:client:";
		this.events = events;
		this.id = Common.getGlobalUniqueId();
		
		this.logger = new Logger(logger, "STRATUM-CLIENT #" + this.id);

		
		this.events.emit(this.prefix + "open", this);
		this.pool = new StratumConfig(this.logger, options);
		if ( !this.pool.valid ) {
			this.events.emit(this.prefix + "close", this);
			return;
		}
		
		
		this.jobs = Object.create(null);
		this.shares_unique = [];
		this.job = null;
		
		
		
		this.logger.notice("Attempting to connect to "+this.logPoolInfo(Logger.LOG_COLOR_MAGENTA_LIGHT, Logger.LOG_COLOR_GRAY));

		this.stratum = new ShareStratumClient({
			address: options.pool_address,
			login: options.wallet_address,
			password: options.pool_password,
		});
		
		this.stratum.on("connect"   , (...argv) => {
			this.logger.success('Connected to ' + this.logPoolInfo(Logger.LOG_COLOR_MAGENTA, Logger.LOG_COLOR_GREEN));
			this.events.emit(this.prefix+"connect"   , this, ...argv);
		});
		this.stratum.on("disconnect", (...argv) => {this.events.emit(this.prefix+"disconnect", this, ...argv);});
		this.stratum.on("close"     , (error) => {
			if ( error ) {
				this.logger.error(error);
			} else {
				this.logger.notice("Close");
			}
			this.events.emit(this.prefix+"close"     , this, error);
		});
		this.stratum.on("job", (job) => {
			job = job.copy();
			
			if ( job.clean_jobs ) {
				this.jobs = Object.create(null);
				this.shares_unique = [];
			}
			
			let id = Common.getGlobalUniqueId();

			let pool_job = new StratumStructures.Job(id, this.id, job, Block.JobSha256d);
			
			this.jobs[ id ] = pool_job;
			this.job = pool_job;
			
			//console.log("keys(this.jobs).length: "+Object.keys(this.jobs).length);
			//console.log(pool_job.job.extranonce2_size);
			
			this.events.emit(this.prefix+"accepted_job", this, pool_job);
		});
		
		
		this.difficulty = null;
		
		this.accepted_job_count = 0;
		this.accepted_share_count = 0;
		this.rejected_share_count = 0;
		this.share_count = 0;
		this.hash_count = 0;
		
		this.job = null;
		
		
		
		
		this.lastShareUpdateTime = Common.currTimeMiliSec();
		
		this.hashRate = new HashRate.HashRate();
		this.hashRateLast = new HashRate.HashRateLast();
	}
	
	getJob() {
		return this.job;
	}
	submitShare(share) {
		if ( !this.jobs[share.job_id] ) {
			return;
		}
		
		let shareUnique = `${share.share.extranonce2}-${share.share.ntime}-${share.share.nonce}`;
		if ( this.shares_unique.indexOf(shareUnique) >= 0 ) {
			this.events.emit(this.prefix+"rejected_share", this, share, "Proxy lvl. Duplicate share");
			return;
		}
		this.shares_unique.push(shareUnique);
		
		this.stratum.submit(share.share, (accepted, error) => {
			if ( accepted ) {
				this.events.emit(this.prefix+"accepted_share", this, share);
			} else {
				this.events.emit(this.prefix+"rejected_share", this, share, error);
			}
		});
	}
	
	logPoolInfo(colorSelect, colorNormal) {
		return '['+colorSelect+(this.pool.ssl?"SSL ON":"SSL OFF")+colorNormal+'] ' + 
			'[' + colorSelect + (this.pool.keepalive?"KPALV "+(this.pool.keepalive*1e-3):"KPALV OFF") +colorNormal+'] ' +
			'[' + colorSelect + ("RSP TO "+(this.pool.response_timeout*1e-3)) +colorNormal+ '] ' +
			'"'+colorSelect+ this.pool.host+':'+this.pool.port +colorNormal+'" ' ;
	}
	
	disconnect(error) {
		this.close(error);
	}
	close(error) {
		if ( this.stratum ) {
			this.stratum.close(error);
			//this.stratum = null;
			return;
		}
	}
	
	

	logErrorDisconnect(err, disconnect = true) {
		this.logger.error(err);
		if ( disconnect ) {
			this.disconnect(err);
		}
		return false;
	}

	jobIdToLog(id) {
		const MAXLEN = 32;
		
		if ( id.length <= MAXLEN ) {
			return id;
		}
		
		return id.slice(0, MAXLEN>>1) + "..." + id.slice(-(MAXLEN>>1));
	}
	
}








module.exports = StratumClient;
