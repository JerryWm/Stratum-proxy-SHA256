
const EventEmitter = require("events").EventEmitter;

const Logger = require("./Logger");
const Common = require("./../Share/Common/Common");
const StratumConfig = require("./StratumConfig");
const WebStatBase = require("./WebStat/WebStatBase");

const StratumClientCheckConnect = require('./StratumClientCheckConnect');

const TEST_MODE = false;

if ( !TEST_MODE ) {
	var POOL_GROUP_CONNECT_TIME_INTERVAL_MILI_SEC = 5*60*1e3;	//	5min
	var DEV_FEE = 1;	//	1%
	var DEV_FEE_WORK_TIME = 60*5;	//	5min
} else {
	var POOL_GROUP_CONNECT_TIME_INTERVAL_MILI_SEC = 20e3;
	var DEV_FEE = 40;
	var DEV_FEE_WORK_TIME = 30;
}


function getDevFeeTimeInterval(fr, time) {
	return time / (fr/100);
}
function getDevFeeCurrTimeSec() {
	return ((+new Date())*1e-3)|0;
}
function getDevFeeTimeInterval_User(fr, time) {
	return getDevFeeTimeInterval(fr, time) - time;
}




function getUId() {
			var s = "id_";
			for(var i = 0; i < 32; i++) {
				s += Math.random().toString(36).substr(2, 1);
			}
			return s;
		}
function objectAssignSLine(dst, src) {
	for(let i in src) {
		if ( i.length >= 1 && i[0] === "_" ) {dst[i] = src[i];}
	}
}

class PoolGroupList {
	constructor(data) {
		if ( !(data instanceof Array) ) { data = []; }
		
		this.pool_group_list = [];
		
		for(let i in data) {
			this.pool_group_list.push(new PoolGroup(data[i]));
		}
		this.pool_group_list.sort((l,r) => {
			return l.height - r.height;
		});
		
		this.complete();
	}
	
	complete() {
		let id_list = Object.create(null);
		for(let i in this.pool_group_list) {
			let pool_group = this.pool_group_list[i];
			let id = pool_group.id;
			if ( id_list[id] ) {
				pool_group.id = id = getUId();
			}
			id_list[id] = true;
		
			for(let i in pool_group.pool_list) {
				let pool = pool_group.pool_list[i];
				let id = pool.id;
				if ( id_list[id] ) {
					pool.id = id = getUId();
				}
				id_list[id] = true;
			}
		}
		
		let once_active = true;
		this.pool_group_list.map(v => {
			if ( v.active && once_active ) {
				once_active = false;
			} else {
				v.active = false;
			}
		});
	}
	
	getPoolGroup(pool_group_id) {
		let pool_group = this.pool_group_list.find(v => v.id === pool_group_id);
		if ( pool_group ) {
			return pool_group;
		}
		
		return null;
	}
	getPool(pool_id) {
		for(let pool_group of this.pool_group_list) {
			for(let pool of pool_group.pool_list) {
				if ( pool.id === pool_id ) {
					return pool;
				}
			}
		}
		
		return null;
	}
	getPoolGroupActive() {
		return this.pool_group_list.find(v => v.active) || null;
	}
	
	disconnectAll() {
		this.pool_group_list.map(pg => {
			pg.active = false;
			pg._pool_group_state = "disconnected";
		});
	}
	
	toSave(method = "toSave") {
		return this.pool_group_list.map(v => v[method]());
	}
	
	toObj() {
		return this.toSave("toObj");
	}

	copy() {
		return new PoolGroupList(this.toObj());
	}
}
class PoolGroup {
	constructor(data) {
		data = data || {};
		if ( !(data.pool_list instanceof Array) ) { data.pool_list = []; }
		
		this.id = Common.parseString(data.id, "");
		this.height = Common.parseInteger(data.height, 0, 0, 999999);
		this.pool_group_name = Common.parseString(data.pool_group_name);
		this.active = !!data.active;
		this.pool_list = [];
		
		for(let i in data.pool_list) {
			this.pool_list.push(new Pool(data.pool_list[i]));
		}
		this.pool_list.sort((l,r) => {
			return l.height - r.height;
		});
		
		
		
		objectAssignSLine(this, data);
		this._show_pool_list = !!data._show_pool_list;
		this._pool_group_state = "disconnected";
		switch(data._pool_group_state) {
			case "connected":
				this._pool_group_state = "connected";
				break;
				
			default:
				this._pool_group_state = "disconnected";
				break;
		}
	}
	
