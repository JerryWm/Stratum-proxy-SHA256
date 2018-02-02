
const net = require('net');
const tls = require('tls');
const EventEmitter = require('events').EventEmitter;

const NetCommon = require('./NetCommon');
const NetClient = require('./NetClient');

const DEF_PRIVATE_KEY_PEM = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC+9a6+2knPXlj+\nEcNc9DIzC+tJNXgMefs+nhTD4GAZ76ek6tkQHUgOt+h03r75DA9Y2sUxiFb95yLI\nQU5hEz0pWgTErBlZfrcomN5MFpfar1PSZHooIuF0MQ1NrgFVN2FkpK+XDU9KXdBn\nEcjS8GC+NwI8zUcy0LrWIjA27UtWXh7LxDB2R3d3l0Scuk57dYU5AJbL+6vUjatu\npbN+uluTDFi/hLvlCp03hRIv0v+nV5WONgJtLHe9wDVcWkTKN16Lpy1X8nRZ9CYV\nmuQQaHlkomL4/puNSPQUuUkkdQRmmrPMXOY4fI6Z7ZEzvMV4uESYG2B4rZ40Z8U3\n603Hp0xtAgMBAAECggEAYqy/fH190Hr3T2pMYlcJLZmGHlFT1Faf/k5feowR/LT7\nEtwMCCipWHmt095aHoUd1RNO/HZwRUlPjt04LC9t1lVey2YGv1kcOg0sKXMvSuB4\nVup2uRC1IX5LWo2EwM0aNZBn740AIPRzQR9Of7mYtBHmxRZqKRb0xLvr4CYkXN7n\nV0vQQkrLMBowwWgWSNAWG9xN1m+9yEKwN6CD7idmFrvFAWvqsarz1j9DJrVXvoui\nEvxGwdAmlttIeVknggd8qOovADR3ZUNNON4df/6mnL86Kw4RpXBGnuAm5kuhFCkf\nAA8tWkKMdA64tcQkv2NB5cw9OYadm/kftpXmzxdC3QKBgQDeT2wEEMB4ZWEa7O5d\n01m98fOKE/ffFsKdGgDblsSNmV55YxmLyZ9ZbRSstY5JCkd1jzKGMFqOGdjqrJP9\nClnEavCAD+vAhLGl6aYfLxKgwcoUBpMjiX0oFlm5PMINQhuNVonnaS8jzknA7qXV\nsCR1C7YfeSEikbMUt8q8oJuQCwKBgQDb5gJJXQ90nQuPGXaoLXoHq00M0ay6h9xV\nTcByOgumRa7IF3ZSc+WvmCFcDR02P2voKFSu3MVFL1KtsAq7YngNEspRIQYIX0ZG\n1vhyniGB+rl5YDnrRQMIe6hLBxrA5c/5czcA4qPiUg9wWiio3VAXWuFXe1P5p4IQ\n+9FF77AIZwKBgE9FUMXuV0NXGxYn0COCvqhdgzMERcm16vVsFUw36aR4QNjV/oD7\nBygzHkEriC4BTVPdGO4ChffPvaqImUiMjU/dth5kDvOaHWKE+yh5d5H9KBqV8Zel\nagyGU74arTNfFEYEyq3KsvV4lJIIRvf4lDdsUqfMYIVcINhNZSx3tKDbAoGATaK9\nN+2VIVS42gLhc6rqpH6EK3xzgT+qOKvEwA9iQYfkl1xBOAcXFpGdZYRzxc1KaaKj\nk0D6nNyCUjQO9e1j+SmjKFWCbb5Fb4lCGiVeKye8B/BDQp8Q3RPbbPHLLkN009sr\nljJuLd9O+Bm8tTG9ryE04c/26/OJ5jkhv5FKEw0CgYEAoVO96XdbxCMVwt87WR6H\nXnJW6iNYAMNay9zlJYxcUKRj0sh8ntbetX1wNg9WAkI0iExukWC7LE2uwJzaKEs8\nil1Z6qX4LYFNGX2vjDgalZwdwTH4OIznXfnLC6EYn2eUhksqUFVGwmouIhjXRNUC\nRjjI3ZDWKMTf5dsc5ZE1CpI=\n-----END PRIVATE KEY-----\n";
const DEF_PRIVATE_CERT_PEM = "-----BEGIN CERTIFICATE-----\nMIIDnTCCAoWgAwIBAgIJALE+llmxEZmjMA0GCSqGSIb3DQEBCwUAMGQxCzAJBgNV\nBAYTAklUMRUwEwYDVQQIDAxTdHJhdHVtUHJveHkxDzANBgNVBAcMBkRhZW1vbjEV\nMBMGA1UECgwMU3RyYXR1bVByb3h5MRYwFAYDVQQDDA1zdHJhdHVtLnByb3h5MCAX\nDTE3MTIzMDAyMjAxNFoYDzIxMTcxMjA2MDIyMDE0WjBkMQswCQYDVQQGEwJJVDEV\nMBMGA1UECAwMU3RyYXR1bVByb3h5MQ8wDQYDVQQHDAZEYWVtb24xFTATBgNVBAoM\nDFN0cmF0dW1Qcm94eTEWMBQGA1UEAwwNc3RyYXR1bS5wcm94eTCCASIwDQYJKoZI\nhvcNAQEBBQADggEPADCCAQoCggEBAL71rr7aSc9eWP4Rw1z0MjML60k1eAx5+z6e\nFMPgYBnvp6Tq2RAdSA636HTevvkMD1jaxTGIVv3nIshBTmETPSlaBMSsGVl+tyiY\n3kwWl9qvU9Jkeigi4XQxDU2uAVU3YWSkr5cNT0pd0GcRyNLwYL43AjzNRzLQutYi\nMDbtS1ZeHsvEMHZHd3eXRJy6Tnt1hTkAlsv7q9SNq26ls366W5MMWL+Eu+UKnTeF\nEi/S/6dXlY42Am0sd73ANVxaRMo3XounLVfydFn0JhWa5BBoeWSiYvj+m41I9BS5\nSSR1BGaas8xc5jh8jpntkTO8xXi4RJgbYHitnjRnxTfrTcenTG0CAwEAAaNQME4w\nHQYDVR0OBBYEFAUnPt08RKOGf35mSQADu2t6vgM9MB8GA1UdIwQYMBaAFAUnPt08\nRKOGf35mSQADu2t6vgM9MAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEB\nAHEObGnEu/lOelqm6l65AVcgbVIWid1iOXuxjyFMAnAY2DIUmsd9Q1zQrmGsVjus\nDW/BqEaGOGTYXsXZVgp/BMds477UqC3XrrXXHSZ1LRa+cM393Fw8CHtdG9T8aoZY\n3Cx0cPu6e74Eeu/1DmmZuyFW33dRAdS/CzD9MepCmCXyBuKbuJvXgtdMVRHoatl8\nG4HHE5I32Lxi7BWUhBQDjiRFjxiKK252TJYVT8loBnVvJFMtENesyaN58TEMxQsr\n4zoXLRNbcyWdJvnEXnS79iog3Nk/12hsYbtg3rS4dTDC9AEycsr6NexOUV58zQgF\nGUJuMLp3h0yxATn4yfQQt7w=\n-----END CERTIFICATE-----\n";

