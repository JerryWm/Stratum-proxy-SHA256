
const Common = require("./Common");
const PackArray = require("./PackArray");
const WebStatBase = require("./WebStat/WebStatBase");

const Constants = require('./../Share/App/Constants');

class ControlWorker {
	constructor(origWorker, worker, webEmit, events) {
		this.id = origWorker.id;
		this.origWorker = origWorker;
		this.webEmit = webEmit;
		this.events = events;

		this.worker_x86_test = "worker-x86-test.bin";
		this.worker_x64_test = "worker-x64-test.bin";
		
		/** **/
		this.worker = worker;
		this.worker.id               = origWorker.id;
		this.worker.address          = origWorker.address;
		this.worker.name             = "";
		this.worker.state            = "stopped";
		this.worker.cpu_count        = 1;
		this.worker.thread_count     = 1;
		this.worker.process_priority = Constants.PROC_PRIO_NORMAL;
		this.worker.thread_priority  = Constants.THR_PRIO_NORMAL;
		this.worker.workers_info     = [];
		this.worker.lock             = false;
		/** **/
		
		this.options = Object.create(null);
		
		this.onInfo = null;
		
		this.next_cb = null;
	}
	
	nextOn(cb) {
		this.next_cb = cb;
	}
	nextOff() {
		this.next_cb = null;
	}
	nextEmit(...params) {
		this.next_cb && this.next_cb(...params);
	}
	
	emitWorker() {
		this.webEmit("control:workers", [this.worker]);
	}
	
	lock(fl = true) {
		this.worker.lock = true;
		if ( fl ) {
			this.emitWorker();
		}
	}
	unlock(fl = true) {
		this.worker.lock = false;
		if ( fl ) {
			this.emitWorker();
		}
	}
	
	control(method, params) {
		if ( this.worker.lock ) {return;}
		
		switch(method) {
			case "start":
				this.worker.target_state = "working";
				this.controlOptions();
				this.lock();
				this.controlStart((fl) => {
					this.unlock();
				});
				break;
				
			case "stop":
				this.worker.target_state = "stopped";
				this.controlOptions();
				this.lock();
				this.controlStop(() => {
					this.unlock();
				});
				break;

			case "options":
				this.lock();
				this.setWorker(params, false);
				this.controlOptions();
				if ( this.worker.state === "working" ) {
					this.controlRestart(this.unlock.bind(this));
				} else {
					this.unlock();
				}
				break;
				
			case "options:name":
				this.setWorker(params, false);
				this.controlOptions();
				break;
				
			case "selftest":
				this.lock();
				if ( this.worker.state === "working" ) {
					this.controlStop(
						() => this.controlTest(
							() => this.controlStart(this.unlock.bind(this))));
				} else {
					this.controlTest(this.unlock.bind(this));
				}
				break;
				
		}
	}
	
	setWorker(options, isSv = true) {
		if ( !(options instanceof Object) ) {
			return;
		}

		this.worker.name               = String(typeof options.name === "string" ? options.name : "");
		this.worker.thread_count       = Common.parseInteger(options.thread_count, 1, 1, 1024*1024);
		this.worker.process_priority   = Constants.parseProcPrio(options.process_priority, Constants.PROC_PRIO_NORMAL);
		this.worker.thread_priority    = Constants.parseProcPrio(options.thread_priority , Constants.THR_PRIO_NORMAL );
		this.worker.target_state       = options.target_state;
		
		if ( isSv ) {
			this.worker.worker_path        = options.worker_path;
			this.worker.worker_x64         = options.worker_x64;
			this.worker.workers_perfomance = options.workers_perfomance;
			this.worker.support_x86        = options.support_x86;
			this.worker.support_x64        = options.support_x64;
		}
	}
	
