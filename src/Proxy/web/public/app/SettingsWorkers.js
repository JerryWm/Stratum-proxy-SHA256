define(["app/Common", "app/CommonView", "app/UnPackArray", ], function(Common, CommonView, UnPackArray, _SettingsWorker) {

	function SettingsWorkers(socketIo) {
		var self = this;

		this.workers = [];
		
		this.socketIo = socketIo;
		
		var CONST_PROCESS_PRIORITY_MAP = [
			{id: 3, name: 'REALTIME'},
			{id: 2, name: 'HIGH'},
			{id: 1, name: 'NORMAL'},
			{id: 0, name: 'IDLE'},
		];
		
		var CONST_THREAD_PRIORITY_MAP = [
			{id: 4, name: 'TIME_CRITICAL'},
			{id: 3, name: 'HIGHEST'}, 
			{id: 2, name: 'NORMAL'}, 
			{id: 1, name: 'LOWEST'}, 
			{id: 0, name: 'IDLE'}, 
		];
		
		function prioToName(map, prio) {
			for(var i in map) {
				if ( parseInt(map[i].id) === parseInt(prio) ) {
					return map[i].name;
				}
			}

			return "UNDEFINED";
		}
		function procPrioToName(prio) {
			return prioToName(CONST_PROCESS_PRIORITY_MAP, prio);
		}
		function thrPrioToName(prio) {
			return prioToName(CONST_THREAD_PRIORITY_MAP, prio);
		}
		

		this.vmSettingsPools = new Vue({
			el: "#app-settings-workers",
			
			data: {
				thread_priority_map: CONST_THREAD_PRIORITY_MAP,
				process_priority_map: CONST_PROCESS_PRIORITY_MAP,
				
				workers: {},
			}, 
			
			methods: {
				onInputSelect: function(e, worker, prop_name) {
					if ( (e instanceof Object) && ('target' in e) && ('value' in e.target) ) {
						Vue.set(worker, prop_name, e.target.value);
						socketIo.emit("control:worker:options", worker);
					}
				},
				
				onClickBtn_StartStop: function(e, worker) {
					switch(worker.state) {
						case "working":
							socketIo.emit("control:worker:stop", worker);
							break;
							
						case "stopped":
							socketIo.emit("control:worker:start", worker);
							break;
							
					}
				},
				
				onClickBtn_Selftest: function(e, worker) {
					socketIo.emit("control:worker:selftest", worker);
				},
				
				onInputText_Name: function(e, worker) {
					if ( (e instanceof Object) && ('target' in e) && ('value' in e.target) ) {
						Vue.set(worker, "name", e.target.value);
						socketIo.emit("control:worker:options:name", worker);
					}
				},
			
				onClickBtn_ShowInfo: function(e, worker) {
					popoverWorkerInfo(e, worker);
				}
			}
		});
		
		window.vmSettingsPools = self.vmSettingsPools;
		
		
		socketIo.on("control:workers", function(workers) {
			for(var i in workers) {
				var worker = workers[i];
				
				Vue.set(self.vmSettingsPools.workers, worker.id, {
					id      : worker.id,
					address : worker.address,
					name    : worker.name,
					hashrate: worker.hashrate,
					process_priority: worker.process_priority,
					thread_priority : worker.thread_priority,
					thread_count    : worker.thread_count,
					cpu_count       : worker.cpu_count,
					lock            : worker.lock,
					state           : worker.state,
					state_selftest  : worker.state_selftest,
					worker_path     : worker.worker_path,
					hash_rate       : worker.hash_rate,
					workers_info    : worker.workers_info,
				});
			}
		});
		
		socketIo.on("control:workers:remove", function(worker_id) {
			Vue.delete(self.vmSettingsPools.workers, worker_id);
		});
		
		socketIo.on("workers_info_mini_v2", function(workersArrayInfo) {
			for(var i = 0; i < workersArrayInfo.length; i += 4) {
				var id = workersArrayInfo[i + 0];
				
				if ( self.vmSettingsPools.workers[id] )
					Vue.set(self.vmSettingsPools.workers[id], "hash_rate", workersArrayInfo[i + 3]);
			}
		});
		
		function popoverWorkerInfo(e, worker) {
			var $elem = $(e.target);
			
			var workers_info_html = "";
			if ( worker.workers_info instanceof Array ) {
				for(var i in worker.workers_info) {
					var worker_info = worker.workers_info[i];
					
					workers_info_html += `
					<tr>
						<td>${i}</td>
						<td>${worker_info.processor_package_index}</td>
						<td>${worker_info.processor_core_index}</td>
						<td>${worker_info.processor_logical_index}</td>
						<td>${worker_info.numa_node_index}</td>
						<td>${procPrioToName(worker_info.process_priority)}</td>
						<td>${thrPrioToName(worker_info.thread_priority)}</td>
						<td>${worker_info.large_page}</td>
					</tr>
					`;
				}
			}

			$elem.attr("data-template", "")

			$elem.attr("tabindex", "0");
			$elem.attr("title", "Worker info");
//			$elem.attr("data-trigger", "focus");
			$elem.attr("data-content", `
						<table class="table table-hover">
							<tr><td>Id</td><td>${Common.escapeHtml(worker.id)}</td></tr>
							<tr><td>Address</td><td>${Common.escapeHtml(worker.address)}</td></tr>

							<tr>
								<td>System info</td>
								<td>
									<table class="table table-sm " style="text-align: center;">
										<thead>
											<tr>
												<td>#</td>
												<td>Package processor</td>
												<td>Core processor</td>
												<td>Logical processor</td>
												<td>Numa node</td>
												<td>Process priority</td>
												<td>Thread priority</td>
												<td>Large page</td>
											</tr>
										</thead>
										<tbody>
											${workers_info_html}
										</tbody>
									</table>
								<td>
							</tr>
						</table>
			`);
			$elem.attr("data-template", '<div class="popover" role="tooltip" style="max-width: none;"><div class="arrow"></div><h3 class="popover-header"></h3><div class="popover-body"></div></div>');
			$elem.popover({
				html: true,
			});
			$elem.popover('show');
			
		}
		
	}

	
	return SettingsWorkers;

});