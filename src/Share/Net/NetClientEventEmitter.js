
const EventEmitter = require('events').EventEmitter;

const NetClient = require('./NetClient');
const NetServer = require('./NetServer');



class NetClientEventEmitter extends EventEmitter {
	
	constructor(addr_string) {
		super();
		
		this.map_events = {
			"open": 1,
			"close": 1,
			"connect": 1,
			"disconnect": 1,
		};
		
		if ( addr_string instanceof NetClient ) {
			this.net = addr_string;
		} else {
			this.net = new NetClient(addr_string);
		}
		
		this.net.on("open", () => super.emit("open"));
		this.net.on("close", (error) => super.emit("close", error));
		this.net.on("connect", () => super.emit("connect"));
		this.net.on("disconnect", (error) => super.emit("disconnect", error));

		this.net.on("data", (data) => {
			if ( !(data instanceof Array) || data.length !== 2 || !(data[1] instanceof Array) || !this.checkName(data[0]) ) {
				this.net.close("Accepted invalid data");
				return;
			}
			
			super.emit(data[0], ...data[1]);
		});
	}
	
	emit(name, ...argv) {
		if ( this.net.connected && this.checkName(name) ) {
			this.net.send([name, argv]);
		}
	}
	
	checkName(name) {
		if ( typeof name !== "string" ) { return false; }
		if ( !name.length ) { return false; }
		if ( name.match(/[^\w\-\:]/) ) { return false }
		if ( this.map_events[name] ) { return false; }
		
		return true;
	}
	
	close() {
		this.net.close();
	}
}

module.exports = NetClientEventEmitter;
