define([], function() {
	
		Vue.component("settings-pool", {
			template: `
				<div style="margin: 5px" class="settings-pool-cnt row" >
					<div>
					
						<div class="btn-toolbar" role="toolbar" aria-label="Toolbar with button groups">
							<div class="btn-group" role="group" >
								<button v-bind:disabled="pool_lock" type="button" class="btn btn-success" v-if="!pool_count" v-on:click="$emit('command', {cmd:'connect', id: id})" >Connect</button>
								<button v-bind:disabled="pool_lock" type="button" class="btn btn-danger" v-if="pool_count" v-on:click="$emit('command', {cmd:'disconnect', id: id})" >Disconnect</button>
								
								<span class="input-group-addon btn" v-on:click="pool_cfg_show = !pool_cfg_show">{{ pool_address }}</span>
								
					
								<button v-bind:disabled="pool_lock" type="button" class="btn btn-danger" v-on:click="$emit('command', {cmd:'remove_pool', id: id})" >X</button>
							</div>
						</div>
						
						<div v-show="pool_cfg_show" class="settings-pool" >
						
							<div class="input-group input-group-sm col-xs-4">
							  <span class="input-group-addon" >Address</span>
							  <input v-bind:disabled="pool_lock" type="text" class="form-control" placeholder="Pool address" aria-describedby="sizing-addon3" v-model.trim="pool_address" >
							</div>
						
							<div class="input-group input-group-sm col-xs-4">
							  <span class="input-group-addon" >Wallet</span>
							  <input v-bind:disabled="pool_lock" type="text" class="form-control" placeholder="Wallet address" aria-describedby="sizing-addon3" v-model.trim="wallet_address" >
							</div>
						
							<div class="input-group input-group-sm col-xs-4">
							  <span class="input-group-addon" >Password</span>
							  <input v-bind:disabled="pool_lock" type="text" class="form-control" placeholder="Pool password" aria-describedby="sizing-addon3" v-model.trim="pool_password" >
							</div>
						
							<div class="settings-pool-sm-options" style="display: inline-flex;"  >
								
								<div class="input-group input-group-sm  "  style=""  >
									<span class="input-group-addon" >Retry count connect</span>
									<input v-bind:disabled="pool_lock" class="form-control" placeholder="" type="number"  style="width: 60px" v-model="retry_count_connect" min="0" >
								</div>
								
								<div class="input-group input-group-sm  "  style=""  >
									<button v-bind:disabled="pool_lock" class="btn" v-on:click="savePool()">Save</button>
								</div>
							</div>
						</div>
					</div>
				</div>	
			`,
			
			props: ["id", "pool_address", "wallet_address", "pool_password", "keepalive", "keepalive_enable", "pool_count", "emu_nicehash", "max_workers", "retry_count_connect", "pool_lock"],
			
			data: function() {
				return {
					pool_cfg_show: false
				}
			},
			
			methods: {
				savePool: function(id) {
					this.$emit('command', {cmd:'save_pool', 
						
						id: this.id,
						
						pool: {
							pool_address       : this.pool_address,
							wallet_address     : this.wallet_address,
							pool_password      : this.pool_password,
							keepalive          : this.keepalive_enable ? this.keepalive : null,
							emu_nicehash       : this.emu_nicehash,
							max_workers        : this.max_workers,
							retry_count_connect: this.retry_count_connect,
						},
						
					});
				}, 
			}
		});
		
});