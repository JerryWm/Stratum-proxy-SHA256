
const net = require('net');
const tls = require('tls');
const EventEmitter = require('events').EventEmitter;

const NetCommon = require('./NetCommon');

/**
constructor:
	address
	
events:
	open
	close
	connect
	disconnect
	data
methods:
	send
	close
*/

const DEV_SIMPLE_DUMP = false;

class Client extends EventEmitter {
	
	constructor(addr_string, max_buf_recv_size) {
		super();
		
		this.socket = null;
			
		this.last_error = null;
			
		this.connected = false;
		
		this.destroyed = false;
			
		this.recv = new NetCommon.Recv({
			recv : this.recvData.bind(this),
			error: (msg) => {
				this.close(msg);
			},
			max_buf_size: max_buf_recv_size
		});			
			
		if ( addr_string instanceof net.Socket ) {
			this.socket = addr_string;
			this.connected = true;
			this.setEvents();
		} else {
			
			this.addr_string = addr_string;
			this.addr_info = NetCommon.parseAddress(this.addr_string);
			
			
			setImmediate(this.create.bind(this));
			
		}
	}
	
	create() {
		this.emit("open");
		
		if ( !this.addr_info ) {
			this.emit("close", `Invalid address "${this.addr_string}"`);
			return;
		}
		
		if ( this.destroyed ) {
			this.emit("close", this.last_error);
			return;
		}

		if ( this.connect() ) {

			this.socket.on('connect', () => {
				this.connected = true;
				this.emit("connect", this.socket.address());		
			});		
			
			this.setEvents();
			
		}
	}
	
	connect() {
		try {
			if ( this.addr_info.ssl ) {
				process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
				this.socket = tls.connect({
					host: this.addr_info.host,
					port: this.addr_info.port,
					requestCert: false,
					rejectUnauthorized: false
				});
			} else {
				this.socket = net.connect({
					host: this.addr_info.host,
					port: this.addr_info.port,
				});
			}
		} catch(e) {
			this.last_error = 'An error has occurred ' + (e.message ? e.message : "");
			this.emit("close", this.last_error);
			return false;
		}
		
		return true;
	}
	
	setEvents() {
		this.socket.setKeepAlive(true);
		this.socket.setEncoding('utf8');
		
		this.socket.on('data', this.recv.recv.bind(this.recv));

		this.socket.on('error', (e) => {
			this.last_error = "An error has occurred " + (e.code ? "#"+e.code : "") + " " + (e.message ? "("+e.message+")" : "");
		});

		this.socket.on('timeout', () => {
			this.last_error = "Timeout error";
			this.socket.destroy();
		});

		this.socket.on('close', (had_error) => {
			if ( this.connected ) {
				this.emit("disconnect", this.last_error);
				this.connected = false;
			}
			
			this.emit("close", this.last_error);
			
			this.destroyed = true;
		});
	}
	
	recvData(data) {
		if ( DEV_SIMPLE_DUMP ) {console.log(data);}
		
		this.emit("data", data);
	}
	
	send(data) {
		if ( DEV_SIMPLE_DUMP ) {console.log(data);}
		
		if ( this.socket ) {
			this.socket.write(JSON.stringify(data) + "\n");
		}
	}
	
	close(error = null) {
		if ( this.destroyed ) {
			return;
		}

		this.last_error = error;

		if ( this.socket ) {
			this.socket.destroy();
		}

		this.destroyed = true;
	}
	
}

module.exports = Client;
