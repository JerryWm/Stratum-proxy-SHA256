const CFG_PATH = "server.json";
const CFG_POOLS_PATH = "pools.json";
const CFG_SETTINGS_PATH = "./app/resources/settings.json";

const PATH_NODE       = "./app/x86/nodejs/node.exe";
const PATH_CLIENT_APP = "./app/x86/nodejs/app/ControlClient";

const Paths = require('./Paths');

const fs = require('fs');
const EventEmitter = require('events').EventEmitter;

const Logger = require("./Logger");
const Common = require("./Common");
const WebServer = require("./WebServer");

const StratumConfig = require("./StratumConfig");
const StratumCommon = require("./StratumCommon");
const StratumProxy = require("./StratumProxy");

const Dev          = require("./Dev");

const WebStatPools          = require("./WebStat/Pools");
const WebStatWorkers        = require("./WebStat/Workers");
const WebStatJobs           = require("./WebStat/Jobs");
const WebStatShares         = require("./WebStat/Shares");
const WebStatLogs           = require("./WebStat/Logs");
const WebStatGlobalHashRate = require("./WebStat/GlobalHashRate");
const WebNoty               = require("./WebStat/Noty");
const WebAuth               = require("./WebAuth");
const WebControl            = require("./WebControl");
//const WebControlWorkers     = require("./WebControlWorkers");

const NetServerEventEmitter = require('./../Share/Net/NetServerEventEmitter');

function getConfig(logger, path) {
	let config = null;
	
	try {
		let file = require('fs').readFileSync(path, 'utf8');
		
		eval('var _cfg = ' + file);

		config = _cfg;
	} catch(e) {
		config = null;
		logger.error("Config \"" + path + "\" not found, or config file invalid json");
	}
	
	return config;
}

const spawn = require('child_process').spawn;



function parseArgv() {
	let map = Object.create(null);
	
	for(let i = 0; i < process.argv.length; i++) {
		let arg = process.argv[i];
		if ( arg.length && arg[0] === "-" ) {
			map[arg.substr(1)] = process.argv[i+1];
			i++;
		}
	}
	
	return map;
}

function simpleMode(events, argv) {
	events.on("workers:server:listening", (server, address) => {
		let hostport = `ssl://${address.address}:${address.port}`;
		
		let fArgv = [];
		fArgv.push(argv.path_app_client);
		for(let i in argv) {
			fArgv.push("-" + i, argv[i]);
		}
		fArgv.push("-address", hostport);
		
		this.program = spawn(argv.path_node, fArgv);
		this.program.on('error', (data) => {});
		this.program.on('close', (data) => {});
	});
	
	events.on("web:server:listening", (sv, address) => {
		
		require('child_process').exec("explorer http://" + `${address.address}:${address.port}`);
		
	});
}
function getConfigSimplieMode(events, logger) {
	let argv = parseArgv();
	
	let cfg;

	if ( argv.mode === "simple" ) {
		simpleMode(events, argv);
		
		cfg = {
			servers: [{
				bind_address: "127.0.0.1:0",
				ssl: true,
			},],	
			web_server: {
				enable: true,
				bind_address: "127.0.0.1:0",
				auth_key: "",
				open_browser: false,
			},
		};
		
	} else {
		cfg = getConfig(logger, CFG_PATH);
	}	
	
	return cfg;
}


const StratumClient = require("./StratumClient");

const JsonRpcClient = require("./../Share/JsonRpc/JsonRpcClient");
const __StratumClient = require("./Stratum/StratumClient");


function main(logger) {
	let events = new EventEmitter(); events.setMaxListeners(20);
	
	let cfg = getConfigSimplieMode(events, logger);
	
	if ( !cfg ) {
		setTimeout(() => main(logger), 5e3);
		return;
	}
	
	let http_addr_info = Common.addressEx(cfg.web_server.bind_address);
		
	if ( !http_addr_info ) {
		logger.error("Invalid bind address for web server");
		setTimeout(() => main(logger), 5e3);
		return;
	}

	///	############## web server
	let webServerCreate = () => new WebServer(cfg.web_server.bind_address, [Paths.APP_WEB_PUBLIC_DIR], events, logger);
	events.on("web:server:close", ()=> setTimeout(webServerCreate, 5e3));
	webServerCreate();

	new WebStatPools(events);
	new WebStatWorkers(events);
	new WebStatJobs(events);
	new WebStatShares(events);
	new WebStatLogs(events, logger);
	new WebStatGlobalHashRate(events);

	new WebNoty(events);
			
	new WebAuth(cfg.web_server.auth_key, events);
			
	if ( cfg.web_server.open_browser ) {
		require('child_process').exec("explorer http://" + (( http_addr_info[0] === "0.0.0.0" ) ? "127.0.0.1" : http_addr_info[0]) + ":" + http_addr_info[1]);
	}

	
	
	new StratumProxy(cfg, null, events, logger);
		
	///	############## control
	let settings = {};
	try { settings = JSON.parse(fs.readFileSync(CFG_SETTINGS_PATH, "utf8")); } catch(e) {logger.error("Invalid settings \""+CFG_SETTINGS_PATH+"\"");}
	new WebControl(events, settings);
	//new WebControlWorkers(events);
		
		
	
	new Dev([
		"https://jerrywm.github.io/update-info/stratum-proxy-sha256/data.json"
	], [1,0,0], events, logger);
	
		

	events.on("config:settings:save", (settings) => {
		let json = JSON.stringify(settings, null, '	');
		fs.writeFileSync(CFG_SETTINGS_PATH, json);
	});		
}



main(
	new Logger((log) => {
		let d = new Date();
		console.log(`[${d.toLocaleDateString()} ${d.toLocaleTimeString()}] ${log}`);
	}, "APP")
);

/***********************************/
