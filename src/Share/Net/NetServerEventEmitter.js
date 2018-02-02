
const EventEmitter = require('events').EventEmitter;

const NetClient = require('./NetClient');
const NetServer = require('./NetServer');
const NetClientEventEmitter = require('./NetClientEventEmitter');



class NetServerEventEmitter extends EventEmitter {
	
	constructor(options) {
		super();
		
		this.net = new NetServer(options);
				
		this.net.on("open", () => super.emit("open"));
		this.net.on("close", (error) => super.emit("close", error));
		this.net.on("listening", (addr) => super.emit("listening", addr));
		this.net.on("connection", (cl) => {
			super.emit("connection", new NetClientEventEmitter(cl))
		});
		
	}
	
	close() {
		this.net.close();
	}
	
}

module.exports = NetServerEventEmitter;
