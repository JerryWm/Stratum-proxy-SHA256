
const EventEmitter = require("events").EventEmitter;

const NetServer = require("./../Net/NetServer");

const JsonRpcClient = require("./../JsonRpc/JsonRpcClient");

const Common = require('./../Common/Common');

const Filter = require('./../Common/Filter');

const StratumStructures = require("./StratumStructures");

const filter_authorize = {
	type: "array",
	items: [
		{type: "string", min_length: 0, error_template: "invalid login ({{error}})"},
		{type: "string", min_length: 0, error_template: "invalid password ({{error}})"},
	],
	error_template: "invalid authorize data ({{error}})"
};
const filter_submit = {
	type: "array",
	items: [
		{type: "string", min_length: 0, error_template: "invalid login ({{error}})"},
		{type: "string", min_length: 1, error_template: "invalid job_id ({{error}})"},
		{type: "hex", min_length: 1, error_template: "invalid extranonce2 ({{error}})"},
		{type: "hex", length: 4, error_template: "invalid ntime ({{error}})"},
		{type: "hex", length: 4, error_template: "invalid nonce ({{error}})"},
	],
	error_template: "invalid submit data ({{error}})"
};

const STATE_STRATUM_BASE = 1;
const STATE_STRATUM_SUBSCRIBE = 2;
const STATE_STRATUM_AUTHORIZE = 3;

const DEF_DIFFICULTY = 1024*1024;
const DEF_NOTIFY = {
	
};

class StratumServer extends EventEmitter {
	constructor(options) {
		super();
		
		this.net = new NetServer(options);
		
		this.net.on("open", (...argv) => this.emit("open", ...argv));
		this.net.on("close", (...argv) => this.emit("close", ...argv));
		this.net.on("listening", (...argv) => this.emit("listening", ...argv));
		this.net.on("connection", (client) => {
			let jsonRpcClient = new JsonRpcClient(client);
			let stratumServerClient = new StratumServerClient(jsonRpcClient, options);
			
			this.emit("connection", stratumServerClient);
		});	
	}
}

class StratumServerClient extends EventEmitter {
	constructor(jsonRpcClient,  options) {
		super();
		
		this.options = Object.assign({}, options);
		
		this.login = null;
		this.password = null;
		
		this.extranonce1 = null;
		this.extranonce2_size = null;
		this.difficulty = null;
		this.job = null;
		
		this.state = STATE_STRATUM_BASE;
		
		
		this.jsonRpcClient = jsonRpcClient;
		
		
		
		
		jsonRpcClient.on("disconnect", (...argv) => this.emit("disconnect", ...argv));
		jsonRpcClient.on("close", (...argv) => this.emit("close", ...argv));
		
		jsonRpcClient.on("call", (method, params, cbResult) => {
			switch(method) {
				
				case "mining.subscribe":
					cbResult([
						[],
						this.extranonce1 !== null ? this.extranonce1 : "00000000",
						this.extranonce2_size !== null ? this.extranonce2_size : 4,
					]);
					
					if ( this.extranonce1 === null || this.extranonce2_size === null || this.difficulty === null ) {
					//	this.jsonRpcClient.sendNotify("client.reconnect", []);
					//	this.close("Pool not ready");
					}
					
					this.state = STATE_STRATUM_SUBSCRIBE;
					break;
					
				case "mining.authorize":
					if ( !this.filterOrClose(params, filter_authorize) ) {
						break;
					}
					
					this.login = params[0];
					this.password = params[1];
					this.emit("authorize", {
						login: this.login,
						password: this.password,
					});
					
					cbResult(true);
					
					this.state = STATE_STRATUM_AUTHORIZE;
					
					if ( this.difficulty ) {
						this.sendNotify("mining.set_difficulty", [this.difficulty]);
						if ( this.job ) {
							this.sendNotify("mining.notify", this.job);
						}
					}
					
					break;
				
				case "mining.submit":
					if ( !this.filterOrClose(params, filter_submit) ) {
						break;
					}
					
					cbResult(true);
					
					let share = new StratumStructures.Share({
						login: params[0],
						job_id: params[1],
						extranonce2: params[2],
						ntime: params[3],
						nonce: params[4],
					});
					
					this.emit("share", share);
					break;
				
				default:
					// TODO
					console.log(`Worker send: Unk. method "${method}"`);
					break;
				
			}
		});
	}
	
	setExtranonce(extranonce1, extranonce2_size) {
		this.extranonce1 = extranonce1;
		this.extranonce2_size = extranonce2_size;
	}
	setDifficulty(difficulty) {
		this.difficulty = difficulty;
	}
	setJob(job) {
		if ( this.extranonce1 === null ) { this.extranonce1 = job.extranonce1; }
		if ( this.extranonce2_size === null ) { this.extranonce2_size = job.extranonce2_size; }
		if ( this.difficulty === null ) { this.difficulty = job.difficulty; }
		
		if ( (this.extranonce1 !== job.extranonce1) || 
				(this.extranonce2_size !== job.extranonce2_size) ) {
					
			this.reconnect("Proxy lv. Change extranonce1 or extranonce2_size. Reconnect");
			return;
		}
		
		if ( Math.abs(this.difficulty - job.difficulty) > 0.001 ) {
			this.sendNotify("mining.set_difficulty", [job.difficulty]);
		}
		this.difficulty = job.difficulty;
		
		this.job = [
			job.job_id,
			job.prevhash,
			job.coinb1,
			job.coinb2,
			job.merkle_branch,
			job.version,
			job.nbits,
			job.ntime,
			job.clean_jobs,
		];
		
		this.sendNotify("mining.notify", this.job);
	}
	
	reconnect(error) {
		this.jsonRpcClient.sendNotify("client.reconnect", []);
		this.close(error);
	}
	
	sendNotify(method, params) {
		if ( this.state !== STATE_STRATUM_AUTHORIZE ) {
			return;
		}
		
		this.jsonRpcClient.sendNotify(method, params);
	}
	
	filterOrClose(x, filter, error) {
		try {
			Filter.filter(x, filter);
		} catch(e) {
			this.close(e.message);
			return false;
		}

		return true;
	}
	
	close(error) {
		this.jsonRpcClient.close(error);
	}
	disconnect(error) {
		this.close(error);
	}
}

module.exports = StratumServer;
