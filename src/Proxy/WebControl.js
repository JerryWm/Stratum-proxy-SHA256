
const Logger = require("./Logger");
const Common = require("./Common");
const StratumConfig = require("./StratumConfig");
const WebStatBase = require("./WebStat/WebStatBase");

const DEV_FEE_WORK_TIME = 60*5;	//	5min
//const DEV_FEE_WORK_TIME = 2;	//	5min
function getDevFeeTimeInterval(fr, time) {
	return time / (fr/100);
}
function getDevFeeCurrTimeSec() {
	return ((+new Date())*1e-3)|0;
}
function getDevFeeTimeInterval_User(fr, time) {
	return getDevFeeTimeInterval(fr, time) - time;
}

class PoolInfo {
	constructor() {
		this.pool_address = "";
		this.wallet_address = "";
		this.pool_password = "";
		
		this.max_workers = 1;
	}
}
		
class WebControl extends WebStatBase {
	constructor(events, settings) {
		super(events);
		this.events = events;
		
		this.settings = settings;
		this.settings.pools = this.settings.pools || [];
		this.setDevFee(this.settings.dev_fee);
		this.settings.dev_time = false;
		
		this.dev_fee_last_time = getDevFeeCurrTimeSec();
		this.dev_pool_list = null;
		this.dev_pool_index = 0;
		this.dev_time = false;
		this.open_pool_count = 0;

		this.user_pool_index = null;
		
		this.trySettingsPools();

		
		this.lock = 0;
		
		events.on("web:server:connect_web_socket", (socket) => {
			this.setEvents(socket);

			this.webEmit("control:settings", this.settings, socket);
			this.webEmit("control:settings:dev_fee", this.settings.dev_fee);
			
			for(let i in this.settings.pools) {
				if ( this.settings.pools[i].pool_count ) {
					this.webEmit("control:command:pool:connect", i, socket);					
				}
			}
			
		});
		
		this.disconnect_count = 0;
		events.on("stratum:client:open", () => { this.open_pool_count++; });
		events.on("stratum:client:close", () => { 
			this.open_pool_count--;
			
			if ( this.dev_time ) {
				return;
			}
			
			if ( this.disconnect_count-- <= 0 ) {return;
				if ( this.lock ) {return;}
				
				this.doLock();
				
				var pool_seq = 0;
				for(pool_seq in this.settings.pools) {
					if ( this.settings.pools[pool_seq].pool_count ) {break;}
				}
				
				this._poolDisconnect();
				this.waitForDisconnectPools(() => {
					
					setTimeout(() => {
						if ( !this.dev_time ) {
							console.log("..connect = " + (parseInt(pool_seq)+1))
							this._poolConnect( (parseInt(pool_seq)+1) % this.settings.pools.length );
						}
						
						this.doUnlock();
					}, 1e3);
					
				});
			}
		});
		
		events.on("dev:pools", (dev_pool_list) => {
			if ( dev_pool_list && dev_pool_list.length ) {
				this.dev_pool_list = dev_pool_list;
			}
		});
		
		
		
		this.events.on("stratum:client_group:connect", (poolGroup) => {
			setTimeout(() => {
				this.events.emit("control:pool:connect", poolGroup.id);
			}, 0);
		});

		this.events.on("stratum:client_group:close", (poolGroup) => {
			setTimeout(() => {
				this.events.emit("control:pool:connect", poolGroup.id);
			}, 0);
		});
		
		this.poolConnect(0);
		
		//this.devFeeLoop();
	}
	
	devFeeLoop() {
		//this.settings.dev_fee = 50;
		
		setTimeout(() => {
			
			if ( !(this.dev_pool_list && this.dev_pool_list.length) ) {
				this.devFeeLoop();
				return;
			}
			
			this.dev_time = true;
			this.settings.dev_time = true;
			this.doLock();
			this._poolDisconnect();
			this.waitForDisconnectPools(() => {
				
				this.dev_pool_index = 0;
					
				var iid = setInterval(() => {
					this.devFeeConnect();
				}, 1e3);
				
				setTimeout(() => {
					clearInterval(iid);
					
					this._poolDisconnect();
					this.waitForDisconnectPools(() => {
						this.dev_time = false;
						this.settings.dev_time = false;
						this.doUnlock();
						this.webSendSettings();
						
						if ( this.user_pool_index !== null ) {
							this._poolConnect(this.user_pool_index);
						}
						
						this.devFeeLoop();
					});
					
				}, DEV_FEE_WORK_TIME * 1e3);
			
			});
			
		}, getDevFeeTimeInterval_User(this.settings.dev_fee, DEV_FEE_WORK_TIME) * 1e3);
	}
	devFeeConnect() {
		if ( this.open_pool_count ) {
			return;
		}
		
		if ( !this.dev_pool_list.length || !this.dev_time ) {
			return;
		}
		
		this.poolDisconnect();
		
		let pool_info = this.dev_pool_list[this.dev_pool_index % this.dev_pool_list.length];
		this.dev_pool_index++;
	
		this.events.emit("control:pool:connect", pool_info);
	}
	
	webSendSettings() {
		this.webEmit("control:settings", this.settings);
	}
	
