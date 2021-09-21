import CPU from "./pus/cpu";
import PPU from "./pus/ppu";
import ROM from "./rom/rom";
import Display from "../utils/display";
import { isInRange } from "../utils/utils";

export default class Bus {
    /** Cartridge ROM */
    private rom: ROM | null;
    /** 2KB of internal RAM */
    private cpuRAM: Uint8Array = new Uint8Array(2048);

    private cpu: CPU;
    public ppu: PPU;

    private systemClock: number = 0;
    public controller: Uint8Array = new Uint8Array(2);
    private controllerState: Uint8Array = new Uint8Array(2);

    constructor() {
        this.cpu = new CPU();
        this.cpu.connectBus(this);
        this.ppu = new PPU();
        this.rom = null;

        // console.log(this.controllerState, this.controller)
    }

    get ram(): Uint8Array {
        return this.cpuRAM;
    }

    get getCPU(): CPU {
        return this.cpu;
    }

    get getControllerState(): Uint8Array {
        return this.controllerState;
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

    public write(address: number, data: number): void {
        // cartridge
        if (this.rom.cpuWrite(address, data)) {
            // be happy
        }
        // 2KB internal RAM
        // 0x0800-0x0FFF, 
        // 0x1000-0x17FF and 0x1800-0x1FFF mirror 0x0000-0x07FF
        else if (isInRange(address, 0x0000, 0x1FFF)) {
            this.cpuRAM[address & 0x07FF] = data;
        }

        // PPU registers
        // Mirrors of 0x2000-0x2007 (repeats every 8 bytes) 
        else if (isInRange(address, 0x2000, 0x3FFF)) {
            // val = 1;
            this.ppu.cpuWrite(address & 0x0007, data)
        }

        // NES APU and I/O registers
        else if (isInRange(address, 0x4000, 0x4013) || address === 0x4015 || address === 0x4017) {
            // data = +((this.controllerState[address & 0x0001] & 0x80) > 0);
            // this.controllerState[address & 0x0001] <<= 1;
        }

        else if (isInRange(address, 0x4016, 0x4017)) {
            this.controllerState[address & 0x0001] = this.controller[address & 0x0001];
        }


        // APU and I/O functionality that is normally disabled
        else if (isInRange(address, 0x4018, 0x401F)) {
            // val = 4;
        }        
    }

    public read(address: number): number {
        let data = 0x00;

        // cartridge
        const temp = this.rom.cpuRead(address);
        if (temp !== null) {
            data = temp;
        }
        // 2KB internal RAM
        // 0x0800-0x0FFF, 0x1000-0x17FF and 0x1800-0x1FFF mirror 0x0000-0x07FF
        else if (isInRange(address, 0x0000, 0x1FFF)) {
            data = this.cpuRAM[address & 0x07FF];
        }

        // PPU registers
        // Mirrors of 0x2000-0x2007 (repeats every 8 bytes) 
        else if (isInRange(address, 0x2000, 0x3FFF)) {
            data = this.ppu.cpuRead(address & 0x0007);
        }

        // NES APU and I/O registers
        else if (address === 0x4015) {
            //
        }

        // ISSUE something doesn't work quite right here
        /*
            Here's how this is supposed to work:
            The controller state is being read 8 times.
            Each read coressponds to a button on a controller.
            0 - A
            1 - B
            2 - Select
            3 - Start
            4 - Up
            5 - Down
            6 - Left
            7 - Right
            We assigned a value to each button as follows:
            A       = 0x80
            B       = 0x40
            Select  = 0x20
            Start   = 0x10
            Up      = 0x08
            Down    = 0x04
            Left    = 0x02
            Right   = 0x01
            Each time we read, we shift the current value to the left, thus doubling it.
            So if we pressed, say, left, the value would be 0x02, but after 6 reads it would become
            0x80, and, when ANDed with 0x80, would produce 1.
            
            But it doesn't happen, cos somewhere along the line this son of a bitch gets reset.
            Also, what happens, is that the first good input gets picked up instead.
            So the A button is 0x80 immediately, and that gets accepted. Why? I dunno. Maybe you do.
        */
        else if (isInRange(address, 0x4016, 0x4017)) {
            data = +((this.controllerState[address & 0x0001] & 0x80) > 0);
            this.controllerState[address & 0x0001] <<= 1;
        }

        // APU and I/O functionality that is normally disabled
        else if (isInRange(address, 0x4018, 0x401F)) {
            //
        }

        return data;
    }

    public debugRead(address: number): number {
        let data = 0x00;

        // cartridge
        const temp = this.rom.cpuRead(address);
        if (temp !== null) {
            data = temp;
        }
        // 2KB internal RAM
        // 0x0800-0x0FFF, 0x1000-0x17FF and 0x1800-0x1FFF mirror 0x0000-0x07FF
        else if (isInRange(address, 0x0000, 0x1FFF)) {
            data = this.cpuRAM[address & 0x07FF];
        }

        // PPU registers
        // Mirrors of 0x2000-0x2007 (repeats every 8 bytes) 
        else if (isInRange(address, 0x2000, 0x3FFF)) {
            data = this.ppu.debugRead(address & 0x0007);
        }

        // NES APU and I/O registers
        else if (isInRange(address, 0x4000, 0x4013) || address === 0x4015 || address === 0x4017) {
            // data = +((this.controllerState[address & 0x0001] & 0x80) > 0);
            // this.controllerState[address & 0x0001] <<= 1;
        }

        else if (isInRange(address, 0x4016, 0x4017)) {
            data = +((this.controllerState[address & 0x0001] & 0x80) > 0);
        }

        // APU and I/O functionality that is normally disabled
        else if (isInRange(address, 0x4018, 0x401F)) {
            //
        }

        return data;
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