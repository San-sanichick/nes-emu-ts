import { isInRange } from "../utils/utils";
import Display, { Pixel, Sprite } from "../utils/display";
import Register from "./register";
import ROM from "../rom/rom";
import { Mirroring } from "../rom/romHeader";

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

enum PPUSTATUSFlag {
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

enum PPUCTRLFlag {
    /** Base nametable address (0 = $2000; 1 = $2400; 2 = $2800; 3 = $2C00) */
    nametableX    = 0,
    nametableY    = 1,
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

/**
 * PPU has 2 internal registers: v and t.
 * Both have identical internal structure, and it is as follows:
 * 
 * yyyNNYYYYYXXXXX,
 * 
 * where:
 * 1. y - The fine Y position
 * 2. N - The index for choosing a certain name table
 * 3. Y - The 5-bit coarse Y position
 * 4. X - The 5-bit coarse X position
 */
const IR = {
    /** The 5-bit coarse X position, the counterpart of Y. */
    coarseX:    { pos: 0, width: 5 },
    /** The 5-bit coarse Y position, 
     * which can reference one of the 30 8x8 tiles on the screen 
     * in the vertical direction. */
    coarseY:    { pos: 5, width: 5 },
    /** The index for choosing a certain name table. */
    nametableX: { pos: 10, width: 1 },
    /** The index for choosing a certain name table. */
    nametableY: { pos: 11, width: 1 },
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
        new Pixel(0, 0, 0),
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
        new Pixel(0, 0, 0),
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
        new Pixel(0, 0, 0),
        new Pixel(0, 0, 0),

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
        new Pixel(160, 162, 160),
        new Pixel(0, 0, 0),
        new Pixel(0, 0, 0)
    ]

    // TODO add descriptions to registers
    private PPUCTRL:   Register<Uint8Array>;
    private PPUMASK:   Register<Uint8Array>;
    private PPUSTATUS: Register<Uint8Array>;
    private OAMADDR:   Register<Uint8Array>;
    private OAMDATA:   Register<Uint8Array>;
    private PPUSCROLL: Register<Uint8Array>;
    private PPUADDR:   Register<Uint8Array>;
    private PPUDATA:   Register<Uint8Array>;
    private OAMDMA:    Register<Uint8Array>;

    private vReg: Register<Uint16Array>;
    private tReg: Register<Uint16Array>;

    private OAM: Uint8Array;

    /** 3 bits, holds X position on a 8x8 pixel tile */
    private fineX: number = 0x00;
    /** First or second write toggle (a.k.a. address latch), used by PPUSCROLL and PPUADDR */
    private w: number = 0x00;

    private nametables:   Uint8Array[] = new Array<Uint8Array>(2);
    private patternTable: Uint8Array[] = new Array<Uint8Array>(2);
    private paletteTable: Uint8Array   = new Uint8Array(32);

    private spritePatternTable: Sprite[] = [ new Sprite(128, 128), new Sprite(128, 128) ];
    private spriteNameTable:    Sprite[] = [ new Sprite(256, 240), new Sprite(256, 240) ];

    private shiftPatternLow:  Register<Uint16Array> = new Register<Uint16Array>(Uint16Array);
    private shiftPatternHigh: Register<Uint16Array> = new Register<Uint16Array>(Uint16Array);

    // the nesdev wiki clearly states that these are 8-bit registers
    // but everyone makes them 16-bit, and I fucking give up trying to
    // figure out why that's the case
    private shiftAttribLow:  Register<Uint16Array> = new Register<Uint16Array>(Uint16Array);
    private shiftAttribHigh: Register<Uint16Array> = new Register<Uint16Array>(Uint16Array);

    private tileID: number = 0x00;
    private tileAttr: number = 0x00;
    private tileLSB: number = 0x00;
    private tileMSB: number = 0x00;


    private scanline: number = 0;
    private cycle:    number = 0;
    public  frameComplete: boolean = false;

    private display: Display | null;
    private rom: ROM | null;

    public nmi: boolean = false;

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

        this.vReg = new Register<Uint16Array>(Uint16Array);
        this.tReg = new Register<Uint16Array>(Uint16Array);
        
