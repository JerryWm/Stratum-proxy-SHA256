
const fs = require('fs');

const NetServer = require('./../Share/Net/NetServer');
const NetClient = require('./../Share/Net/NetClient');

const StratumClient = require('./StratumClient');

const Common = require('./Common');
const CommonCrypto = require('./CommonCrypto');

let share_list = [ 
/*
  [ 'cytener.13329', '426d', '0001162c', '5a65cece', '5241b7df' ],
  [ 'cytener.13329', '426d', '000409b2', '5a65ced1', 'ef3d468f' ],
  [ 'cytener.13329', '426d', '00050f33', '5a65ced3', 'f585f071' ],
  [ 'cytener.13329', '426d', '00070cbb', '5a65cee5', '2de3f906' ],
  [ 'cytener.13329', '426e', '000707bf', '5a65cefe', 'aad3919a' ],
  [ 'cytener.13329', '426e', '000316b0', '5a65cf02', '06f3bec1' ],
  [ 'cytener.13329', '426e', '000002c4', '5a65cf07', 'ebec4e26' ],
  [ 'cytener.13329', '426e', '00040eb3', '5a65cf0a', '2f5b30b3' ],
  [ 'cytener.13329', '426f', '00011218', '5a65cf32', 'a8c7d9a9' ],
  [ 'cytener.13329', '426f', '00051274', '5a65cf3a', '326a0351' ],
  [ 'cytener.13329', '426f', '000719e5', '5a65cf43', '1e374489' ],
  [ 'cytener.13329', '4267', '00011719', '5a65ce3a', '80f69b47' ],
  [ 'cytener.13329', '4268', '0005187c', '5a65ce42', 'a9f328b5' ],
  [ 'cytener.13329', '426a', '00001111', '5a65ce47', '9f63e3c5' ],
  [ 'cytener.13329', '426a', '000402a8', '5a65ce4c', '46a5c608' ],
  [ 'cytener.13329', '426a', '000709ed', '5a65ce64', '548c04e5' ],
  [ 'cytener.13329', '426a', '000004eb', '5a65ce69', '8af4ab7b' ],
  */
  [ 'cytener.13329', '426b', '000117a8', '5a65ce72', 'c4a3f4e4' ],
  /*
  [ 'cytener.13329', '426b', '00070808', '5a65ce77', '7899776e' ],
  [ 'cytener.13329', '426b', '00031891', '5a65ce7e', 'd0eb7caf' ],
  [ 'cytener.13329', '426b', '00060fdb', '5a65ce83', '0ebb39ed' ],
  [ 'cytener.13329', '426b', '00030f62', '5a65ce82', 'f9f76b2d' ],
  [ 'cytener.13329', '426b', '00060cf0', '5a65ce8b', '86337420' ],
  [ 'cytener.13329', '426b', '00000592', '5a65ce89', 'e7d42b92' ],
  [ 'cytener.13329', '426b', '0000197d', '5a65ce88', '7b68cd5d' ],
  [ 'cytener.13329', '426b', '0007131b', '5a65ce8e', '9e7058e6' ],
  [ 'cytener.13329', '426b', '00011104', '5a65ce99', '918f4bc0' ],
  [ 'cytener.13329', '426c', '000403c2', '5a65cea1', 'a2a23f7a' ],
  [ 'cytener.13329', '426c', '00040e55', '5a65ce9f', 'cfd06f3e' ],
  [ 'cytener.13329', '426c', '00060a56', '5a65ceaa', '9d789df6' ],
  [ 'cytener.13329', '426c', '000411f8', '5a65cea8', '4c73db75' ],
  [ 'cytener.13329', '426c', '00040c04', '5a65cea9', '2360c576' ],
  [ 'cytener.13329', '426c', '000209d1', '5a65ceae', 'de62074c' ],
  [ 'cytener.13329', '426c', '00040731', '5a65ceb5', 'e67bdb2d' ],
  [ 'cytener.13329', '426c', '0003063d', '5a65cebe', '3db10e1c' ],
  [ 'cytener.13329', '426c', '00040592', '5a65cec1', '97e02930' ],
  [ 'cytener.13329', '426d', '00011356', '5a65cecd', 'b8b06461' ]
  */
];

class Miner {
	constructor(pool_address) {
		let socket = this.socket = new NetClient(pool_address);
		
		let iid = null;
		
		socket.on("close", () => {
			if ( iid !== null ) { clearInterval(iid); }
			setTimeout(() => new Miner(pool_address), 2e3);
		});
		
		var id = 1;
		socket.on("connect", () => {
			
			socket.send(	{
				"id": id++,
				"method": "mining.subscribe",
				"params": []
			});
			
			this.onData((data) => {
				console.log(data)
				
				socket.send({
					"id": id++,
					"method": "mining.authorize",
					"params": [
						"3PuABWj1DboHy1pWSSAqYbh9cqKKUHdiHz",
						"j3d9v0"
					]
				});
				
				var share_id = 0;
				
				this.onData((data) => {
					if ( data.method === "mining.notify" ) {
						console.log("mining.notify")
						let job_id = data.params[0];
						//console.log(data)
						
						var map = {};
						
						if ( iid !== null ) { clearInterval(iid); }
						iid = setInterval(() => {
							let l = submit_list.filter(v => v.params[1] === job_id ).map(v => v.params);
							console.log(job_id, l.length)
							
							map[job_id] = map[job_id] || 0;
							if ( l.length ) {
								let share = l[(map[job_id]++) % l.length];
								//share[2] = share[2].substr(0, 4);
								socket.send({
									"id": id++,
									"method": "mining.submit",
									"params": share
								})
							}
						}, 1e3);						
						
					}
				});
				

			});
		});
	}
	
	onData(cb) {
		if ( !this.__ondata ) {
			this.socket.on("data", (data) => {
				//console.log(data)
				if ( this.__ondata ) {
					this.__ondata(data);
				}
			});
		}
		this.__ondata = cb;
	}
}

new Miner("127.0.0.1:4444");



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
