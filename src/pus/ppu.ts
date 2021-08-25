import Display, { Pixel } from "../utils/display";
import Register from "./register";

enum PPUMASKFlag {
    /** Greyscale (0: normal color, 1: produce a greyscale display) */
    Grayscale,
    /** 1: Show background in leftmost 8 pixels of screen, 0: Hide */
    m,
    /** 1: Show sprites in leftmost 8 pixels of screen, 0: Hide */
    M,
    /** 1: Show background */
    b,
    /** 1: Show sprites */
    s,
    /** Emphasize red (green on PAL/Dendy) */
    Red,
    /** Emphasize green (red on PAL/Dendy) */
    Green,
    /** Emphasize blue */
    Blue
}

enum PPUStatusFlag {
    /** Sprite overflow, bugged */
    O = 5,
    /** Sprite 0 Hit.  Set when a nonzero pixel of sprite 0 overlaps
     * a nonzero background pixel; cleared at dot 1 of the pre-render
     * line.  Used for raster timing. */
    S = 6,
    /** Vertical blank has started (0: not in vblank; 1: in vblank).
     * Set at dot 1 of line 241 (the line *after* the post-render
     * line); cleared after reading $2002 and at dot 1 of the
     * pre-render line. */
    V = 7
}

enum PPUCTRLFlags {
    /** Base nametable address (0 = $2000; 1 = $2400; 2 = $2800; 3 = $2C00) */
    nameTAddr     = 0,
    /**  VRAM address increment per CPU read/write of PPUDATA 
     * (0: add 1, going across; 1: add 32, going down) */
    vRAMAddr      = 2,
    /** Sprite pattern table address for 8x8 sprites
     * (0: $0000; 1: $1000; ignored in 8x16 mode) */
    sprTableAddr  = 3,
    /** Background pattern table address (0: $0000; 1: $1000) */
    bckgTableAddr = 4,
    /** Sprite size (0: 8x8 pixels; 1: 8x16 pixels) */
    sprSize       = 5,
    /** PPU master/slave select
     * (0: read backdrop from EXT pins; 1: output color on EXT pins) */
    PPUSelect     = 6,
    /** Generate an NMI at the start of the
     * vertical blanking interval (0: off; 1: on) */
    genNMI        = 7
}


const InternalRegister = {
    /** The 5-bit coarse X position, the counterpart of Y. */
    coarseX:    { pos: 0, width: 5 },
    /** The 5-bit coarse Y position, 
     * which can reference one of the 30 8x8 tiles on the screen 
     * in the vertical direction. */
    coarseY:    { pos: 5, width: 5 },
    /** The index for choosing a certain name table. */
    nametableX: { pos: 10 },
    /** The index for choosing a certain name table. */
    nametableY: { pos: 11 },
    /** The fine Y position, 
     * the counterpart of {@link PPU.fineX fineX}, 
     * holding the Y position within a 8x8-pixel tile. */
    fineY:      { pos: 12, width: 3 },
}

export default class PPU {
    /** NES palette */
    private palette: Pixel[] = [
        // 0x00 - 0x0f
        new Pixel(84, 84, 84),
        new Pixel(0, 30, 116),
        new Pixel(8, 16, 144),
        new Pixel(48, 0, 136),
        new Pixel(68, 0, 100),
        new Pixel(92, 0, 48),
        new Pixel(84, 4, 0),
        new Pixel(60, 24, 0),
        new Pixel(32, 42, 0),
        new Pixel(8, 58, 0),
        new Pixel(0, 64, 0),
        new Pixel(0, 60, 0),
        new Pixel(0, 50, 60),
        new Pixel(0, 0, 0),

        // 0x10 - 0x1f
        new Pixel(152, 150, 152),
        new Pixel(8, 76, 196),
        new Pixel(48, 50, 236),
        new Pixel(92, 30, 228),
        new Pixel(136, 20, 176),
        new Pixel(160, 20, 100),
        new Pixel(152, 34, 32),
        new Pixel(120, 60, 0),
        new Pixel(84, 90, 0),
        new Pixel(40, 114, 0),
        new Pixel(8, 124, 0),
        new Pixel(0, 118, 40),
        new Pixel(0, 102, 120),
        new Pixel(0, 0, 0),

        // 0x20 - 0x2f
        new Pixel(236, 238, 236),
        new Pixel(76, 154, 236),
        new Pixel(120, 124, 236),
        new Pixel(176, 98, 236),
        new Pixel(228, 84, 236),
        new Pixel(236, 88, 180),
        new Pixel(236, 106, 100),
        new Pixel(212, 136, 32),
        new Pixel(160, 170, 0),
        new Pixel(116, 196, 0),
        new Pixel(76, 208, 32),
        new Pixel(56, 204, 108),
        new Pixel(56, 180, 204),
        new Pixel(60, 60, 60),

        // 0x30 - 0x3f
        new Pixel(236, 238, 236),
        new Pixel(168, 204, 236),
        new Pixel(188, 188, 236),
        new Pixel(212, 178, 236),
        new Pixel(236, 174, 236),
        new Pixel(236, 174, 212),
        new Pixel(236, 180, 176),
        new Pixel(228, 196, 144),
        new Pixel(204, 210, 120),
        new Pixel(180, 222, 120),
        new Pixel(168, 226, 144),
        new Pixel(168, 226, 144),
        new Pixel(152, 226, 180),
        new Pixel(160, 162, 160)
    ]

