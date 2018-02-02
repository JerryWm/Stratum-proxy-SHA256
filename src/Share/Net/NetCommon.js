
class Recv {
	constructor(options) {
		this.onrecv   = options.recv || (()=>0);
		this.onerror  = options.error || (()=>0);
		this.max_buf_size = options.max_buf_size || (1024*1024);
		
		this.closed = false;
		this.buffer = "";
	}
	
	recv(buf) {
		if ( this.closed ) { return; }

		this.buffer += buf.toString("utf8");
		
		if ( this.buffer.length > this.max_buf_size ) {
			this.error("Incoming buffer is overflow");
			this.buffer = "";
			return;
		}
		
		this.buffer = this.buffer.replace(/[^\r\n]*[\r\n]/g, (m) => {
			if ( this.closed ) { return; }
		
			m = m.trim();
			
			if ( m.length ) {
				let isJson = false;
				let json = null;
				try {
					json = JSON.parse(m);
					isJson = true;
				} catch(e) {}
				
				if ( isJson ) {
					this.onrecv(json);
				} else {
					this.error("Accepted invalid json");
				}
			}
			
			return "";
		});
	}
	
	error(msg) {
		this.closed = true;
		this.onerror(msg);
	}
}

function parseAddress(address) {		
		if ( typeof address === "string" && address.trim().length ) {
			address = address.trim();
		
			let ssl = !!address.match(/^((ssl\:\/\/)|(tls\:\/\/))/);
		
			address = address.replace(/^((ssl\:\/\/)|(tls\:\/\/)|(tcp\:\/\/))/, "");
		
			if ( address.length ) {
				let ex = address.match(/^([^\:]+)\:\s*(\d+)\s*$/);
				if ( ex ) {
					let host = ex[1].trim();
					let port = ex[2].trim();
					if ( host.length && port.length ) {
						return {
							host: host,
							port: port,
							ssl : ssl,
						};
					}
				}
			}
		}
		
		return null;
}


module.exports = {
	Recv: Recv,
	parseAddress: parseAddress,
};