        this.OAM = new Uint8Array(64 * 4); // 64 sprtes, 4 bytes each
        // this.ram = new Uint8Array(2048);
        for (let i = 0; i < 2; i++) {
            this.nametables[i] = new Uint8Array(1024);
        }

        for (let i = 0; i < 2; i++) {
            this.patternTable[i] = new Uint8Array(4096);
        }

        this.PPUSTATUS.setReg(0x80);

        this.display = null;
        this.rom     = null;
    }

    reset(): void {
       this.cycle = 0;
       this.scanline = 0;
       this.w = 0x00;
       this.fineX = 0x00;
       this.PPUDATA.setReg(0x00);
       this.PPUSTATUS.setReg(0x00);
       this.PPUMASK.setReg(0x00);
       this.PPUCTRL.setReg(0x00);
       this.vReg.setReg(0x0000);
       this.tReg.setReg(0x0000);

       this.tileID = 0x00;
       this.tileAttr = 0x00;
       this.tileMSB = 0x00;
       this.tileLSB = 0x00;
       this.shiftPatternLow.setReg(0x0000);
       this.shiftPatternHigh.setReg(0x0000);
       this.shiftAttribLow.setReg(0x0000);
       this.shiftAttribHigh.setReg(0x0000);
    }

    private getPatternTable(patternTableIndex: number, palette: number): Sprite {
        for (let tileX = 0; tileX < 16; tileX++) {
            for (let tileY = 0; tileY < 16; tileY++) {
                const offset = tileY * 256 + tileX * 16;

                for (let row = 0; row < 8; row++){
                    let tileLSB = this.ppuRead(patternTableIndex * 0x1000 + offset + row + 0x0000);
                    let tileMSB = this.ppuRead(patternTableIndex * 0x1000 + offset + row + 0x0008);

                    for (let col = 0; col < 8; col++) {
                        const pixel = (tileLSB & 0x01) + (tileMSB & 0x01);

                        tileLSB >>= 1;
                        tileMSB >>= 1;

                        this.spritePatternTable[patternTableIndex].setPixel(
                            tileX * 8 + (7 - col), 
                            tileY * 8 + row, 
                            this.getColor(palette, pixel)
                        );
                    }
                }
            }
        }
        return this.spritePatternTable[patternTableIndex];
    }

    private getColor(palette: number, pixel: number): Pixel {
        /*
            43210
            |||||
            |||++- Pixel value from tile data
            |++--- Palette number from attribute table or OAM
            +----- Background/Sprite select (uhhh)
        */
        return this.palette[this.ppuRead(0x3F00 + (palette << 2) + pixel) & 0x3F];
    }

    public connectDisplay(display: Display): void {
        this.display = display;
    }

    public connectRom(rom: ROM): void {
        this.rom = rom;
    }

