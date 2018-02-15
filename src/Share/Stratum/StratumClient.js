
const EventEmitter = require('events').EventEmitter;

const JsonRpcClient = require('./../JsonRpc/JsonRpcClient');

const Common = require('./../Common/Common');

const Filter = require('./../Common/Filter');

const StratumStructures = require("./StratumStructures");

/**
	options: {
		address: "tcp://127.0.0.1:2222",
		login: "x",
		password: "x",
	}
	
	events:
		open
		close
		
		connect
		disconnect
		
		job
*/

const _filter_extranonce1 = {type: "hex", error_template: "invalid extranonce1 ({{error}})"};
const _filter_extranonce2_size = {type: "number", min: 2, max: 32, error_template: "invalid extranonce2 size ({{error}})"};

const filter_notify = {
	type: "array",
	items: [
		{type: "string", min_length: 1, max_length: 64, error_template: "invalid job_id ({{error}})"},
		{type: "hex", length: 32, error_template: "invalid prevhash ({{error}})"},
		{type: "hex", min_length: 1, max_length: 1024*1024, error_template: "invalid coinb1 ({{error}})"},
		{type: "hex", min_length: 1, max_length: 1024*1024, error_template: "invalid coinb2 ({{error}})"},
		{type: "array", item_type: {type: "hex", length: 32, length: 32, error_template: "invalid merkle ({{error}})"}},
		{type: "hex", length: 4, error_template: "invalid version ({{error}})"},
		{type: "hex", length: 4, error_template: "invalid nbits ({{error}})"},
		{type: "hex", length: 4, error_template: "invalid ntime ({{error}})"},
		{type: "any", length: 4, error_template: "invalid clean_jobs ({{error}})"},
	],
	error_template: "invalid job data ({{error}})"
};
const filter_subscribe_response = {
	type: "array",
	items: [
		{type: "any", error_template: "invalid subscribe rsp #1 ({{error}})"},
		_filter_extranonce1,
		_filter_extranonce2_size,		
	],
	error_template: "invalid subscribe response data ({{error}})"
};
const filter_authorize_authorize = {
	type: "any", 
	error_template: "invalid authorize rsp #1 ({{error}})",
	error_template: "invalid authorize response data ({{error}})"
};
const filter_set_difficulty = {
	type: "array",
	items: [
		{type: "number", min: 0, error_template: "invalid difficulty ({{error}})"},
	],
	error_template: "invalid set_difficulty data ({{error}})"
};
const filter_set_extranonce = {
	type: "array",
	items: [
		_filter_extranonce1,
		_filter_extranonce2_size,	
	],
	error_template: "invalid set_extranonce data ({{error}})"
};
const filter_error = {
	type: "array",
	items: [
		{type: "number", error_template: "invalid error code ({{error}})"},
		{type: "string", error_template: "invalid error text ({{error}})"},
		{type: "any", error_template: "invalid error ({{error}})"},
	],
	error_template: "invalid result error data ({{error}})"
};

class StratumClient extends EventEmitter {
	constructor(options) {
		super();

		this.options = {
			address : String(options.address || "").trim().replace(/^stratum\+/, ''),
			login   : String(options.login || ""),
			password: String(options.password || ""),
		};
		
		this.jsonRpc = new JsonRpcClient(this.options.address);

		this.jsonRpc.on("open"      , (...params) => this.emit("open"      , ...params));
		this.jsonRpc.on("close"     , (...params) => this.emit("close"     , ...params));
		this.jsonRpc.on("connect"   , (...params) => this.emit("connect"   , ...params));
		this.jsonRpc.on("disconnect", (...params) => this.emit("disconnect", ...params));
		
		this.jsonRpc.on("notify", this.onNotify.bind(this));
		
		///---------------
		this.difficulty = 1.0;
		this.extranonce1 = null;
		this.extranonce2_size = null;
		
		this.job = null;
		///---------------
		
		///---------------
		this.once_subscribe_response = false;
		this.once_authorize = false;
		this.once_set_difficulty = false;
		this.once_job = false;
		this.once_emit_ready = false;
		this.isReady = () => {
			return this.once_subscribe_response && this.once_authorize && this.once_set_difficulty && this.once_job;
		}
		this.emitReady = () => {
			if ( this.isReady() ) {
				if ( this.once_emit_ready ) { return; }
				this.once_emit_ready = true;
				this.emit("ready");
			}
		}
		///---------------
		
		

		this.jsonRpc.on("connect", () => {
			
			this.subscribe((result, error) => {
				if ( !this.filterOrClose(result, filter_subscribe_response, error) ) {
					return;
				}

				this.onNotify_mining_set_extranonce([result[1], result[2]]);
				//this.extranonce1 = result[1];
				//this.extranonce2_size = parseInt(result[2]);
				
				this.once_subscribe_response = true;
				this.emit("subscribe_response", true);
				this.emitReady();

				this.authorize(this.options.login, this.options.password, (result, error) => {
					if ( error ) {
						this.close(this.errorToString(error));
						return;
					}
					
					if ( !result ) {
						if ( !(result === null && error === null) ) {
							this.close(`Authentication failed. May be incorrect login(${options.login}) or password(${options.password})`);
							return;							
						}
					}
						
					this.once_authorize = true;
					this.emit("authorize", true);
					this.emitReady();
		
					this.subscribe_extranonce((result, error, timeoutError) => {
						if ( result ) {
							this.emit("support:set_extranonce", true);
						} else {
							this.emit("support:set_extranonce", false);
						}
					});
				});
			});
			
		});
		
		this.jsonRpc.on("call", (method, params, cbResponse) => {
			switch(method) {
				case "mining.ping":
					cbResponse("pong");
					break;
					
				case "mining.set_difficulty":
					cbResponse(true);
					this.onNotify_mining_set_difficulty(params);
					break;
					
				case "mining.notify":
					cbResponse(true);
					this.onNotify_mining_notify(params);
					break;
					
				case "mining.set_extranonce":
					cbResponse(true);
					this.onNotify_mining_set_extranonce(params);
					break;
					
				default:
					// TODO
					console.log(`Pool send: Unk. method "${method}"`);
					break;
			}
		});
	}
	
