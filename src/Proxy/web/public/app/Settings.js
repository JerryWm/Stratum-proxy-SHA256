define(["app/Common", "app/CommonView", "app/UnPackArray"], function(Common, CommonView, UnPackArray) {

	function Settings(socketIo) {
		var self = this;

		this.settings = {};
		this.settings.pools = [];
		this.pools = [];
		
		this.socketIo = socketIo;

		
		/** DEV fee */
		const DEV_FEE_MAP = [
			{value: 4, name: "4%"},
			{value: 3, name: "3%"},
			{value: 2, name: "2%"},
			{value: 1, name: "1%"},
		];
		
		this.vmSettingsDevFee = new Vue({
			el: "#dev-fee-settings",
			data: {
				dev_fee: 4,
				dev_fee_map: DEV_FEE_MAP,
				lock: false
			},
			methods: {
				changeDevFee: function(dev_fee) {
					dev_fee = parseInt(dev_fee);
					var map = [1,2,3,4];
					if ( map.indexOf(dev_fee) < 0 ) {
						dev_fee = 4;
					}
					
					socketIo.emit("control:settings:dev_fee", dev_fee);
				}
			}
		});
		
		socketIo.on("control:settings:dev_fee", function(dev_fee) {
			self.vmSettingsDevFee.dev_fee = dev_fee;
		});
		socketIo.on("control:settings:dev_fee_lock", function(lock) {
			self.vmSettingsDevFee.lock = lock;
		});
		
		
		
		this.vmSettingsPools = new Vue({
			el: "#app-settings",
			data: {
				lock: false,
				pool_lock: false,
				pools: [],
			},
			methods: {
				updatePool: function(pool) {
					if ( this.pools[pool.id] ) {
						this.pools[pool.id] = pool;
					}
					
					self.socketIo.emit("control:settings:pools:change", this.pools);
				},
				
				onCommandPool: function(cmdInfo) {
					switch(cmdInfo.cmd) {
						case "connect":
							self.socketIo.emit("control:command:pool:connect", cmdInfo.id);
							break;
							
						case "disconnect":
							self.socketIo.emit("control:command:pool:disconnect", cmdInfo.id);
							break;
							
						case "remove_pool":
							if ( self.settings.pools[cmdInfo.id] ) {
								self.settings.pools.splice(cmdInfo.id, 1);
							}
							
							self.socketIo.emit("control:settings:change", self.settings);
							break;
							
						case "add_pool":
							self.settings.pools.push({
								pool_address: "stratum+tcp://127.0.0.1:2222",
								wallet_address: "my-wallet",
								pool_password: "x",
								emu_nicehash: false,
								keepalive: null,
								max_workers: 100,
							});
							
							self.socketIo.emit("control:settings:change", self.settings);
							break;
							
						case "save_pool":
							if ( this.pools[cmdInfo.id] ) {
								self.settings.pools[cmdInfo.id] = cmdInfo.pool;
								self.socketIo.emit("control:settings:change", self.settings);
							}
							break;
					}
				}
			}
		});		
	
		socketIo.on("control:settings", function(settings) {
			self.settings = settings;

			self.vmSettingsPools.lock = settings.lock;
			self.vmSettingsPools.pools  = [];
			
			for(var i in settings.pools) {
				var pool = settings.pools[i];
				
				if ( pool.pool_count === undefined ) {
					pool.pool_count = 0;
				}
				
				self.vmSettingsPools.pools.push(pool);
				
				({
					pool_address       : pool.pool_address || "",
					wallet_address     : pool.wallet_address || "",
					pool_password      : pool.pool_password,
					max_workers        : pool.max_workers,
					keepalive          : pool.keepalive,
					emu_nicehash       : pool.emu_nicehash,
					retry_count_connect: pool.retry_count_connect,
					
					pool_count         : pool.pool_count || 0,
				});
			}
		});
	
		socketIo.on("control:command:pool:disconnect", function() {
			for(var i in self.vmSettingsPools.pools) {
				self.vmSettingsPools.pools[i].pool_count = 0;
			}
		});
		
		socketIo.on("control:command:pool:connect", function(poolIndex) {
			if ( self.vmSettingsPools.pools[poolIndex] ) {
				self.vmSettingsPools.pools[poolIndex].pool_count = 1;
			}
		});
		
		window.wm=self.vmSettingsPools;
	}

	
	return Settings;

});