import CPU from "./pus/cpu";
import PPU from "./pus/ppu";
import ROM from "./rom/rom";
import { isInRange } from "./utils/utils";

export default class Bus {
    /** Cartridge ROM */
    private rom: ROM | null;
    /** 2KB of internal RAM */
    private cpuRAM: Uint8Array = new Uint8Array(2048);

    private cpu: CPU;
    private ppu: PPU;

    constructor() {
        this.cpu = new CPU();
        this.ppu = new PPU();
        this.rom = null;
    }

    get ram(): Uint8Array {
        return this.cpuRAM;
    }

    get getCPU(): CPU {
        return this.cpu;
    }

    public connectRom(rom: ROM): void {
        this.rom = rom;
    }

    public loadChunkToRam(address: number, data: Uint8Array): void {
        const endAddr = address + data.byteLength;
        if (endAddr > this.cpuRAM.byteLength) {
            throw new Error("End index out of range. In other words - your bloody data is too long");
        }
            
        for (let i = address, j = 0; i < endAddr; i++, j++) {
            this.cpuRAM[i] = data[j];
        }
    }

    public write(address: number, val: number): void {
        // 2KB internal RAM
        // 0x0800-0x0FFF, 0x1000-0x17FF and 0x1800-0x1FFF mirror 0x0000-0x07FF
        if (isInRange(address, 0x0000, 0x1FFF)) {
            this.cpuRAM[address & 0x07FF] = val;
        }

        // PPU registers
        // Mirrors of 0x2000-0x2007 (repeats every 8 bytes) 
        if (isInRange(address, 0x2000, 0x3FFF)) {
            // val = 1;
            this.ppu.cpuWrite(address, val)
        }

        // NES APU and I/O registers
        if (isInRange(address, 0x4000, 0x4017)) {
            // val = 3;
        }

        // APU and I/O functionality that is normally disabled
        if (isInRange(address, 0x4018, 0x401F)) {
            // val = 4;
        }

        // Cartridge space
        // if (isInRange(address, 0x4020, 0xFFFF)) {
        //     // lolwut??????
        //     this.rom.cpuWrite(address, val);
        // }
        if (this.rom.cpuWrite(address, val)) {
            // be happy
        }
    }

    public read(address: number): number {
        let val = 0x00;

        // 2KB internal RAM
        // 0x0800-0x0FFF, 0x1000-0x17FF and 0x1800-0x1FFF mirror 0x0000-0x07FF
        if (isInRange(address, 0x0000, 0x1FFF)) {
            val = this.cpuRAM[address & 0x07FF];
        }

        // PPU registers
        // Mirrors of 0x2000-0x2007 (repeats every 8 bytes) 
        if (isInRange(address, 0x2000, 0x3FFF)) {
            this.ppu.cpuRead(address);
        }

        // NES APU and I/O registers
        if (isInRange(address, 0x4000, 0x4017)) {
            //
        }

        // APU and I/O functionality that is normally disabled
        if (isInRange(address, 0x4018, 0x401F)) {
            //
        }

        // Cartridge space
        // if (isInRange(address, 0x4020, 0xFFFF)) {
        //     val = this.rom.cpuRead(address);
        // }
        const temp = this.rom.cpuRead(address);
        if (temp) {
            val = temp;
        }

        return val;
    }
}