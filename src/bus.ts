import CPU from "./pus/cpu";
import PPU from "./pus/ppu";
import ROM from "./rom/rom";
import Display from "./utils/display";
import { isInRange } from "./utils/utils";

export default class Bus {
    /** Cartridge ROM */
    private rom: ROM | null;
    /** 2KB of internal RAM */
    private cpuRAM: Uint8Array = new Uint8Array(2048);

    private cpu: CPU;
    public ppu: PPU;

    private systemClock: number = 0;

    constructor() {
        this.cpu = new CPU();
        this.cpu.connectBus(this);
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
        this.ppu.connectRom(this.rom);
    }

    public connectDisplay(display: Display): void {
        this.ppu.connectDisplay(display);
    }
    
    public reset(): void {
        this.cpu.reset();
        this.ppu.reset();
    }

    public boot(): void {
        this.ppu.boot();
    }

    /**
     * Loads a given chunk of data into {@link cpuRAM RAM}
     * at a given starting address
     * @param address Starting address
     * @param data Program data to be loaded
     * @throws Error if the program data goes out of bounds of the RAM
     */
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
        // cartridge
        if (this.rom.cpuWrite(address, val)) {
            // be happy
        }
        // 2KB internal RAM
        // 0x0800-0x0FFF, 
        // 0x1000-0x17FF and 0x1800-0x1FFF mirror 0x0000-0x07FF
        else if (isInRange(address, 0x0000, 0x1FFF)) {
            this.cpuRAM[address & 0x07FF] = val;
        }

        // PPU registers
        // Mirrors of 0x2000-0x2007 (repeats every 8 bytes) 
        else if (isInRange(address, 0x2000, 0x3FFF)) {
            // val = 1;
            this.ppu.cpuWrite(address & 0x0007, val)
        }

        // NES APU and I/O registers
        else if (isInRange(address, 0x4000, 0x4017)) {
            // val = 3;
        }

        // APU and I/O functionality that is normally disabled
        else if (isInRange(address, 0x4018, 0x401F)) {
            // val = 4;
        }        
    }

    public read(address: number): number {
        let val = 0x00;

        // cartridge
        const temp = this.rom.cpuRead(address);
        if (temp !== null) {
            val = temp;
        }
        // 2KB internal RAM
        // 0x0800-0x0FFF, 0x1000-0x17FF and 0x1800-0x1FFF mirror 0x0000-0x07FF
        else if (isInRange(address, 0x0000, 0x1FFF)) {
            val = this.cpuRAM[address & 0x07FF];
        }

        // PPU registers
        // Mirrors of 0x2000-0x2007 (repeats every 8 bytes) 
        else if (isInRange(address, 0x2000, 0x3FFF)) {
            val = this.ppu.cpuRead(address & 0x0007);
        }

        // NES APU and I/O registers
        else if (isInRange(address, 0x4000, 0x4017)) {
            //
        }

        // APU and I/O functionality that is normally disabled
        else if (isInRange(address, 0x4018, 0x401F)) {
            //
        }

        return val;
    }

    public debugRead(address: number): number {
        let val = 0x00;

        // cartridge
        const temp = this.rom.cpuRead(address);
        if (temp !== null) {
            val = temp;
        }
        // 2KB internal RAM
        // 0x0800-0x0FFF, 0x1000-0x17FF and 0x1800-0x1FFF mirror 0x0000-0x07FF
        else if (isInRange(address, 0x0000, 0x1FFF)) {
            val = this.cpuRAM[address & 0x07FF];
        }

        // PPU registers
        // Mirrors of 0x2000-0x2007 (repeats every 8 bytes) 
        else if (isInRange(address, 0x2000, 0x3FFF)) {
            val = this.ppu.debugRead(address & 0x0007);
        }

        // NES APU and I/O registers
        else if (isInRange(address, 0x4000, 0x4017)) {
            //
        }

        // APU and I/O functionality that is normally disabled
        else if (isInRange(address, 0x4018, 0x401F)) {
            //
        }

        return val;
    }

    public clock(): void {
        this.ppu.clock();

        // ppu does 3 dots per cpu cycle
        // https://wiki.nesdev.com/w/index.php?title=Cycle_reference_chart
        if (this.systemClock % 3 === 0) this.cpu.clock();

        if (this.ppu.nmi) {
            this.ppu.nmi = false;
            this.cpu.NMI();
        }

        this.systemClock++;
    }
}