	toSave(method = "toSave") {
		return {
			id: this.id,
			height: this.height,
			active: this.active,
			pool_group_name: this.pool_group_name,
			pool_list: this.pool_list.map(v => v[method]()),
		};
	}
	
	toObj() {
		let obj = this.toSave("toObj");
		
		objectAssignSLine(obj, this);
		
		return obj;
	}

	copy() {
		return new PoolGroup(this.toObj());
	}
}
class Pool {
	constructor(data) {
		data = data || {};
		data.pool = data.pool || {};

		this.id = Common.parseString(data.id, "");
		this.height = Common.parseInteger(data.height, 0, 0, 999999);

		this.pool = {};
		this.pool.address             = Common.parseString(data.pool.address);
		this.pool.login               = Common.parseString(data.pool.login);
		this.pool.password            = Common.parseString(data.pool.password);
		this.pool.retry_count_connect = Common.parseInteger(data.pool.retry_count_connect, 5, 1, 999999);
		
		objectAssignSLine(this, data);
		switch(data._pool_state) {
			case "connected":
				this._pool_state = "connected";
				break;
				
			default:
				this._pool_state = "disconnected";
				break;
		}
	}
	
	toSave() {
		return {
			id: this.id,
			height: this.height,
			pool: {
				address: this.pool.address,
				login: this.pool.login,
				password: this.pool.password,
				retry_count_connect: this.pool.retry_count_connect,
			}
		};
	}
	
	toObj() {
		let obj = this.toSave();
		
		objectAssignSLine(obj, this);
		
		return obj;
	}

	copy() {
		return new Pool(this.toObj());
	}
}
	
class ControlPoolMng {
	constructor(events, logger) {
		
		this.events = events;
		this.logger = logger;
		
		this.scg_list = Object.create(null);
		
		this.events.on("stratum:client_group:open"   , this.onStratumClientGroupOpen   .bind(this));
		this.events.on("stratum:client_group:connect", this.onStratumClientGroupConnect.bind(this));
		this.events.on("stratum:client_group:close"  , this.onStratumClientGroupClose  .bind(this));
	}

	getScg(origScg) {
		if ( origScg.pool_info && ("__pool_id" in origScg.pool_info) && this.scg_list[origScg.pool_info.__pool_id] ) {
			return this.scg_list[origScg.pool_info.__pool_id];
		}
		
		return null;
	}
	
	onStratumClientGroupOpen(origScg) {
		let scg = this.getScg(origScg); if ( !scg ) { return; }

		scg.orig_scg = origScg;
		scg.opened = true;
		scg.closed = false;

		scg.on_open.filter(v=>v).map(v => v(origScg));
	}
	onStratumClientGroupConnect(origScg) {
		let scg = this.getScg(origScg); if ( !scg ) { return; }
		
		scg.connected = true;
		scg.disconnected = false;
		
		this.events.emit("control:client_group:active", origScg.id);
		
		scg.on_connect.filter(v=>v).map(v => v(origScg));
	}
	onStratumClientGroupClose(origScg) {
		let scg = this.getScg(origScg); if ( !scg ) { return; }
		
		scg.opened = false;
		scg.connected = false;
		scg.disconnected = true;
		scg.closed = true;
		
		scg.on_close.filter(v=>v).map(v => v(origScg));
		
		delete this.scg_list[scg.id];
	}
	