    /**
     * 
     */
    private PPUCTRL:   Register<Uint8Array>;
    private PPUMASK:   Register<Uint8Array>;
    private PPUSTATUS: Register<Uint8Array>;
    private OAMADDR:   Register<Uint8Array>;
    private OAMDATA:   Register<Uint8Array>;
    private PPUSCROLL: Register<Uint8Array>;
    private PPUADDR:   Register<Uint8Array>;
    private PPUDATA:   Register<Uint8Array>;
    private OAMDMA:    Register<Uint8Array>;


    private internalVReg: Register<Uint16Array>;
    private internalTReg: Register<Uint16Array>;


    private OAM: Uint8Array;
    private ram: Uint8Array;

    /** 3 bits, holds X position on a 8x8 pixel tile */
    private fineX: number = 0x00;
    /** some weird temporary thingamajig that PPUSTATUS and PPUADDR use */
    private addressLatch: number = 0x00;

    private scanline: number = 0;
    private cycle:    number    = 0;

    private display: Display | null;

    constructor() {
        this.PPUCTRL   = new Register<Uint8Array>(Uint8Array);
        this.PPUMASK   = new Register<Uint8Array>(Uint8Array);
        this.PPUSTATUS = new Register<Uint8Array>(Uint8Array);
        this.OAMADDR   = new Register<Uint8Array>(Uint8Array);
        this.OAMDATA   = new Register<Uint8Array>(Uint8Array);
        this.PPUSCROLL = new Register<Uint8Array>(Uint8Array);
        this.PPUADDR   = new Register<Uint8Array>(Uint8Array);
        this.PPUDATA   = new Register<Uint8Array>(Uint8Array);
        this.OAMDMA    = new Register<Uint8Array>(Uint8Array);

        this.internalVReg = new Register<Uint16Array>(Uint16Array);
        this.internalTReg = new Register<Uint16Array>(Uint16Array);
        
        this.OAM = new Uint8Array(64 * 4); // 64 sprtes, 4 bytes each
        this.ram = new Uint8Array(2048);

        this.PPUSTATUS.setRegister(0x80);

        this.display = null;
    }

    public connectDisplay(display: Display): void {
        this.display = display;
    }

    public debugRead(address: number): number {
        return address;
    }

    public cpuRead(address: number): number {
        let data = 0x00;

        switch (address) {
            // write only
            case 0x0000: // PPUCTRL
            case 0x0001: // PPUMASK
                break;
            case 0x0002: // PPUSTATUS
                // read
                // we're not gonna bother with noise, cause it's noise,
                // if some game is using noise as valid data, they should be
                // ashamed
                data = this.PPUSTATUS.getRegisterValue & 0xE0;

                // cleared after reading, as per description of the flag
                this.PPUSTATUS.clearBit(PPUStatusFlag.V);

                // this thing gets set to 0
                this.addressLatch = 0x00;
                break;
            // write only
            // OAMADDR
            case 0x0003: break;
            // read/write
            case 0x0004: // OAMDATA
                // read
                // we ignore it though?????77
                // data = 0x02;
                break;
            
            // write twice
            case 0x0005: // PPUSCROLL
            case 0x0006: // PPUADDR
                break;
            // read/write
            // PPUDATA
            case 0x0007: {
                // read
                

                const vramVal = this.PPUCTRL.getBit(PPUCTRLFlags.vRAMAddr);
                this.internalVReg.add(vramVal === 0 ? 1 : 32);

                data = 0x03;
                break;
            }
        }

        return data;
    }

    public cpuWrite(address: number, val: number): void {
        switch (address) {
            // PPUCTRL write only
            case 0x0000:
                // write
                break;
            // write only
            case 0x0001:
                // write
                break;
            // read only
            case 0x0002: break;
            // write only
            case 0x0003:
                // write
                break;
            // read/write
            case 0x0004:
                // write
                break;
            // write twice
            case 0x0005:
                // write
                // write again 
                break;
            // write twice
            case 0x0006:
                // write
                // write again
                break;
            // read/write
            case 0x0007:
                // write
                break;
        }
    }

    public ppuRead(address: number): number {
        return address;
    }

    public ppuWrite(address: number, val: number): void {
        console.log(address, val);
    }
}