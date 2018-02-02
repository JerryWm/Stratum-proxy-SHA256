define(["app/Common", "app/CommonView", "app/UnPackArray"], function(Common, CommonView, UnPackArray) {

	function GlobalWorkersSummaryHashrate($el, socketIo, web) {
		this.$el = $el;
		this.web = web;
		this.$span = this.$el.find("> span");
		
		var self = this;
		
	
	
		this.vmSettingsDevFee = new Vue({
			el: "#global-workers-summary-hash-rate-cnt",
			data: {
				hash_rate: 0,
				dev_time: false,
			}
		});	
	
		socketIo.on("workers_summary_hash_rate", function(hash_rate) {
			self.vmSettingsDevFee.hash_rate = Common.doubleOrNA_kStyle(hash_rate);
		});
		
		
		socketIo.on("control:settings", function(settings) {
			self.vmSettingsDevFee.dev_time = !!settings.dev_time;
		});
	}

	
	
	return GlobalWorkersSummaryHashrate;

});