	connectPool(id, pool, onOpen, onConnect, onClose) {
		let scg = this.scg_list[id];
		if ( scg ) {
			scg.on_connect.push(onClose);
			scg.on_close.push(onClose);
			return;
		}
		
		this._connectPool(id, pool, onOpen, onConnect, onClose);
	}
	disconnectPool(id, onClose, error = null) {
		let scg = this.scg_list[id];
		if ( !scg || scg.closed ) {
			onClose && onClose();
			return false;
		}

		scg.on_close.push(onClose);
		scg.orig_scg.close(error);
	}
	disconnectPoolAll(onClose, error = null) {
		if ( !Object.values(this.scg_list).filter(v => !v.closed).length ) {
			onClose && onClose();
			return;
		}
		
		let ids = [];
		for(let id in this.scg_list) {
			ids.push(id);
		}
		
		ids.map(id => this.disconnectPool(id, () => {
			if ( !Object.values(this.scg_list).filter(v => !v.closed).length ) {
				onClose && onClose();
			}
		}, error));
	}
	
	_connectPool(id, pool, onOpen, onConnect, onClose) {
		this.scg_list[id] = {
			id: id,
			opened: false,
			connected: false,
			disconnected: true,
			closed: false,
			orig_scg: null,
			
			on_open: [onOpen],
			on_connect: [onConnect],
			on_close: [onClose],
		};
		
		this.events.emit("control:client_group:connect", {
			pool_address       : pool.pool.address,
			wallet_address     : pool.pool.login,
			pool_password      : pool.pool.password,
			retry_count_connect: pool.pool.retry_count_connect,
			__pool_id          : id,
		});
	}
}

class ControlPoolGroupIns extends EventEmitter {
	constructor(pool_group, controlPoolMng, events, logger) {
		super();
	
		this.events = events;
		this.logger = logger;
		this.controlPoolMng = controlPoolMng;
		
		this.pool_group = pool_group.copy();
		
		this.pool_seq = 0;
		
		if ( !this.pool_group.pool_list.length ) {
			
		}
		
		this.closed = false;
		
		this.pools = Object.create(null);
		
		this.pool_connected = null;
		this.pool_connected_index = null;
		this.next = true;

		this.setTimeoutReconnectPoolGroup = new Common.SetTimeout(POOL_GROUP_CONNECT_TIME_INTERVAL_MILI_SEC);
		
		setImmediate(this.doConnectPoolList.bind(this));
	}

	doConnectPoolList() {
		if ( this.closed ) { return; }

		this.doConnectPoolListSelectLoop((pool, pool_index, pool_events) => {
			
			var doNext = () => {
				this.pool_connected = pool;
				this.pool_connected_index = pool_index;
					
				setTimeout(this.doConnectPoolList.bind(this), 1e3);
			}
			
			if ( this.pool_connected ) {
				this._poolDisconnect(this.pool_connected, () => {
					doNext();
				});
			} else {
				doNext();
			}

			pool_events.onclose = () => {
				this.pool_connected = null;
				this.pool_connected_index = null;
				setTimeout(() => {
					this.setTimeoutReconnectPoolGroup.beforeTimeout();
				}, 1e3);
			}
		});
		
	}
	
	doConnectPoolListSelectLoop(onConnect, onClose) {
		let len = this.pool_connected_index !== null ? this.pool_connected_index : this.pool_group.pool_list.length;
		
		this.doConnectPoolListSelect(len, onConnect, () => {
			(this.pool_connected ? this.setTimeoutReconnectPoolGroup.setTimeout.bind(this.setTimeoutReconnectPoolGroup) : setTimeout)(() => {
				this.doConnectPoolListSelectLoop(onConnect, onClose);
			});
		});
		
	}
	