	appOptions(options) {
		this.options = options;
		
		if ( "os" in options ) {
			this.worker.cpu_count = Common.parseInteger(options.os.cpu_count, 1, 1, 1024*1024);
		}

		this.setWorker(options.options);
		
		this.emitWorker();
		
		this.lock();
		
		if ( !this.worker.workers_perfomance || !this.worker.worker_path ) {
			this.controlTest(() => {
				this.controlStart(() => {
					this.worker.target_state = "working";
					this.controlOptions();
					this.unlock();
				});
			});
			
			return;
		}
		
		if ( this.worker.target_state === "working" ) {
			this.controlStart(this.unlock.bind(this));
			return;
		}
		
		this.unlock();
	}
	appWorkersInfo(workersInfo) {
		this.worker.state = "working";
		this.worker.workers_info = workersInfo;
		this.emitWorker();
		this.nextEmit("app:workers:info");
	}
	appInfo(info) {
		//console.log(this.onInfo)
		//console.log(info)
		if ( !this.onInfo ) {return;}
		this.onInfo(info);
	}
	appClose() {
		this.worker.state = "stopped";
		this.worker.workers_info = [];
		this.emitWorker();
		this.nextEmit("app:close");
	}
	
	controlStart(options, cb) {
		if ( options instanceof Function ) {
			cb = options;
			options = this.worker;
		}

		this.origWorker.appStart(options);
		this.controlWaitStartOrClose(cb);
	}
	controlStop(cb) {
		this.origWorker.appStop();
		this.controlWaitStartOrClose(cb);
	}
	controlRestart(cb) {
		if ( this.worker.state === "working" ) {
			this.controlStop(() => this.controlStart(cb));
			return;
		}
		
		this.controlStart(cb);
	}
	controlOptions() {
		// TODO
		this.events.emit("control:workers:server:worker:app:options", this.origWorker, this.worker);
		
		this.origWorker.appOptions(this.worker);
	}	
	controlTest(cb) {
		if ( !(this.options.worker_x86_list instanceof Array) ) { cb(false); return; }
		if ( !(this.options.worker_x64_list instanceof Array) ) { cb(false); return; }
		
		let worker_save = {
			thread_count     : this.worker.thread_count,
			process_priority : this.worker.process_priority,
			thread_priority  : this.worker.thread_priority,
		};
		
		let controlStart = (worker_path, worker_x64, cb) => {
			this.worker.worker_path  = worker_path;
			this.worker.worker_x64   = worker_x64;
			this.worker.thread_count = 1;
			this.worker.process_priority = Constants.PROC_PRIO_REALTIME;
			this.worker.thread_priority  = Constants.THR_PRIO_TIME_CRITICAL;
			
			this.controlStart(cb);
		};
		
		let worker_list = [];

		var workers_perfomance = [];
		
		let controlStartLongTest = (worker_list, i, cb) => {
			if ( i >= worker_list.length ) {
				workers_perfomance = workers_perfomance.filter((v) => !v.error).sort((l,r) => l.min_delta_micro_sec_hash - r.min_delta_micro_sec_hash);
				///workers_perfomance=[];
				
				this.worker.state_selftest = null;
				this.worker.workers_perfomance = workers_perfomance;
				this.worker.worker_path = workers_perfomance[0] ? workers_perfomance[0].worker_path : null;
				this.worker.worker_x64  = workers_perfomance[0] ? workers_perfomance[0].worker_x64  : null;
				this.worker.thread_count     = worker_save.thread_count;
				this.worker.process_priority = worker_save.process_priority;
				this.worker.thread_priority  = worker_save.thread_priority;
				
				this.controlOptions();
				
				
				
				cb(workers_perfomance);
				return;
			}
			
			this.worker.state_selftest = "selftest "+(Math.round(100*i / worker_list.length))+"%";
			this.emitWorker();
			
			controlStart(worker_list[i].worker_path, worker_list[i].worker_x64, (fl) => {
				let wpid = workers_perfomance.push({
					worker_path: worker_list[i].worker_path,
					worker_x64 : worker_list[i].worker_x64,
					min_delta_micro_sec_hash: null,
					error: false,
				}) - 1;
					
				if ( fl ) {
					var count = 0;
					const MAX_COUNT = 10;
					this.onInfo = (info) => {
						count++;

						this.worker.hash_rate = info.hash_rate;
						this.worker.state_selftest = "selftest "+(Math.round(100*( (i / worker_list.length) + (count / MAX_COUNT / worker_list.length) )))+"%";
						this.emitWorker();						
						
						if ( count >= MAX_COUNT ) {
							this.onInfo = null;
							workers_perfomance[wpid].min_delta_micro_sec_hash = info.min_delta_micro_sec_hash;
							this.controlStop(() => controlStartLongTest(worker_list, i + 1, cb));
						}
					};
					
					return;
				}
				
				workers_perfomance[wpid].error = true;
				
				controlStartLongTest(worker_list, i + 1, cb);
			});
		};
		
		this.worker.support_x86 = false;
		this.worker.support_x64 = false;

		worker_list = worker_list.concat(this.options.worker_x86_list.map((worker_path) => {return {worker_path: worker_path, worker_x64: false};}));
		worker_list = worker_list.concat(this.options.worker_x64_list.map((worker_path) => {return {worker_path: worker_path, worker_x64: true };}));

		controlStartLongTest(worker_list, 0, cb);
	}
	
