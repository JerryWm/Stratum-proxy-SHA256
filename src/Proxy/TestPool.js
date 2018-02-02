
const fs = require('fs');

const NetServer = require('./../Share/Net/NetServer');
const NetClient = require('./../Share/Net/NetClient');

const StratumClient = require('./StratumClient');

const Common = require('./Common');
const CommonCrypto = require('./CommonCrypto');

try {
	fs.mkdirSync(LOGS_DIR_CURR);
} catch(e) {}


let notify_list = [
	{
		"params": [
			"5a6d0b7b00000db9",
			"561cc52a68e5b73967b8d10d9034efbee7a1f1360054aa640000000000000000",
			"01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff3503f1ba0700049ba56e5a03c98c7a0c",
			"0a2ef09f90882e12204b616e6f506f6f6c20283d4f2e4f3d2920ffffffff0214c5444b000000001976a914370c9767eeb3f6add88c207733b7ff2e920622c888ac0000000000000000266a24aa21a9ed7c37244589743e3a85d3d4ad45ef3f4f6d4cfa7e421104e164ee89522771959c00000000",
			[
				"902a74d5f7071ba34b3605b25b1e7191a9aeeea0a01e80cd4fd829e0c59ad50e",
				"0c35c909c35fe9ee9ad21efd54fd097b7d9bc227357c6dc0253c93995fadebce",
				"336b8cb15df994bde400a1d8868b2574cb8cd229a5168882fce1aaf13a8065a5",
				"85450839dcd46263c0cb38880938ceee3fc14abf5018339bb61b1abf50b2c66b",
				"5ce4fe1811da1452e021b4c71e5ffaba2258b97217700e587a29926ffb9511bf",
				"d10c8e00b169c431bf25e1d5a49324997443fecffb354436e4bc4d04be050625",
				"9eaae22567201717f9ee142010a205514a4472cc387a25f3de0c1464ebd8e9ed",
				"70c9c8c6d870c88ce91f3189288277e1dc5b82792e53f328c63eace961a81e31"
			],
			"20000000",
			"176c2146",
			"5a6ea59a",
			true
		],
		"id": null,
		"method": "mining.notify"
	},

];



class Pool {
	constructor(socket) {
		
		var nid = 0;
		
		var id = 0;
		let getPacket = () => {
			return pooldata_list[id++ % pooldata_list.length];
		};
		
		socket.on("data", (data) => {
			switch(data.method) {
				
				case "mining.subscribe":
					socket.send({
						"id": data.id,
						"result": [
							[
								[
									"mining.notify",
									"5b6e71bf"
								]
							],
							"d0cfec5a",
							8
						],
						"error": null
					});
					break;
				

				
				case "mining.authorize":
					socket.send({
						"id": data.id,
						"result": true,
						"error": null
					});
					
					
				//	socket.send(notify_list[nid++]);
				//	socket.send(notify_list[nid++]);
				//	socket.send(notify_list.filter(v => v.params[0] === "426b")[0]);
				
					socket.send(getPacket());
					socket.send(getPacket());

					setInterval(() => {
						socket.send(getPacket());
					}, 5e3);
					
					break;
					
			
				case "mining.submit":
					console.log("mining.submit")
					//console.log(data)
					socket.send({
						"id": data.id,
						"result": true,
						"error": null
					});
					
					break;
				
			}
		});
		
		socket.on("close", () => {
			
		});
		
	}
}

class TestPool {
	constructor(server_options, pool_options) {
		this.server_options = server_options;
		
		this.startServer();
	}
	
	startServer() {
		this.server = new NetServer(this.server_options);
		
		this.server.on("listening", (address) => {
			console.log(
				`Server listening ${address.address}:${address.port}`
			)
		});
		
		this.server.on("connection", (sv_client) => {
			console.log("Connection. ");	
			new Pool(sv_client);
		});
		
		this.server.on("close", (msg) => {
			console.log("Server close. " + msg);	
			setTimeout(this.startServer.bind(this), 5e3);
		});
		
	}
}



new TestPool({bind_address: "127.0.0.1:7777"});


function parseTextData(t) {
	return t.match(/\[.*?\] data-.*?-pool [<>]+[^]*?data-.*?-pool [<>]+/g).map((v) => {
		let m = v.match(/\[(.*?)\] data-(.*?)-pool [<>]+([^]*?)data-.*?-pool [<>]+/);
		
		return {
			time: new Date(m[1]), 
			type: m[2],
			data: JSON.parse(m[3])
		};
	});
}
function dumpFilter(pathPrefix, path, filterCb) {
	let file = fs.readFileSync(pathPrefix+path, "utf8");
	let data = parseTextData(file);
	return data.filter(filterCb).map(v => v.data);
}
function dumpInfoOfFile(pathPrefix, path) {

	let file = fs.readFileSync(pathPrefix+path, "utf8");

	let data = parseTextData(file);


	let l = data.filter(v => 
		(v.data.method === "mining.set_difficulty" && v.type === "of-origin") ||
		(v.data.method === "mining.notify" && v.type === "of-origin") ||
		(v.data.method === "mining.submit" && v.type === "to-origin") 
		//(v.type === "to-filter-info") && (v.data.good)
	).map(v => v);


	let startTime = null;
	let lastTime = null;
	let diff = 1.0;
	let hash_count = 0;
	let share_count = 0;
	for(let m of l) {
		console.log(m)
		
		lastTime = m.time;
		if ( !startTime ) startTime = lastTime;
		
		if ( m.data.method === "mining.set_difficulty" ) {
			diff = m.data.params[0];
		} else {
			hash_count += diff;
			share_count++;
		}
	}

	let hash_rate = hash_count / ( (lastTime - startTime)*1e-3 );
	hash_rate *= 4294967296;

	let hash_rate_s = (hash_rate / 1e12).toFixed(2) + "th";

	console.log(
		`Path: ${path}, Shares: ${Common.tabSpace(share_count, 3)}, Hashes: ${Common.doubleOrNA_kStyle(hash_count, 2)}, Time: ${Common.tabSpace(Common.deltaMiliSecToString((lastTime - startTime)), 8)}, Hash rate: ${Common.doubleOrNA_kStyle(hash_rate, 2)}h`
	);
}

let submit_list = dumpFilter("d/logs-2/", "2018-1-29 11-39-56 0ec3/1.txt", (v) => (v.data.method === "mining.submit" && v.type === "to-origin"));
let pooldata_list = dumpFilter("d/logs-2/", "2018-1-29 11-39-56 0ec3/1.txt", (v) => 
		(v.data.method === "mining.set_difficulty" && v.type === "of-origin") ||
		(v.data.method === "mining.notify" && v.type === "of-origin") );