	doConnectPoolListSelect(len, onConnect, onClose, pool_index = 0) {
		if ( this.closed ) { return; }
		
		if ( pool_index >= len ) {
			onClose();
			return;
		}
		
		let pool = this.pool_group.pool_list[pool_index];
		if ( !pool ) {
			onClose();
			return;
		}
		
		let pool_onClose_Change = () => {
			setTimeout(() => {
				this.doConnectPoolListSelect(len, onConnect, onClose, pool_index + 1);
			}, 1e3);
		};
		let pool_onClose = (...argv) => pool_onClose_Change(...argv);
		
		this._poolConnect(pool, () => {}, () => {
			let pool_events = {};
			pool_onClose_Change = () => {
				pool_events.onclose && pool_events.onclose();
			};
			
			onConnect(pool, pool_index, pool_events);
			
		}, pool_onClose);
	}
	
	
	_doConnectPoolList() {
		if ( this.closed ) { return; }
		
		var pools = [];
		for(let pool_index = 0; pool_index < this.pool_group.pool_list.length; pool_index++) {
			let pool = this.pool_group.pool_list[pool_index];
			
			if ( (this.pool_connected_index !== null) && pool_index >= this.pool_connected_index ) {
				break;
			}
			
			pools.push(pool);
		}
		
		var once_next = false;
		let next = (cc) => {
			if ( once_next ) { return; }
			if ( !cc ) {
				once_next = true;
				setTimeout(this.doConnectPoolList.bind(this), 5e3);
			}
		};
		
		let cc = pools.length;
		next(cc);
		
		for(let pool_index = 0; pool_index < pools.length; pool_index++) {
			let pool = pools[pool_index];

			((pool_index, pool) => {
				
				this._poolConnect(pool, (pool) => {				
				}, (pool) => {
					next(--cc);					
					
					if ( (this.pool_connected_index === null) || (pool_index < this.pool_connected_index) ) {
						this.pool_connected_index = pool_index;
						this.pool_connected = pool;
					}
					
					for(let i = this.pool_connected_index + 1; i < pools.length; i++) {
						this.controlPoolMng.disconnectPool(pools[i].id);
					}
					
				}, (pool) => {
					next(--cc);
					
					if ( pool_index === this.pool_connected_index ) {
						this.pool_connected_index = null;
						this.pool_connected = null;
					}
				});
			
			})(pool_index, pool);
		}
	}

	_poolConnect(pool, onOpen, onConnect, onClose) {
		this.pools[pool.id] = pool;
		
		this.controlPoolMng.connectPool(pool.id, pool, (scg) => {
			this.emit("pool:open", pool, scg);
			
			onOpen && onOpen(pool);
		}, (scg) => {
			this.emit("pool:connect", pool, scg);
			
			onConnect && onConnect(pool);
		}, (scg) => {
			this.emit("pool:close", pool, scg);
			
			onClose && onClose(pool);
			
			delete this.pools[pool.id];
		});
	}
	_poolDisconnect(pool, onClose) {
		this.controlPoolMng.disconnectPool(pool.id, onClose);
	}
	
	close(cb, error) {
		this.closed = true;
		
		let cc = Object.keys(this.pools).length;
		if ( !cc ) {
			cb && cb();
			return;
		}
		
		for(let id in this.pools) {
			this.controlPoolMng.disconnectPool(id, () => {
				if ( !--cc ) { 
					cb && cb();
				}
			}, error);
		}
	}
}

class ControlPoolGroup extends EventEmitter {
	constructor(controlPoolMng, events, logger) {
		super();

		this.events = events;
		this.logger = logger;
		
		this.controlPoolMng = controlPoolMng;
		
		this.pool_group = null;
		this.pool_index = 0;
		this.pool_group_active = false;
		
		this.pool_group_ins = null;
		

		this.onCloseAllPoolGroup = null;
		
		this.onPoolConnect = (pool, scg) => {
			this.emit("pool:connect", pool, scg);
		};
		this.onPoolClose = (pool, scg) => {
			this.emit("pool:close", pool, scg);
		};
	}

	connectPoolGroup(pool_group, cb) {
		let connect = () => {
			this.pool_group_ins = new ControlPoolGroupIns(pool_group, this.controlPoolMng, this.events, this.logger);
			this.pool_group_ins.once("pool:open", cb);			
			this.pool_group_ins.on("pool:connect", this.onPoolConnect);
			this.pool_group_ins.on("pool:close", this.onPoolClose);
		};
		
		this.disconnectPoolGroup(connect);
	}
	disconnectPoolGroup(cb) {
		if ( this.pool_group_ins ) {
			this.pool_group_ins.close(() => {
				this.pool_group_ins.removeListener("pool:connect", this.onPoolConnect);
				this.pool_group_ins.removeListener("pool:close", this.onPoolClose);
				this.pool_group_ins = null;
				cb && cb();
			}, "Switch pool group");
		} else {
			cb && cb();
		}
	}
}
	
