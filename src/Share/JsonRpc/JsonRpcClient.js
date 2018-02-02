
const EventEmitter = require("events").EventEmitter;

const NetClient = require("./../../Share/Net/NetClient");

/**
events:
	open
	close
	connect
	disconnect
	
	notify
method:
	sendMethod
	sendNotify
	close
	
*/

class JsonRpcClient extends EventEmitter {	
	constructor(address) {		
		super();		
		
		this.id_seq = 1;

		this.expected_result_timeout_milisec = 20e3;
		this.expected_result_iid = null;
		this.expected_result_kv = Object.create(null);
		this.expectedResult_Create();
		
		this.ping = null;
		
		if ( address instanceof NetClient ) {
			this.net = address;
		} else {
			this.net = new NetClient(address);
		}
		
		this.setEvents();
	}
	
	setEvents() {
		this.net.on("open", () => this.emit("open"));
		this.net.on("close", (msg) => this.emit("close", msg));
		
		this.net.on("connect", () => this.emit("connect"));
		this.net.on("disconnect", (msg) => this.emit("disconnect", msg));
		
		this.net.on("data", this.onrecv.bind(this));
	}
	
	onrecv(data) {
		//console.log(data)
		if ( typeof data !== 'object' ) {
			this.close('Pool sent invalid raw json');
			return;
		}
		
		// method
		
		
		// result OR call method
		if ( ("id" in data) && (typeof data.id === 'string' || typeof data.id === 'number') ) {

			// call method
			if ( "method" in data ) {
				if ( data.params instanceof Array ) {
					let response = (result, error = null) => {
						this.net.send({
							id: data.id,
							result: result,
							error: error
						});
					};
					
					this.emit("call", data.method, data.params, response);
					return;
				}
			}
			
			// result
			if ( "result" in data ) {
				let onresult = this.expectedResult_GetCbAndDel(data.id);
				if ( !onresult ) {
					return;
				}
				
				onresult(data.result, data.error);
				return;
			}
		}
		
		// notify
		if ( "method" in data ) {
			if ( data.params instanceof Array ) {
				this.emit("notify", data.method, data.params);
				return;
			}
		}
		
		this.close('Pool sent invalid json-rpc data');
	}
	
	expectedResult_Create() {
		if ( this.expected_result_iid === null ) {
			this.expected_result_iid = setInterval(() => {
				
				let curr_time = +new Date();
				for(let id in this.expected_result_kv) {
					let expres = this.expected_result_kv[id];

					if ( expres.time + this.expected_result_timeout_milisec < curr_time ) {
						this.close("Pool did not send the result. Timeout error");
						return;
					}
				}
				
			}, 2e3);
		}
	}
	expectedResult_Close() {
		if ( this.expected_result_iid !== null ) {
			clearInterval(this.expected_result_iid);
			this.expected_result_iid = null;
		}
	}
	expectedResult_Reg(id, onresult) {
		this.expected_result_kv[id] = {
			time: +new Date(),
			onresult: onresult,
		}
	}
	expectedResult_GetCbAndDel(id) {
		let expres = this.expected_result_kv[id];
		if ( !expres ) {
			this.close("Pool sent a obj, result is not expected");
			return false;
		}
		
		this.ping = (+new Date()) - expres.time;
		
		delete this.expected_result_kv[id];
		
		return expres.onresult;
	}
	
	sendMethod(method_name, params, onresult) {
		let data = {
			id    : this.id_seq++,
			method: method_name,
			params: params,
		};
		
		this.expectedResult_Reg(data.id, onresult);
		
		this.net.send(data);
	}
	sendNotify(method_name, params) {
		let data = {
			method: method_name
		};
		
		if ( params !== undefined ) {
			data.params = params;
		}
		
		this.net.send(data);
	}
	
	close(msg) {
		this.expectedResult_Close();
		this.net.close(msg);
	}
	disconnect(msg) {
		this.close(msg);
	}

}

module.exports = JsonRpcClient;
