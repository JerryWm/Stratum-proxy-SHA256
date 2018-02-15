define(["app/Common", "app/CommonView", "app/UnPackArray"], function(Common, CommonView, UnPackArray) {

	function SettingsPoolGroupList(socketIo) {
		var self = this;

		this.settings = {};
		this.settings.pools = [];
		this.pools = [];
		
		this.socketIo = socketIo;

		
		function getUId() {
			var s = "id_";
			for(var i = 0; i < 32; i++) {
				s += Math.random().toString(36).substr(2, 1);
			}
			return s;
		}
		
		function getPoolGroupTemplate() {
			return {
				id: getUId(),
				height: 0,
				pool_group_name: "",
				pool_list: [],

				_state: "disconnected",
				_show_pool_list: true,
			};
		}
		function getPoolTemplate() {
			return {
				id: getUId(),
				height: 0,
				pool: {
					address: "",
					login: "",
					password: "",
					retry_count_connect: 5,
				},
				
				_state: "disconnected",
			};
		}
		/**
			web:control:client:settings:pool_group_list:update
		*/
		
		
		this.vmSettingsPoolGroupList = new Vue({
			el: "#settings-pool-group-list",
			
			data: {
				pool_group_list_lock: true,
				
				pool_group_list_update_lock: true,
				
				pool_group_list: [],
			},
			
			methods: {
				addPoolGroup() {
					this.pool_group_list.push( getPoolGroupTemplate() );
					
					this._upatePoolGroupList();
				},
				delPoolGroup(pool_group) {
					this._getPoolGroup(pool_group.id) && this.pool_group_list.splice(this._getPoolGroup(pool_group.id).pool_group_index, 1);
					
					this._upatePoolGroupList();
				},
				savePoolGroup(pool_group) {
					this._upatePoolGroupList();
				},
				connectPoolGroup(pool_group) {
					socketIo.emit("web:control:client:settings:pool_group:connect", pool_group.id);
				},
				disconnectPoolGroup(pool_group) {
					socketIo.emit("web:control:client:settings:pool_group:disconnect", pool_group.id);
				},
				movePoolGroup(pool_group, type) {
					switch(type) {
						case "up":
							pool_group.height -= 1.5;
							break;
							
						case "down":
							pool_group.height += 1.5;
							break;
					}

					this.pool_group_list.sort(function(l, r) {
						return l.height - r.height;
					});
					this.pool_group_list.map(function(v, i) {
						v.height = parseInt(i);
					});
				
					this._upatePoolGroupList();
				},
				
				addPool(pool_group) {
					pool_group.pool_list.push( Object.assign(getPoolTemplate(), {height: pool_group.pool_list.length}) );
					
					this._upatePoolGroupList();
				},
				delPool(pool_group, pool) {
					this._getPool(pool_group.id, pool.id) && pool_group.pool_list.splice(this._getPool(pool_group.id, pool.id).pool_index, 1);			

					this._upatePoolGroupList();				
				},
				movePool(pool_group, pool, type) {
					switch(type) {
						case "up":
							pool.height -= 1.5;
							break;
							
						case "down":
							pool.height += 1.5;
							break;
					}

					pool_group.pool_list.sort(function(l, r) {
						return l.height - r.height;
					});
					for(var i in pool_group.pool_list) {
						pool_group.pool_list[i].height = parseInt(i);
					}					
				
					this._upatePoolGroupList();
				},
				savePool(pool_group, pool) {
					this._upatePoolGroupList();
				},
				checkConnectPool(pool_group, pool) {
					pool_info = this._getPool(pool_group.id, pool.id);
					if ( !pool_info ) { return; }

					socketIo.emit("web:control:client:settings:pool_group:pool:check_connect", pool_info.pool_group.id, pool_info.pool.id);
				},

				
				
				_getPoolGroup(pool_group_id) {
					for(var i in this.pool_group_list) {
						if ( this.pool_group_list[i].id === pool_group_id ) {
							return {
								pool_group_index: i,
								pool_group: this.pool_group_list[i],
							};
						}
					}
					
					return null;
				},
				_getPool(pool_group_id, pool_id) {
					var pool_group = this._getPoolGroup(pool_group_id);
					if ( !pool_group ) {
						return null;
					}
					
					for(var i in pool_group.pool_group.pool_list) {
						if ( pool_group.pool_group.pool_list[i].id === pool_id ) {
							return {
								pool_group_index: pool_group.pool_group_index,
								pool_group: pool_group.pool_group,
								
								pool_index: i,
								pool: pool_group.pool_group.pool_list[i],
							};
						}
					}
					
					return null;
				},				
			
				_upatePoolGroupList() {
					
					//console.log(JSON.stringify(this.pool_group_list, null, "	"));
					socketIo.emit("web:control:client:settings:pool_group_list:update", this.pool_group_list);
				},
				
				_upateServerPoolGroupList(pool_group_list) {
					Vue.set(this, "pool_group_list", pool_group_list);
				},
				_upateServerPoolGroupListLock(pool_group_list_lock) {
					Vue.set(this, "pool_group_list_lock", pool_group_list_lock);
				},
				_upateServerPoolGroupListUpdateLock(pool_group_list_update_lock) {
					Vue.set(this, "pool_group_list_update_lock", pool_group_list_update_lock);
				}
			},
			
			
		});		
	
		this.socketIo.on("web:control:server:settings:pool_group_list:update", function(pool_group_list) {
			for(var i in pool_group_list) {
				var pool_group_info = self.vmSettingsPoolGroupList._getPoolGroup(pool_group_list[i].id);
				if ( pool_group_info ) {
					pool_group_list[i]._show_pool_list = pool_group_info.pool_group._show_pool_list;
				}
			}
			
			self.vmSettingsPoolGroupList._upateServerPoolGroupList(pool_group_list);
		});
		this.socketIo.on("web:control:server:settings:pool_group_list_lock:update", function(pool_group_list_lock) {
			self.vmSettingsPoolGroupList._upateServerPoolGroupListLock(pool_group_list_lock);
		});
		this.socketIo.on("web:control:server:settings:pool_group_list_update_lock:update", function(pool_group_list_update_lock) {
			self.vmSettingsPoolGroupList._upateServerPoolGroupListUpdateLock(pool_group_list_update_lock);
		});
		this.socketIo.on("web:control:server:settings:pool_group:pool:check_connect", function(info) {
			var pool_info = self.vmSettingsPoolGroupList._getPool(info.pool_group_id, info.pool_id);
			if ( !pool_info ) {
				return;
			}
			
			var $pool_tr = $("[pool_group_pool_id="+info.pool_id+"]");
			if ( !$pool_tr.length ) {
				return;
			}
			
			var style = "";
			var title = "";
			if ( info.result ) {
				style = "background: #AAAAAA; color: #0f0;";
				title = "Successful";
			} else {
				style = "background: #AAAAAA; color: #f00;";
				title = info.error;
			}
			
			$pool_tr.tooltip({
				html: false,
				template: `
					<div class="tooltip" role="tooltip">
						<div class="arrow"></div>
						<div class="tooltip-inner" style="${style};"></div>
					</div>`,
				title: title,
				trigger: "manual"
			});
			$pool_tr.tooltip("show");
			var cb;
			$(document).on("click", cb = function() {
				$pool_tr.tooltip("hide");
				$pool_tr.tooltip('dispose');
				$(document).off("click", cb);
			});
			
		});
	 
		window.vmSettingsPoolGroupList = this.vmSettingsPoolGroupList;
	}

	
	return SettingsPoolGroupList;

});