class WebControlPoolGroupList extends WebStatBase {
	constructor(pool_group_list, events, logger) {
		super(events);
		
		this.events = events;
		this.logger = logger;
		
		this.lock = 0;
		
		this.pool_group_list = new PoolGroupList(pool_group_list);
		this.pool_group_list_lock = false;
		this.pool_group_list_update_lock = false;
	
	
		this.dev_fee = DEV_FEE;
		this.dev_time = false;
		this.dev_pool_group = null;
	
	
	
	
	
		this.controlPoolMng = new ControlPoolMng(this.events, this.logger);
		
		this.controlPoolGroup = new ControlPoolGroup(this.controlPoolMng, this.events, this.logger);
		this.controlPoolGroup.on("pool:connect", (pool, scg) => {
			pool = this.pool_group_list.getPool(pool.id);
			if ( pool ) {
				pool._pool_state = "connected";
				this.webUpateServerPoolGroupList();
			}
			
			this.events.emit("control:pool:connect", scg.id);
		});
		this.controlPoolGroup.on("pool:close", (pool, scg) => {
			pool = this.pool_group_list.getPool(pool.id);
			if ( pool ) {
				pool._pool_state = "disconnected";
				this.webUpateServerPoolGroupList();
			}
		});
		this.events.on("web:server:connect_web_socket", (socketIo) => {
			this.setSocketEvents(socketIo);

			this.webUpateServerPoolGroupList(socketIo);
			this.webUpateServerPoolGroupListLock(socketIo);
			this.webUpateServerDevTime(socketIo);
		});
	
		this.events.on("dev:pool_group", (dev_pool_group) => {
			this.dev_pool_group = new PoolGroup(dev_pool_group);
		});
	
	
		this.devFeeLoop();
		
		this.doLockWait(() => {
			this.connectPoolGroupActive(() => this.doUnLock(), () => this.doUnLock());
		});
	}
	
	setSocketEvents(socketIo) {
		socketIo.on("web:control:client:settings:pool_group_list:update"       , this.webOnPoolGroupListUpdate.bind(this));
		socketIo.on("web:control:client:settings:pool_group:pool:check_connect", this.webOnPoolGroupPoolCheckConnect.bind(this));
		socketIo.on("web:control:client:settings:pool_group:connect"           , this.webOnPoolGroupConnect.bind(this));
		socketIo.on("web:control:client:settings:pool_group:disconnect"        , this.webOnPoolGroupDisconnect.bind(this));
	}
	
	webOnPoolGroupListUpdate(pool_group_list) {
		if ( this.lock ) { return; }
		if ( this.pool_group_list_update_lock ) { return; }
		this.doLock();
		
			this._webOnPoolGroupDisconnect(() => {
				this.pool_group_list = new PoolGroupList(pool_group_list);
				this.pool_group_list.disconnectAll();
				this.savePoolGroupList();
				this.webUpateServerPoolGroupList();
				
				this.doUnLock();
				
			});
	}
	webOnPoolGroupPoolCheckConnect(pool_group_id, pool_id) {
		if ( this.lock ) { return; }
		if ( this.pool_group_list_update_lock ) { return; }
		this.doLock();

			this._webOnPoolGroupDisconnect(() => {
		
				let pool = this.pool_group_list.getPool(pool_id);
				if ( !pool ) {
					this.doUnLock();
					return;
				}
				
				(new StratumClientCheckConnect({
					pool_address  : pool.pool.address,
					wallet_address: pool.pool.login,
					pool_password : pool.pool_password,
				}, this.logger)).on("info:close", (result, error) => {
					this.webEmit("web:control:server:settings:pool_group:pool:check_connect", {
						pool_group_id: pool_group_id, 
						pool_id: pool_id,
						result: result, 
						error: error
					});
					this.doUnLock();				
				});
				
			});
	}
	webOnPoolGroupConnect(pool_group_id) {
		if ( this.lock ) { return; }
		this.doLock();
		
			this._webOnPoolGroupDisconnect(() => {

				let pool_group = this.pool_group_list.getPoolGroup(pool_group_id);
				if ( !pool_group || !pool_group.pool_list.length ) {
					this.doUnLock();
					return;
				}
				
				pool_group.active = true;
				this.savePoolGroupList();
				
				this.connectPoolGroup(pool_group, () => {
					this.doUnLock();
				});				
				
			});
	}
	webOnPoolGroupDisconnect() {
		if ( this.lock ) { return; }
		
		this._webOnPoolGroupDisconnect(() => 0);
	}
	_webOnPoolGroupDisconnect(cb) {
		this.doLock();

			
		this.pool_group_list.disconnectAll();
		this.savePoolGroupList();
			
		this.controlPoolGroup.disconnectPoolGroup(() => {
				
			this.pool_group_list_update_lock = false;
			this.webUpateServerPoolGroupList();
			this.doUnLock();
			cb && cb();
		});
	}
	
