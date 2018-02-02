
const Common = require("../Common");
const PackArray = require("../PackArray");
const WebStatBase = require("./WebStatBase");

class Shares extends WebStatBase {
	constructor(events) {
		super(events);

		this.sharesArchive = new PackArray(1024*1024);

		this.pools_share_last_time = Object.create(null);
		
		events.on("web:server:connect_web_socket", (socket) => {
			this.webEmit("sharesArchive", this.sharesArchive.getData(), socket);
		});

		events.on("stratum:client:connect", (origPool) => this.pools_share_last_time[origPool.id] = Common.currTimeMiliSec());
		events.on("stratum:client:close", (origPool) => delete this.pools_share_last_time[origPool.id]);
		
		events.on("stratum:client:accepted_share", (origPool, origShare, msg) => {
			this.processShare(origPool, origShare, true, msg);
		});
		events.on("stratum:client:rejected_share", (origPool, origShare, msg) => {
			this.processShare(origPool, origShare, false, msg);
		});
	}

	processShare(origPool, origShare, isAccepted, msg) {
		let currTime = Common.currTimeMiliSec();
		let startTime = this.pools_share_last_time[origPool.id];
		this.pools_share_last_time[origPool.id] = currTime;

		let share = {
			id        : origShare.share_id,
			pool_id   : origShare.pool_id,
			worker_id : origShare.worker_id,
			job_id    : origShare.job_id,
			
			share     : {
				job_id    : origShare.share.job_id,
				nonce     : origShare.share.nonce,
				hash      : origShare.getHash(),
			},
			
			block_height: origShare.job.block_job.block_height,
			
			difficulty: origShare.job.block_job.difficulty_pool,
			difficulty_real: origShare.job.block_job.difficulty_real,
			
			status    : isAccepted ? "accepted" : "rejected",
			status_msg: msg,
			
			time_in_work: currTime - startTime,
			time_start  : startTime,
			time_end    : currTime,
			
			time: origShare.time,
		};
		
		this.sharesArchive.write("share", share);
		
		this.webEmit("shares", [share]);
	}
}

module.exports = Shares;