	controlWaitStartOrClose(cb) {
		this.nextOn((method) => {
			this.nextOff();
			
			let isStart = false;
			switch(method) {
				case "app:workers:info":
					isStart = true;
				case "app:close":
					if ( cb ) cb(isStart);
					break;
			}
		});		
	}
	
	disconnect() {
		this.webEmit("control:workers:remove", [this.id]);
	}
}

class WebControlWorkers extends WebStatBase {
	constructor(events) {
		super(events);
	
		this.workers = {};
		this.controlWorkers = {};
		
		this.events = events;
		
		events.on("web:server:connect_web_socket", (socket) => {
			this.webEmit("control:workers", Common.objToArray(this.workers), socket);

			let map = ["options", "start", "stop", "restart", "selftest", "options:name"];
			for(let name of map) {
				socket.on(`control:worker:${name}`, (origWebWorker, ...params) => {
					let worker = this.controlWorkers[origWebWorker.id]; if ( !worker ) { return; }
					worker.control(name, origWebWorker, params);
				});
			}

		});		
		
		events.on("workers:server:worker:connect"      , this.workerConnect      .bind(this));
		events.on("workers:server:worker:disconnect"   , this.workerDisconnect   .bind(this));
		
		events.on("workers:server:worker:app:options"     , (origWebWorker, ...params) => {
			let worker = this.controlWorkers[origWebWorker.id]; if ( !worker ) { return; }
			worker.appOptions(...params);
		});
		events.on("workers:server:worker:app:workers_info", (origWebWorker, ...params) => {
			let worker = this.controlWorkers[origWebWorker.id]; if ( !worker ) { return; }
			worker.appWorkersInfo(...params);
		});
		events.on("workers:server:worker:app:info"        , (origWebWorker, ...params) => {
			let worker = this.controlWorkers[origWebWorker.id]; if ( !worker ) { return; }
			worker.appInfo(...params);
		});
		events.on("workers:server:worker:app:close"       , (origWebWorker, ...params) => {
			let worker = this.controlWorkers[origWebWorker.id]; if ( !worker ) { return; }
			worker.appClose(...params);
		});

	}
	
	workerConnect(origWorker) {
		this.workers[origWorker.id] = Object.create(null);
		this.controlWorkers[origWorker.id] = new ControlWorker(origWorker, this.workers[origWorker.id], this.webEmit.bind(this), this.events);
	}
	workerDisconnect(origWorker, msg) {
		let worker = this.controlWorkers[origWorker.id]; if ( !worker ) { return; }
		
		worker.disconnect();

		delete this.workers[origWorker.id];
		delete this.controlWorkers[origWorker.id];
	}
	
}

module.exports = WebControlWorkers;