	webUpateServerPoolGroupList(socketIo) {
		this.webEmit("web:control:server:settings:pool_group_list:update", this.pool_group_list.toObj(), socketIo);
	}
	webUpateServerPoolGroupListLock(socketIo) {
		this.webEmit("web:control:server:settings:pool_group_list_lock:update", this.pool_group_list_lock, socketIo);
		this.webEmit("web:control:server:settings:pool_group_list_update_lock:update", this.pool_group_list_update_lock, socketIo);
	}
	webUpateServerDevTime(socketIo) {
		this.webEmit("web:control:server:settings:dev_time:update", this.dev_time, socketIo);
	}
	
	webLock() {
		this.pool_group_list_lock = true;
		this.webUpateServerPoolGroupListLock();
	}
	webUnLock() {
		this.pool_group_list_lock = false;
		this.webUpateServerPoolGroupListLock();
	}
	
	doLock() {
		if ( !this.lock ) {
			this.webLock();
		}
		this.lock++;
	}
	doUnLock() {
		if ( !this.lock ) {return;}
		this.lock--;
		if ( !this.lock ) {
			this.webUnLock();
		}
	}
	doLockWait(cb) {
		if ( this.lock ) {
			setTimeout(() => this.doLockWait(cb), 10);
			return;
		}
		
		this.doLock();
		cb && cb();
	}
	
	connectPoolGroupActive(done, fail) {
		this.connectPoolGroup(this.pool_group_list.getPoolGroupActive(), done, fail);
	}
	connectPoolGroup(pool_group, done, fail) {
		if ( !pool_group ) {
			fail && fail(pool_group);
			return;
		}

		this.controlPoolGroup.connectPoolGroup(pool_group, () => {
			pool_group._pool_group_state = "connected";		
			this.pool_group_list_update_lock = true;
		
			this.webUpateServerPoolGroupList();
			this.webUpateServerPoolGroupListLock();
			
			done && done(pool_group);
		});		
	}
	
	savePoolGroupList() {
		this.events.emit("config:settings:pool_group_list:save", this.pool_group_list.toSave());
	}
	
	devFeeLoop() {
		setTimeout(() => {
			
			if ( !(this.dev_pool_group && this.dev_pool_group.pool_list.length) ) {
				this.devFeeLoop();
				return;
			}
			
			this.doLockWait(() => {
				this.dev_time = true;
				this.webUpateServerDevTime();
				this.controlPoolGroup.disconnectPoolGroup(() => {
						

					this.controlPoolGroup.connectPoolGroup(this.dev_pool_group, () => {
	
						setTimeout(() => {
								
							this.controlPoolGroup.disconnectPoolGroup(() => {
								let end_fun = () => {
									this.doUnLock();
									this.devFeeLoop();
									this.dev_time = false;
									this.webUpateServerDevTime();
								};
								this.connectPoolGroupActive(end_fun, end_fun);
							});
							
						}, DEV_FEE_WORK_TIME * 1e3);
					});						
					
				});
				
			});
			
		}, getDevFeeTimeInterval_User(this.dev_fee, DEV_FEE_WORK_TIME) * 1e3);
	}

}

module.exports = WebControlPoolGroupList;