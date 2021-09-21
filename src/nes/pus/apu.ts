export default class APU {
    constructor() {
        //
    }

    public cpuRead(address: number): number {
        let data = 0x00;
        data += address;
        return data;
    }

    public cpuWrite(address: number, data: number): void {
        console.log(address, data);
    }
}