	close(err) {
		this.jsonRpc.close(err);
	}
	
	subscribe(onResult) {
		this.jsonRpc.sendMethod("mining.subscribe", [], onResult);
	}
	authorize(login, password, onResult) {
		this.jsonRpc.sendMethod("mining.authorize", [login, password], onResult);
	}
	submit(share, onResult) {
		this.jsonRpc.sendMethod("mining.submit", [
			this.options.login,
			share.job_id,
			share.extranonce2,
			share.ntime,
			share.nonce
		], onResult);
	}
	subscribe_extranonce(onResult) {
		this.jsonRpc.sendMethod("mining.extranonce.subscribe", [], onResult, false);
	}
	
	filterOrClose(x, filter, error) {
		if ( error ) {
			this.close(this.errorToString(error));
			return false;
		}
		
		try {
			Filter.filter(x, filter);
		} catch(e) {
			this.close(e.message);
			return false;
		}

		return true;
	}
	
	errorToString(error) {
		try {
			Filter.filter(error, filter_error);
		} catch(e) {
			return e.message;
		}

		return `#${error[0]} ${error[1]}`;
	}
	
	onNotify(method, params) {
		switch(method) {
			case "mining.set_difficulty":
				this.onNotify_mining_set_difficulty(params);
				break;
				
			case "mining.notify":
				this.onNotify_mining_notify(params);
				break;
				
			case "mining.set_extranonce":
				this.onNotify_mining_set_extranonce(params);
				break;
				
			default:
				this.jsonRpc.close(`Pool send unknown method "${method}"`);
				break;
		}
	}
	onNotify_mining_set_difficulty(params) {
		if ( !this.filterOrClose(params, filter_set_difficulty) ) {
			return;
		}
		
		this.difficulty = parseFloat(params[0]);
		
		this.once_set_difficulty = true;
		this.emit("set_difficulty", this.difficulty);
		this.emitReady();
	}
	onNotify_mining_set_extranonce(params) {
		if ( !this.filterOrClose(params, filter_set_extranonce) ) {
			return;
		}
		
		this.extranonce1 = params[0];
		this.extranonce2_size = parseInt(params[1]);
		
		this.emit("set_extranonce", this.extranonce1, this.extranonce2_size);
	}
	onNotify_mining_notify(params) {
		if ( !this.filterOrClose(params, filter_notify) ) {
			return;
		}
		
		let job_id = params[0];
		let prevhash = params[1].toLowerCase();
		let coinb1 = params[2].toLowerCase();
		let coinb2 = params[3].toLowerCase();
		let merkle_branch = params[4].map(v => v.toLowerCase());
		let version = params[5].toLowerCase();
		let nbits = params[6].toLowerCase();
		let ntime = params[7].toLowerCase();
		let clean_jobs = !!params[8];
		
		this.job = new StratumStructures.Job({
			difficulty: this.difficulty,
			extranonce1: this.extranonce1,
			extranonce2_size: this.extranonce2_size,
			
			job_id: job_id,
			prevhash: prevhash,
			coinb1: coinb1,
			coinb2: coinb2,
			merkle_branch: merkle_branch,
			version: version,
			nbits: nbits,
			ntime: ntime,
			clean_jobs: clean_jobs,
		});
		
		this.once_job = true;
		this.emit("job", this.job);
		this.emitReady();
	}

	getJob() {
		return this.job;
	}
	submitShare(share, onResult) {
		this.submit(share, (result, error) => {
			if ( error ) {
				onResult(false, this.errorToString(error));
				return;
			}
			
			if ( !result ) {
				onResult(false, "Unk. error");
				return;
			}
			
			onResult(true);
		});
	}
}

module.exports = StratumClient;