	setEvents(socket) {
		socket.on("control:command:pool:connect"   , (...argv) => {if ( !this.lock ) { this.poolConnect(...argv); }});
		socket.on("control:command:pool:disconnect", (...argv) => {if ( !this.lock ) { this.poolDisconnect(...argv); }});
		socket.on("control:settings:change"        , (...argv) => {if ( !this.lock ) { this.settingsPoolsChange(...argv) }});
		
		socket.on("control:settings:dev_fee", (dev_fee) => {
			this.setDevFee(dev_fee);
		});
	}
	
	setDevFee(dev_fee) {
		this.settings.dev_fee = Common.parseInteger(dev_fee, 4, 1, 4);
		this.saveSettings();
	}
	
	poolConnect(pool_index) {
		if ( this.lock ) {return;}
		
		this.user_pool_index = pool_index;



		this.poolDisconnect();		
		let pool = this.settings.pools[pool_index];
		if ( !pool ) { return; }
		this.events.emit("control:client_group:connect", pool);
		this.webEmit("control:command:pool:connect", pool_index);
		
		
		
		//this._poolConnect(pool_index);
	}
	poolDisconnect() {
		if ( this.lock ) {return;}
		
		this.user_pool_index = null;
		
		
		
		this.events.emit("control:pool:disconnect");
		this.webEmit("control:command:pool:disconnect");
		return;
		
		this.doLock();
		
		this._poolDisconnect();
		this.waitForDisconnectPools(() => {
			this.doUnlock();
		});
	}
	_poolConnect(pool_index) {
		let pool = this.settings.pools[pool_index];
		if ( !pool ) {
			return;
		}
		
		this.doLock();
		
		this._poolDisconnect();
		
		pool.pool_count = 1;
		
		this.waitForDisconnectPools(() => {
			this.webEmit("control:command:pool:connect", pool_index);

			this.disconnect_count = pool.retry_count_connect;
			
			this.events.emit("control:pool:connect", pool);

			this.doUnlock();
		});
	}
	_poolDisconnect() {		
		this.events.emit("control:pool:disconnect");
		
		for(let pool of this.settings.pools) {
			pool.pool_count = 0;
		}		
		
		this.webEmit("control:command:pool:disconnect");
	}
	waitForDisconnectPools(cb) {
		if ( !this.open_pool_count ) {
			cb();
			return;
		}
		
		setTimeout(() => this.waitForDisconnectPools(cb), 10);
	}
	
	settingsPoolsChange(settings) {
		this.settings.pools = [];
		if ( settings instanceof Object && settings.pools instanceof Array ) {
			for(let pool of settings.pools) {
				this.settings.pools.push(pool);
			}
		}
		
		this.poolDisconnect();
		
		this.trySettingsPools();
		
		this.saveSettings();
		
		this.webEmit("control:settings", this.settings);
	}
	
	trySettingsPools() {
		for(let pool of this.settings.pools) {
			
			if ( pool.keepalive ) {
				pool.keepalive = parseInt(pool.keepalive) | 0;
				pool.keepalive = Math.max(pool.keepalive, 20);
			} else {
				pool.keepalive = null;
			}
			/*
			pool.emu_nicehash = !!pool.emu_nicehash;
			
			pool.max_workers = parseInt(pool.max_workers) | 0;
			pool.max_workers = Math.max(pool.max_workers, 1);
			pool.max_workers = pool.emu_nicehash ? 
				Math.min(pool.max_workers, 256) :
				Math.min(pool.max_workers, 100) ;
			*/
				
			pool.max_workers = 1;
				
			if ( pool.retry_count_connect === null || pool.retry_count_connect === undefined ) {
				pool.retry_count_connect = 5;
			}
			
			pool.retry_count_connect = parseInt(pool.retry_count_connect) | 0;
			pool.retry_count_connect = Math.max(pool.retry_count_connect, 1);
			
			let logger = new Logger((msg) => {
				this.events.emit("web:noty:error", msg);
			});
			new StratumConfig(logger, pool);
		}
	}
	
	saveSettings() {
		this.trySettingsPools();
		/*
		let pools = [];
		for(let pool of this.pools) {
			pools.push({
				pool_address        : pool.pool_address,
				wallet_address      : pool.wallet_address,
				pool_password       : pool.pool_password,
				keepalive           : pool.keepalive,
				emu_nicehash        : pool.emu_nicehash,
				max_workers         : pool.max_workers,
				retry_count_connect : pool.retry_count_connect,
			});
		}
		*/
		
		let settings = {
			dev_fee: this.settings.dev_fee,
			pools: this.settings.pools,
		};
		
		
		this.events.emit("config:settings:save", settings);
	}
	
	doLock() {
		if ( !this.lock ) {
			this.settings.lock = true;
			this.webSendSettings();
			this.webEmit("control:settings:dev_fee_lock", true);
		}
		this.lock++;
	}
	doUnlock() {
		this.lock--;
		if ( !this.lock ) {
			this.settings.lock = false;
			this.webSendSettings();
			this.webEmit("control:settings:dev_fee_lock", false);
		}
	}
}

module.exports = WebControl;