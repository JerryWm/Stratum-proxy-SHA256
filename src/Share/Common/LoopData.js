/**
1024, ["Uint32Array", "Float64Array"]
*/
class LoopData {
	constructor(count, ...data) {
		this.count = count;
		this.write_seq_num = 0;
		this.index = 0;
		this.array_list = [];
		
		for(let cl of data) {
			this.array_list.push(new cl(count));
		}
	}
	
	push(...values) {
		if ( values.length !== this.array_list.length ) {
			throw new Error("Invalid args");
		}
		
		let index = this.write_seq_num % this.count;
		for(let i = 0; i < values.length; i++) {
			this.array_list[i][ index ] = values[i];
		}
		
		this.write_seq_num++;
	}
	
	eachBack(filter) {
		let read_seq_num = this.write_seq_num - 1;
		if ( read_seq_num < 0 ) {
			return;
		}
		
		let read_seq_num_min = (read_seq_num < this.count) ? 0 : (read_seq_num - this.count + 1);
		
		while(read_seq_num >= read_seq_num_min) {
			let index = read_seq_num % this.count;
			let data = [];
			
			for(let i = 0; i < this.array_list.length; i++) {
				data.push(this.array_list[i][index]);
			}
			
			if ( !filter(...data) ) {
				break;
			}
			
			read_seq_num--;
		}
	}
}

module.exports = LoopData;