    public debugRead(address: number): number {
        let data = 0x00;

        switch (address) {
            case 0x0000: // PPUCTRL
                data = this.PPUCTRL.getValue;
                break;
            case 0x0001: // PPUMASK
                data = this.PPUMASK.getValue;
                break;
            case 0x0002: // PPUSTATUS
                data = this.PPUSTATUS.getValue & 0xE0;
                break;
            case 0x0003: // OAMADDR
                data = this.OAMADDR.getValue;
                break;
            case 0x0004: // OAMDATA
                data = this.OAMDATA.getValue;
                break;
            case 0x0005: // PPUSCROLL
                data = this.PPUSCROLL.getValue;
                break;
            case 0x0006: // PPUADDR
                data = this.PPUADDR.getValue;
                break;
            case 0x0007: { // PPUDATA
                data = this.PPUDATA.getValue;
                break;
            }
        }

        return data;
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
                data = this.PPUSTATUS.getValue & 0xE0 | (this.PPUDATA.getValue & 0x1F);

                // cleared after reading, as per description of the flag
                this.PPUSTATUS.clearBit(PPUSTATUSFlag.V);

                // this thing gets set to 0
                this.w = 0;
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
                data = this.PPUDATA.getValue;
                this.PPUDATA.setReg(this.ppuRead(this.vReg.getValue));

                if (isInRange(address, 0x3F00, 0x3FFF)) {
                    data = this.PPUDATA.getValue;
                }

                const vramVal = this.PPUCTRL.getBit(PPUCTRLFlag.vRAMAddr);
                this.vReg.add(vramVal === 0 ? 1 : 32);
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
                this.PPUCTRL.setReg(val);

                this.tReg.storeBits(this.PPUCTRL.getBit(PPUCTRLFlag.nametableX), IR.nametableX);
                this.tReg.storeBits(this.PPUCTRL.getBit(PPUCTRLFlag.nametableY), IR.nametableY)
                break;
            // write only
            case 0x0001:
                // write
                this.PPUMASK.setReg(val);
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
                if (this.w === 0) {
                    this.tReg.storeBits(val >> 3, IR.coarseX);
                    this.fineX = val & 0x07;

                    this.w = 1;
                } else if (this.w === 1) { // write again
                    this.tReg.storeBits(val >> 3, IR.coarseY);
                    this.tReg.storeBits(val & 0x07, IR.fineY);

                    this.w = 0;
                } 
                
                break;
            // write twice
            case 0x0006:
                // write
                if (this.w === 0) {
                    // this.internalTReg.storeBits(val & 0x3F, 8, 6);
                    // ! in case upper doesn't work
                    this.tReg.setReg((val & 0x3F) << 8 | this.tReg.getValue & 0x00FF);
                    this.tReg.clearBit(15);

                    this.w = 1;
                } else if (this.w === 1) { // write again
                    this.tReg.setReg(this.tReg.getValue & 0xFF00 | val);
                    this.vReg.setReg(this.tReg.getValue);

                    this.w = 0;
                }
                
                break;
            // read/write
            case 0x0007: {
                // write
                this.ppuWrite(this.vReg.getValue, val);

                const vramVal = this.PPUCTRL.getBit(PPUCTRLFlag.vRAMAddr);
                this.vReg.add(vramVal === 0 ? 1 : 32);
                break;
            }
        }
    }

    public ppuRead(address: number): number {
        let data = 0x00;
        address &= 0x3FFF;

        const temp = this.rom.ppuRead(address);
        // console.log(address.toString(16));
        if (temp !== null) {
            // console.log(temp.toString(16));
            data = temp;
        } else if (isInRange(address, 0x0000, 0x0FFF)) {
            // pattern table 1
            data = this.patternTable[0][address & 0x0FFF];
        } else if (isInRange(address, 0x1000, 0x1FFF)) {
            // pattern table 2
            data = this.patternTable[1][address & 0x0FFF];
        } else if (isInRange(address, 0x2000, 0x3EFF)) {
            // nametables
            address &= 0x0FFF;

            const temp = address & 0x03FF;
            const mirroring = this.rom.getRomHeader.getMirroring;

            if (mirroring === Mirroring.VERTICAL) {
                if (isInRange(address, 0x0000, 0x03FF)) {
                    data = this.nametables[0][temp];
                }
                if (isInRange(address, 0x0400, 0x07FF)) {
                    data = this.nametables[1][temp];
                }
                if (isInRange(address, 0x0800, 0x0BFF)) {
                    data = this.nametables[0][temp];
                }
                if (isInRange(address, 0x0C00, 0x0FFF)) {
                    data = this.nametables[1][temp];
                }

            } else if (mirroring === Mirroring.HORIZONTAL) {
                if (isInRange(address, 0x0000, 0x03FF)) {
                    data = this.nametables[0][temp];
                }
                if (isInRange(address, 0x0400, 0x07FF)) {
                    data = this.nametables[0][temp];
                }
                if (isInRange(address, 0x0800, 0x0BFF)) {
                    data = this.nametables[1][temp];
                }
                if (isInRange(address, 0x0C00, 0x0FFF)) {
                    data = this.nametables[1][temp];
                }
            }
        }
        else if (isInRange(address, 0x3F00, 0x3FFF)) {
            // palette RAM and mirrors of palette
            address &= 0x001F;
            // 0x3F10/0x3F14/0x3F18/0x3F1C are mirrors of
            // 0x3F00/0x3F04/0x3F08/0x3F0C.
            if (address === 0x0010) address = 0x0000;
            if (address === 0x0014) address = 0x0004;
            if (address === 0x0018) address = 0x0008;
            if (address === 0x001C) address = 0x000C;
            // the grayscale part only gets applied during reading
            data = this.paletteTable[address] & (this.PPUMASK.getBit(PPUMASKFlag.Grayscale) ? 0x30 : 0x3F);
        }

        return data;
    }

    public ppuWrite(address: number, data: number): void {
        address &= 0x3FFF;

        if (this.rom.cpuWrite(address, data)) {
            // be happy
        } else if (isInRange(address, 0x0000, 0x0FFF)) {
            // pattern table 1
            this.patternTable[0][address & 0x0FFF] = data;
        } else if (isInRange(address, 0x1000, 0x1FFF)) {
            // pattern table 2
            this.patternTable[1][address & 0x0FFF] = data;
        } else if (isInRange(address, 0x2000, 0x3EFF)) {
            // nametables
            address &= 0x0FFF;
            const temp = address & 0x03FF;
            const mirroring = this.rom.getRomHeader.getMirroring;

            if (mirroring === Mirroring.VERTICAL) {
                if (isInRange(address, 0x0000, 0x03FF)) {
                    this.nametables[0][temp] = data;
                }
                if (isInRange(address, 0x0400, 0x07FF)) {
                    this.nametables[1][temp] = data;
                }
                if (isInRange(address, 0x0800, 0x0BFF)) {
                    this.nametables[0][temp] = data
                }
                if (isInRange(address, 0x0C00, 0x0FFF)) {
                    this.nametables[1][temp] = data;
                }

            } else if (mirroring === Mirroring.HORIZONTAL) {
                if (isInRange(address, 0x0000, 0x03FF)) {
                    this.nametables[0][temp] = data;
                }
                if (isInRange(address, 0x0400, 0x07FF)) {
                    this.nametables[0][temp] = data;
                }
                if (isInRange(address, 0x0800, 0x0BFF)) {
                    this.nametables[1][temp] = data;
                }
                if (isInRange(address, 0x0C00, 0x0FFF)) {
                    this.nametables[1][temp] = data;
                }
            }
        }
        else if (isInRange(address, 0x3F00, 0x3FFF)) {
            // palette RAM and mirrors of palette
            address &= 0x001F;
            if (address === 0x0010) address = 0x0000;
            if (address === 0x0014) address = 0x0004;
            if (address === 0x0018) address = 0x0008;
            if (address === 0x001C) address = 0x000C;
            this.paletteTable[address] = data;
        }
    }

    public clock(): void {
        // functions for wrapping around
        /**
         * Coarse X increment
         */
        const incrScrollX = (): void => {
            if (this.PPUMASK.getBit(PPUMASKFlag.b) || this.PPUMASK.getBit(PPUMASKFlag.s)) {
                if (this.vReg.getBits(IR.coarseX) === 31) {
                    this.vReg.storeBits(0, IR.coarseX);
                    // there's no real pretty way of doing this
                    const temp = this.vReg.getBit(IR.nametableX.pos);
                    this.vReg.storeBit(IR.nametableX.pos, ~temp);
                } else {
                    const temp = this.vReg.getBits(IR.coarseX);
                    this.vReg.storeBits(temp + 1, IR.coarseX);
                }
            }
        }

        /**
         * Coarse Y increment
         */
        const incrScrollY = (): void => {
            if (this.PPUMASK.getBit(PPUMASKFlag.b) || this.PPUMASK.getBit(PPUMASKFlag.s)) {
                if (this.vReg.getBits(IR.fineY) < 7) {
                    const temp = this.vReg.getBits(IR.fineY);
                    this.vReg.storeBits(temp + 1, IR.fineY);
                } else {
                    this.vReg.storeBits(0, IR.fineY);
                    const y = this.vReg.getBits(IR.coarseY);
                    if (y === 29) {
                        this.vReg.storeBits(0, IR.coarseY);

                        const temp = this.vReg.getBit(IR.nametableY.pos);
                        this.vReg.storeBit(IR.nametableY.pos, ~temp);
                    } else if (y === 31) {
                        this.vReg.storeBits(0, IR.coarseY);
                    } else {
                        // const temp = this.vReg.getBits(IR.coarseY);
                        this.vReg.storeBits(y + 1, IR.coarseY);
                    }
                }
            }
        }

        /**
         * At dot 257 of each scanline PPU copies all bits related to horizontal
         * position from t to v
         * 
         * NOTE: this is done only if rendering is enabled
         */
        const transferAddrX = (): void => {
            if (this.PPUMASK.getBit(PPUMASKFlag.b) || this.PPUMASK.getBit(PPUMASKFlag.s)) {
                const
                    tempCoarseX    = this.tReg.getBits(IR.coarseX),
                    tempNametableX = this.tReg.getBits(IR.nametableX);
    
                this.vReg.storeBits(tempCoarseX, IR.coarseX);
                this.vReg.storeBits(tempNametableX, IR.nametableX);
            }
        }

        /**
         * During dots 280 to 304 of the pre-render scanline
         * PPU copies vertical-related bits from t to v
         * 
         * NOTE: this is done only if rendering is enabled
         */
        const trnasferAddrY = (): void => {
            if (this.PPUMASK.getBit(PPUMASKFlag.b) || this.PPUMASK.getBit(PPUMASKFlag.s)) {
                const
                    tempCoarseY    = this.tReg.getBits(IR.coarseY),
                    tempFineY      = this.tReg.getBits(IR.fineY),
                    tempNametableY = this.tReg.getBits(IR.nametableY);
    
                this.vReg.storeBits(tempCoarseY, IR.coarseY);
                this.vReg.storeBits(tempFineY, IR.fineY);
                this.vReg.storeBits(tempNametableY, IR.nametableY);
            }
        }

        const loadBckgShiftReg = (): void => {
            this.shiftPatternLow.setReg((this.shiftPatternLow.getValue & 0xFF00) | this.tileLSB);
            this.shiftPatternHigh.setReg((this.shiftPatternHigh.getValue & 0xFF00) | this.tileMSB);
        
            this.shiftAttribLow.setReg((this.shiftPatternLow.getValue & 0xFF00) | ((this.tileAttr & 0b01) ? 0xFF : 0x00));
            this.shiftAttribHigh.setReg((this.shiftAttribHigh.getValue & 0xFF00) | ((this.tileAttr & 0b01) ? 0xFF : 0x00));
        }

        const updateShiftReg = (): void => {
            if (this.PPUMASK.getBit(PPUMASKFlag.b)) {
                this.shiftPatternLow.shiftLeft();
                this.shiftPatternHigh.shiftLeft();

                this.shiftAttribLow.shiftLeft();
                this.shiftAttribHigh.shiftLeft();
            }
        }

        if (this.scanline >= -1 && this.scanline < 240) {
            if (this.scanline === 0 && this.cycle === 0) {
                this.cycle = 1;
            }

            if (this.scanline === -1 && this.cycle === 1) {
                // we left the blanking interval
                this.PPUSTATUS.clearBit(PPUSTATUSFlag.V);
            }

            if ((this.cycle >= 2 && this.cycle < 258) || (this.cycle >= 321 && this.cycle < 338)) {
                updateShiftReg();

                switch((this.cycle - 1) % 8) {
                    case 0:
                        loadBckgShiftReg();
                        this.tileID = this.ppuRead(0x2000 | (this.vReg.getValue & 0x0FFF));
                        break;
                    case 2: {
                        const tempNametableY = this.vReg.getBits(IR.nametableY) << 11;
                        const tempNametableX = this.vReg.getBits(IR.nametableX) << 10;
                        const tempCoarseY = (this.vReg.getBits(IR.coarseY) >> 2) << 3;
                        const tempCoarseX = (this.vReg.getBits(IR.coarseX) >> 2);
                        this.tileAttr = this.ppuRead(0x23C0 | tempNametableX | tempNametableY | tempCoarseX | tempCoarseY);
                        
                        if (this.vReg.getBits(IR.coarseY) & 0x02) this.tileAttr >>= 4;
                        if (this.vReg.getBits(IR.coarseX) & 0x02) this.tileAttr >>= 2;
                        this.tileAttr &= 0x03;
                        break;
                    }

                    /*
                        PPU addresses within the pattern tables can be decoded as follows:

                        DCBA98 76543210
                        ---------------
                        0HRRRR CCCCPTTT
                        |||||| |||||+++- T: Fine Y offset, the row number within a tile
                        |||||| ||||+---- P: Bit plane (0: "lower"; 1: "upper")
                        |||||| ++++----- C: Tile column
                        ||++++---------- R: Tile row
                        |+-------------- H: Half of sprite table (0: "left"; 1: "right")
                        +--------------- 0: Pattern table is at $0000-$1FFF
                    */
                    case 4: {
                        const patternTableIndex = this.PPUCTRL.getBit(PPUCTRLFlag.bckgTableAddr);
                        this.tileLSB = this.ppuRead((patternTableIndex << 12) 
                                                    + (this.tileID << 4) 
                                                    + this.vReg.getBits(IR.fineY)
                                                    + 0);
                        break;
                    }
                    case 6: {
                        const patternTableIndex = this.PPUCTRL.getBit(PPUCTRLFlag.bckgTableAddr);
                        this.tileMSB = this.ppuRead((patternTableIndex << 12) 
                                                    + (this.tileID << 4) 
                                                    + this.vReg.getBits(IR.fineY)
                                                    + 8);
                        break;
                    }
                    case 7:
                        incrScrollX();
                        break;
                }
            }

            if (this.cycle === 256) {
                incrScrollY();
            }

            if (this.cycle === 257) {
                loadBckgShiftReg();
                transferAddrX();
            }

            // ppu reads nametable data here. twice. why? only god knows
            if (this.cycle === 338 || this.cycle === 340) {
                this.tileID = this.ppuRead(0x2000 | this.vReg.getValue & 0x0FFF);
            }

            if (this.scanline === -1 && this.cycle >= 280 && this.cycle < 305) {
                trnasferAddrY();
            }
        }

        if (this.scanline >= 241 && this.scanline < 261) {
            if (this.scanline == 241 && this.cycle == 1) {
                // we enter the blanking interval
                this.PPUSTATUS.setBit(PPUSTATUSFlag.V);

                if (this.PPUCTRL.getBit(PPUCTRLFlag.genNMI)) {
                    this.nmi = true;
                }
            }
        }

        let 
            bckgPalette = 0x00, 
            bckgPixel   = 0x00;

        if (this.PPUMASK.getBit(PPUMASKFlag.b)) {
            const bitMux = 0x8000 >> this.fineX;

            // I could just convert it into a number, but I don't trust JS at all
            const p0 = ((this.shiftPatternLow.getValue  & bitMux) > 0) ? 0x01 : 0x00;
            const p1 = ((this.shiftPatternHigh.getValue & bitMux) > 0) ? 0x01 : 0x00;

            bckgPixel = (p1 << 1) | p0;

            const palette0 = ((this.shiftAttribLow.getValue  & bitMux) > 0) ? 0x01 : 0x00;
            const palette1 = ((this.shiftAttribHigh.getValue & bitMux) > 0) ? 0x01 : 0x00;

            bckgPalette = (palette1 << 1) | palette0;
        }

        // sweet noise
        // this.display.drawPixel(this.cycle - 1, this.scanline, this.palette[fastRounding(Math.random()) ? 0x3F : 0x30]);
        this.display.drawPixel(this.cycle - 1, this.scanline, this.getColor(bckgPalette, bckgPixel));

        this.cycle++;
        if (this.cycle >= 341) {
            this.cycle = 0;
            this.scanline++;
            if (this.scanline >= 261) {
                this.scanline = -1;
                this.frameComplete = true;
                this.display.update();
            }
        }
        
    }
}