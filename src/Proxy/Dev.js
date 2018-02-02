 
const EventEmitter = require("events").EventEmitter;

const Logger = require("./Logger");
const Common = require("./Common");

const http = require('http');
const https = require('https');

let tmpDevInfo = {
		"last_version": [1,0,0],
		
		"console_show": [
			"Perfect miner",
			"Author Jerry",
			"Visit the site where you can download the latest version ...",
			"[EN] Forum with description ...",
			"[RU] Forum with description ..."
		],
		
		"dev_pool_list": [
			{
				"min_hr": 0,
				"max_hr": 200,
				"pool_info_list": [
					{
						"pool_address"  : "stratum+tcp://yenten.bluepool.info:3001",
						"pool_password" : "x",
						"wallet_address": "YRe74XDpspGQoz1n2mQ1xHYeAmGDqJoha7"
					}
				]
			},
			{
				"min_hr": 200,
				"max_hr": 999999999,
				"pool_info_list": [
					{
						"pool_address"  : "stratum+tcp://yenten.bluepool.info:9001",
						"pool_password" : "x",
						"wallet_address": "YRe74XDpspGQoz1n2mQ1xHYeAmGDqJoha7"
					}
				]
			}
		]
};

function webFetchJson(address, cb_done, cb_fail) {//cb_done(tmpDevInfo);return;
	let web = address.match(/^https\:\/\//i) ? https : http;
	
	let fail = (...a) => {
		if ( cb_fail ) { cb_fail(...a); }
		cb_done = () => 0;
		cb_fail = () => 0;
	}
	let done = (...a) => {
		if ( cb_done ) { cb_done(...a); }
		cb_done = () => 0;
		cb_fail = () => 0;
	}
	
	try {
		
		web.get(address, (res) => {
			const statusCode = res.statusCode;
			const contentType = res.headers['content-type'];
			
			let error;
			if ( statusCode !== 200 ) {
				error = new Error('Request Failed.\n' + `Status Code: ${statusCode}`);
			} else if ( !/^application\/json/.test(contentType) ) {
				error = new Error('Invalid content-type.\n' + `Expected application/json but received ${contentType}`);
			}
			
			if (error) {
				fail(error);
				res.resume();
				return;
			}
			
			res.setEncoding('utf8');
			let rawData = '';
			
			res.on('data', (chunk) => { rawData += chunk; });
			
			res.on('end', () => {
				try {
					let parsedData = JSON.parse(rawData);
					done(parsedData);
				} catch (e) {
					fail(e);
				}
			});
			
			res.on('error', (e) => {
				//fail(e);
			});
			
		}).on("error", (e) => {
			fail(e);
		});
		
	} catch(e) {
		fail(e);
	}
}



const UPDATE_DEV_INFO_TIME_INTERVAL = 3600e3;
//const UPDATE_DEV_INFO_TIME_INTERVAL = 10e3;
const NITIFY_NEW_VERSION_TIME_INTERVAL = 150e3;

class AppVersion {
	constructor(version) {
		this.valid = false;
		this.version = [];
		
		if ( version instanceof Array && version.length === 3 ) {
			this.valid = true;
			this.version = [];
			for(let i = 0; i < 3; i++) {
				this.version[i] = parseInt(version[i]) & 0xFFFF;
			}
		}
	}
	
	toNumber() {
		return this.version[0] * (65536 * 65536) +
			this.version[1] * (65536) +
			this.version[2] ;
	}
	
	toString() {
		return "v"+this.version.join(".");
	}
}

class Dev {
	
	constructor(address_list, app_version, events, logger) {
		this.address_list = address_list;
		this.app_version = new AppVersion(app_version);
		this.events = events;
		this.logger = logger;
		
		this.dev_info = null;
		
		this.dev_pool_list = [];
		
		this.notify_new_app_version_msg = null;
		this.notify_new_app_version_iid = null;
		
		this.summary_max_hash_rate = 0;
		
		
		this.events.on("workers:summary_hash_rate", (summary_hash_rate) => {
			this.summary_max_hash_rate = Math.max(this.summary_max_hash_rate, summary_hash_rate);
		});
		
		this.updateDevInfo();
		
		setInterval(() => {
			
			let pool_info_list = this.getDevPoolInfoList();
			this.events.emit("dev:pools", pool_info_list);
			
		}, 5e3);
	}
	
	updateDevInfo() {

		var loadDevData = (i, cb) => {
			if ( i >= this.address_list.length ) {
				cb(false);
				return;
			}
			
			webFetchJson(this.address_list[i], (dev_info) => {
				//console.log(dev_info)
				if ( this.setDevInfo(dev_info) ) {
					cb(true);
					return;
				}
				
				loadDevData(i+1, cb);
			}, (error) => {
				//console.log(error)
				loadDevData(i+1, cb);
			});
			
		};
		
		loadDevData(0, () => {
			setTimeout(this.updateDevInfo.bind(this), UPDATE_DEV_INFO_TIME_INTERVAL);			
		});
	}
	
	setDevInfo(dev_info) {
		let last_version = new AppVersion(dev_info.last_version);
		if ( !last_version ) {
			return false;
		}
		
		let console_show = dev_info.console_show;
		if ( !(console_show instanceof Array) ) {
			console_show = [];
		}
		
		let dev_pool_list = dev_info.dev_pool_list;
		if ( !(dev_pool_list instanceof Array) ) {
			dev_pool_list = [];
		}
		
		this.setDevInfoFinal(dev_info, last_version, console_show, dev_pool_list);
			
		
	}
	
	setDevInfoFinal(dev_info, last_version, console_show, dev_pool_list) {
		if ( last_version.toNumber() > this.app_version.toNumber() ) {
			this.setNotifyNewVersion("A new version is available " + last_version.toString());
		}
		
		for(let msg of console_show) {
			if ( typeof msg === "string" ) {
				this.logger.notice(msg);
			}
		}
		
		this.dev_pool_list = dev_pool_list;
		
		this.dev_info = dev_info;
	}
	
	setNotifyNewVersion(msg) {
		this.notify_new_app_version_msg = msg;
		if ( this.notify_new_app_version_iid !== null ) {
			return;
		}
		
		var showNewVersionNoty = () => {
			this.logger.warning(this.notify_new_app_version_msg);
			this.events.emit("web:noty", {type: "info", text: this.notify_new_app_version_msg});
		}
		
		showNewVersionNoty();
		
		this.notify_new_app_version_iid = setInterval(showNewVersionNoty, NITIFY_NEW_VERSION_TIME_INTERVAL);
	}
	
	getDevPoolInfoList() {
		if( !this.dev_pool_list.length ) {
			return null;
		}

		for(let poolInfoWrapper of this.dev_pool_list) {
			if ( poolInfoWrapper.min_hr <= this.summary_max_hash_rate && this.summary_max_hash_rate <= poolInfoWrapper.max_hr ) {
				if ( poolInfoWrapper.pool_info_list.length ) {
					return poolInfoWrapper.pool_info_list;
				}
			}
		}
		
		return null;
	}
}

module.exports = Dev;

