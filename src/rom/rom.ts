import Mapper from "./mapper";
import Mapper000 from "./mapper000";
import RomHeader from "./romHeader";
// import { to8bitBinary } from "./utils";

const 
    HEADER_SIZE       = 16,
    TRAINER_SIZE      = 512,        // if present
    PRG_ROM_SIZE      = 16384,      // by X
    CHR_ROM_SIZE      = 8192;       // by Y
    // this is probably not present, so I ain't gonna bother for now
    // PC_INST_PROM_SIZE = 8192,       // if present
    // PC_PROM_SIZE      = 16 + 16;    // if present, 16 bytes data, 16 bytes CounterOut

/**
 * Represents the structure of the iNES-format ROM 
 */
export default class ROM {
    private data: Uint8Array;
    private headerData: RomHeader;
    private trainerData: Uint8Array | null;
    private PRGROMData: Uint8Array;
    private CHRROMData: Uint8Array;
    private mapper: Mapper;
    
    
    constructor(romData: Buffer) {
        this.data = new Uint8Array(romData);
        this.headerData = new RomHeader(this.data.subarray(0, HEADER_SIZE));
        this.trainerData = null;
        // calculate the actual PRGROM and CHRROM size,
        // based on data from the header
        const 
            PRGSIZE = PRG_ROM_SIZE * this.headerData.getPRGROMSize,
            CHRSIZE = CHR_ROM_SIZE * this.headerData.getCHRROMSize;

        // get trainer, if it exists
        if (this.headerData.getFlags6Obj.trainer) {
            const
                TRAINER_BGN = HEADER_SIZE,
                TRAINER_END = TRAINER_BGN + TRAINER_SIZE;

            this.trainerData = new Uint8Array(this.data.subarray(TRAINER_BGN, TRAINER_END))
        }

        // calcualte bounadries of PRGROM
        const 
            // if the value of trainer in the flags6 of the header is 0, then we ignore trainer
            PRGROM_BGN = HEADER_SIZE + (TRAINER_SIZE * this.headerData.getFlags6Obj.trainer),
            PRGROM_END = PRGROM_BGN + PRGSIZE;

        this.PRGROMData = new Uint8Array(this.data.subarray(PRGROM_BGN, PRGROM_END));

        // calcualte boundaries of CHRROM
        const
            CHRROM_BGN = PRGROM_END,
            CHRROM_END = CHRROM_BGN + CHRSIZE;

        this.CHRROMData = new Uint8Array(this.data.subarray(CHRROM_BGN, CHRROM_END));

        switch (this.headerData.getMapperID) {
            case 0: 
                this.mapper = new Mapper000(PRG_ROM_SIZE, CHR_ROM_SIZE);
                break;
            default:
                this.mapper = new Mapper000(PRG_ROM_SIZE, CHR_ROM_SIZE);
        }
    }

    get getRomHeader(): RomHeader {
        return this.headerData;
    }

    get getPRGROMData(): Uint8Array {
        return this.PRGROMData;
    }

    get getCHRROMData(): Uint8Array {
        return this.CHRROMData;
    }

    // what even are mappers?
    public cpuRead(address: number): number | null {
        const mappedAddress = this.mapper.cpuMapRead(address);
        
        if (mappedAddress) {
            return this.PRGROMData[mappedAddress];
        } else {
            return null;
        }
    }
    
    // in case of PRG RAM I guess?
    public cpuWrite(address: number, data: number): number | null {
        const mappedAddress = this.mapper.cpuMapWrite(address);
        
        if (mappedAddress) {
            this.PRGROMData[mappedAddress] = data;
            return 1;
        } else {
            return null;
        }
    }

    public ppuRead(address: number): number | null {
        const mappedAddress = this.mapper.ppuMapRead(address);
        
        if (mappedAddress) {
            return this.CHRROMData[mappedAddress];
        } else {
            return null;
        }
    }

    // I don't even
    public ppuWrite(address: number, data: number): number | null {
        const mappedAddress = this.mapper.ppuMapWrite(address);
        
        if (mappedAddress) {
            this.CHRROMData[mappedAddress] = data;
            return 1;
        } else {
            return null;
        }
    }
}