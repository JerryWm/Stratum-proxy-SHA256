
const Common = require("../Common");
const PackArray = require("../PackArray");
const WebStatBase = require("./WebStatBase");

class Noty extends WebStatBase {
	constructor(events) {
		super(events);
		
		events.on("web:noty:error", (text) => {
			this.webEmit("web:noty", {type: "error", text: text});
		});
		
		events.on("web:noty", (obj) => {
			obj.type = obj.type || "info";
			obj.text = obj.text || "";
			this.webEmit("web:noty", obj);
		});
	}
}

module.exports = Noty;