class NetServer extends EventEmitter {
	constructor(options) {
		super();
		
		this.options = options || {};
		
		this.bind_addr_info = NetCommon.parseAddress(this.options.bind_address);
		this.ssl = !!this.options.ssl;
		if ( this.ssl ) {
			if ( this.options.ssl_options ) {
				this.ssl_options = {
					requestCert: false,
					key : this.options.ssl_options.key,
					cert: this.options.ssl_options.cert,
				};
			} else {
				this.ssl_options = {
					requestCert: false,
					key : DEF_PRIVATE_KEY_PEM,
					cert: DEF_PRIVATE_CERT_PEM,
				};
			}
		}
		
		this.last_error = null;
		
		this.socket = null;
		
		this.clients = [];
		
		setImmediate(this.create.bind(this));
	}
	
	create() {
		this.emit("open");
		
		if ( !this.bind_addr_info ) {
			this.emit("close", `Invalid bind address ${this.options.bind_address}`);
			return;
		}
	
		try {
			if ( this.ssl ) {
				this.socket = tls.createServer(this.ssl_options, this.onConnection.bind(this));
			} else {
				this.socket = net.createServer(this.onConnection.bind(this));
			}
		} catch(e) {
			this.last_error = 'An error has occurred ' + (e.message ? e.message : "");
			this.closeAndNullSocket();
			return;
		}
		
		this.setEvents();
		
		try {
			this.socket.listen(this.bind_addr_info.port, this.bind_addr_info.host);
		} catch(e) {
			this.last_error = 'An error has occurred ' + (e.message ? e.message : "");
			this.closeAndNullSocket();
			return;
		}
	}
	
	onConnection(cl_socket) {
		let cl = new NetClient(cl_socket);
		this.emit("connection", cl);
	}
	
	setEvents() {
		this.socket.on("listening", () => {
			this.emit("listening", this.socket.address());
		});
		
		this.socket.on("error", (e) => {
			this.last_error = "An error has occurred " + (e.code ? "#"+e.code : "") + " " + (e.message ? "("+e.message+")" : "");
			if ( !this.clients.length ) {
				this.closeAndNullSocket();
			}
		});
		
		this.socket.on("close", () => {
			this.closeAndNullSocket();
		});
	}
	
	close(error = null) {
		if ( this.socket ) {
			this.last_error = error;
			for(let cl of this.clients) {
				cl.close();
			}
			
			this.socket.close();
		}
	}
	
	closeAndNullSocket() {
		this.emit("close", this.last_error);
		this.socket = null;		
	}
}

module.exports = NetServer;
