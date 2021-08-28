import { to8bitBinary } from "../utils/utils";


interface Flags6 {
    lowerMapperNumber: string;
    ignoreMirroringControl: boolean;
    trainer: number;
    PRGRAM: boolean;
    mirroring: number;
}

interface Flags7 {
    upperMapperNumber: string;
    isNES20: boolean;
    playChoice10: boolean;
    VSUnisystem: boolean;
}

export enum Mirroring {
    HORIZONTAL,
    VERTICAL
}

/**
 * Represents the structure of the iNES-format ROM header
 */
export default class RomHeader {
    private headerData: Uint8Array;

    /**
     * const 'NES' followed by MS-DOS end-of-file, reads as 
     * 'NES→' when logged
     */
    private readonly constantNES: Uint8Array;

    /**
     * Size of PRG ROM in 16 KB units
     */
    private readonly PRG_ROM_size: number;
    /**
     * Size of CHR ROM in 8 KB units (Value 0 means the board uses CHR RAM)
     */
    private readonly CHR_ROM_size: number;
    private readonly mapperID: number;
    private readonly flags6: string; 
    private readonly flags7: string; 
    private readonly flags8: string; 
    private readonly flags9: string;
    private readonly flags10: string;

    private readonly flag6obj: Flags6;
    private readonly flag7obj: Flags7;

    private mirroring: Mirroring;

    constructor(header: Uint8Array) {
        this.headerData = header;

        this.constantNES = new Uint8Array(this.headerData.subarray(0, 4));
        this.PRG_ROM_size = this.headerData[4];          // Size of PRG ROM in 16 KB units
        this.CHR_ROM_size = this.headerData[5];          // Size of CHR ROM in 8 KB units (Value 0 means the board uses CHR RAM)
        this.flags6 = to8bitBinary(this.headerData[6]);  // these are the only flags that matter
        
        // ignore these for now
        this.flags7 = to8bitBinary(this.headerData[7]);
        this.flags8 = to8bitBinary(this.headerData[8]);
        this.flags9 = to8bitBinary(this.headerData[9]);
        this.flags10 = to8bitBinary(this.headerData[10]);

        this.flag6obj = this.parseFlags6();
        this.flag7obj = this.parseFlags7();

        this.mirroring = this.flag6obj.mirroring ? Mirroring.VERTICAL : Mirroring.HORIZONTAL;

        this.mapperID = (+this.getFlags7Obj.upperMapperNumber << 4) | +this.getFlags6Obj.lowerMapperNumber;
    }

    get getCONST(): string {
        return Buffer.from(this.constantNES).toString();
    }

    /**
     * Size of PRG ROM in 16 KB units
     */
    get getPRGROMSize(): number {
        return this.PRG_ROM_size;
    }

    get getMirroring(): Mirroring {
        return this.mirroring;
    }

    /**
     * Size of CHR ROM in 8 KB units (Value 0 means the board uses CHR RAM)
     */
    get getCHRROMSize(): number {
        return this.CHR_ROM_size;
    }

    get getFlags6(): string {
        return this.flags6;
    }

    get getFlags7(): string {
        return this.flags7;
    }

    get getFlags8(): string {
        return this.flags8;
    }

    get getFlags9(): string {
        return this.flags9;
    }

    get getFlags10(): string {
        return this.flags10;
    }

    get getFlags6Obj(): Flags6 {
        return this.flag6obj;
    }

    get getFlags7Obj(): Flags7 {
        return this.flag7obj;
    }

    get getMapperID(): number {
        return this.mapperID;
    }

    private parseFlags6(): Flags6 {
        return {
            lowerMapperNumber: this.flags6.slice(0, 4),
            ignoreMirroringControl: !!(+this.flags6[4]),
            trainer: +this.flags6[5],
            PRGRAM: !!(+this.flags6[6]),
            mirroring: +this.flags6[7]
        }
    }

    private parseFlags7(): Flags7 {
        return {
            upperMapperNumber: this.flags7.slice(0, 4),
            isNES20: (parseInt(this.flags7.slice(4, 6), 2)) === 2,
            playChoice10: !!(+this.flags7[6]),
            VSUnisystem: !!(+this.flags7[7])
        }
    }

    toString(): string {
        return `${this.getCONST}\r\nPRG ROM size: ${this.PRG_ROM_size}\r\nCHR ROM size: ${this.CHR_ROM_size}
Flags 6: ${this.flags6}\r\nFlags 7: ${this.flags7}\r\nFlags 8: ${this.flags8}\r\nFlags 9: ${this.flags9}
Flags 10: ${this.flags10}`
    }
}