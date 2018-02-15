
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


class StratumClientCheckConnect extends EventEmitter {
	constructor(pool_info, logger, timeout = 10e3) {
		super();

		this.id = Common.getGlobalUniqueId();
		this.logger = new Logger(logger, "CHECK-CONNECT");
		this.pool_info = Object.assign({}, pool_info);
		this.events = new EventEmitter();

		this.closed = false;

		this.fl_authorize = false;
		this.fl_job = false;
		
		this.fl_full_connect = false;
		
		this.setEvent("stratum:client:open"           , this.poolOpen         .bind(this));
		this.setEvent("stratum:client:close"          , this.poolClose        .bind(this));
		this.setEvent("stratum:client:connect"        , this.poolConnect      .bind(this));
		this.setEvent("stratum:client:disconnect"     , this.poolDisconnect   .bind(this));
		this.setEvent("stratum:client:accepted_job"   , this.poolAcceptedJob  .bind(this));
		this.setEvent("stratum:client:authorize"      , this.poolAuthorize    .bind(this));
		setImmediate(() => {
			this.pool = new StratumClient(this.pool_info, this.events, this.logger);
		});
		
		setTimeout(() => {
			this.close("Full connect error. Timeout error");
		}, timeout);
	}
	
	poolOpen() {
		this.emit("open");
	}
	poolClose(pool, error) {
		this.emit("info:close", this.fl_full_connect, error);
		
		this.emit("close", error);
		
		this.delEvents();
		
		this.pool = null;
		
		this.close(error);
	}
	poolConnect() {
		this.emit("connect");
	}
	poolDisconnect(pool, error) {
		this.emit("disconnect", error);
	}
	poolAcceptedJob() {
		this.fl_job = true;
		this.emit("accepted_job");
		this.checkComplected();
	}
	poolAuthorize(pool, fl) {
		if ( fl ) {
			this.fl_authorize = true;
		}
		this.checkComplected();
	}
	
	checkComplected() {
		if ( this.fl_job && this.fl_authorize ) {
			this.fl_full_connect = true;
			this.emit("full_connect");
			this.close();
		}
	}
	
	setEvent(event_name, cb) {
		this.__set_events = this.__set_events || [];
		
		this.__set_events.push({
			event_name: event_name,
			cb: cb,
		});
		
		this.events.on(event_name, cb);
	}
	delEvents() {
		if ( !this.closed ) {
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

	close(error) {
		if ( this.closed ) { 
			return;
		}
		this.closed = true;
		
		if ( this.pool ) {
			this.pool.close(error);
		}
	}
}


module.exports = StratumClientCheckConnect;

