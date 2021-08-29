import Bus from "../bus";
import Register from "./register";
import { toHex } from "../utils/utils";

/**
 * 7         6         5-4         3        2                  1     0
 * Negative, Overflow, 2 reserved, Decimal, Interrupt Disable, Zero, Carry
 */
enum StatusFlag {
    /** Carry */
    C     = 0,
    /** Zero */
    Z     = 1,
    /** Interrupt disable */
    INT_D = 2,
    /** Decimal */
    D     = 3,
    /** B-flag, doesn't even exist, is used by BRK anyway */
    B     = 4,
    /** Overflow */
    V     = 6,
    /** Negative */
    N     = 7
}

enum AddressingMode {
    /** Implied (no operand) */
    IMP,
    /** Accumulator (operate on ACC) */
    ACC,
    /** Immediate (use operand as value) */
    IMM,
    /** Zero Page (fetch from an address on ZP) */
    ZP,
    /** Absolute (fetch from anywhere in memory) */
    ABS,
    /** Relative (branching, I guess operand is an offset?) */
    REL,
    /** Indirect (JMP, jump to 16-bit address) */
    IND,
    /** ZP indexed X, 4 cycles */
    ZPI_X,
    /** ZP indexed Y, 4 cycles */
    ZPI_Y,
    /** ABS indexed X, 4+ cycles */
    ABSI_X,
    /** ABS indexed Y, 4+ cycles */
    ABSI_Y,
    /** Indexed indirect X, 6 cycles */
    INDX_IND_X,
    /** Indirect indexed Y, 5+ cycles */
    IND_INDX_Y
}


interface Operation {
    opcode:   number;
    name:     string;
    addrMode: AddressingMode | null;
    cycles:   number;
    handler:  () => number;
}


/**
 * Represents the 6502 CPU of the NES
 */
export default class CPU {
    /** program counter */ 
    private PC: Register<Uint16Array>;
    /** stack pointer */
    private SP: Register<Uint8Array>;
    /** accumulator, aka A register */
    private ACC: Register<Uint8Array>;
    /** internal register X */
    private IRX: Register<Uint8Array>;
    /** internal regster Y */
    private IRY: Register<Uint8Array>;
    /** 7-bit processor status register
     * form left to right:
     * Negative, Overflow, 2 reserved, Decimal, Interrupt Disable, Zero, Carry
     */
    private PS: Register<Uint8Array>;

    private fetched: number    = 0x00;
    private absAddress: number = 0x0000;
    private relAddress: number = 0x0000;
    private opcode: number     = 0x00;
    private cycles             = 0;
    private internalClock      = 0;

    private bus: Bus | null;

    private operations: Operation[];

    
    constructor() {
        this.PC  = new Register<Uint16Array>(Uint16Array);
        this.SP  = new Register<Uint8Array>(Uint8Array);
        this.ACC = new Register<Uint8Array>(Uint8Array);
        this.IRX = new Register<Uint8Array>(Uint8Array);
        this.IRY = new Register<Uint8Array>(Uint8Array);
        this.PS  = new Register<Uint8Array>(Uint8Array);
        this.PS.setReg(0x36);
        this.bus = null;
        
        // javascript is garbage
        this.ADC = this.ADC.bind(this);
        this.AND = this.AND.bind(this);
        this.ASL = this.ASL.bind(this);
        this.BCC = this.BCC.bind(this);
        this.BCS = this.BCS.bind(this);
        this.BEQ = this.BEQ.bind(this);
        this.BMI = this.BMI.bind(this);
        this.BNE = this.BNE.bind(this);
        this.BPL = this.BPL.bind(this);
        this.BRK = this.BRK.bind(this);
        this.BVC = this.BVC.bind(this);
        this.BVS = this.BVS.bind(this);
        this.CLC = this.CLC.bind(this);
        this.CLD = this.CLD.bind(this);
        this.CLI = this.CLI.bind(this);
        this.CLV = this.CLV.bind(this);
        this.CMP = this.CMP.bind(this);
        this.CPX = this.CPX.bind(this);
        this.CPY = this.CPY.bind(this);
        this.DEC = this.DEC.bind(this);
        this.DEX = this.DEX.bind(this);
        this.DEY = this.DEY.bind(this);
        this.EOR = this.EOR.bind(this);
        this.INC = this.INC.bind(this);
        this.INX = this.INX.bind(this);
        this.INY = this.INY.bind(this);
        this.JMP = this.JMP.bind(this);
        this.JSR = this.JSR.bind(this);
        this.LDA = this.LDA.bind(this);
        this.LDX = this.LDX.bind(this);
        this.LDY = this.LDY.bind(this);
        this.LSR = this.LSR.bind(this);
        this.NOP = this.NOP.bind(this);
        this.ORA = this.ORA.bind(this);
        this.PHA = this.PHA.bind(this);
        this.PHP = this.PHP.bind(this);
        this.PLA = this.PLA.bind(this);
        this.PLP = this.PLP.bind(this);
        this.ROL = this.ROL.bind(this);
        this.RTI = this.RTI.bind(this);
        this.RTS = this.RTS.bind(this);
        this.SBC = this.SBC.bind(this);
        this.SEC = this.SEC.bind(this);
        this.SED = this.SED.bind(this);
        this.SEI = this.SEI.bind(this);
        this.STA = this.STA.bind(this);
        this.STX = this.STX.bind(this);
        this.STY = this.STY.bind(this);
        this.TAX = this.TAX.bind(this);
        this.TAY = this.TAY.bind(this);
        this.TSX = this.TSX.bind(this);
        this.TXA = this.TXA.bind(this);
        this.TXS = this.TXS.bind(this);
        this.TYA = this.TYA.bind(this);

        // The list has to be initialised after we bind all functions
        this.operations = [
            // $00 - $0F
            { opcode: 0x00, name: "BRK", addrMode: AddressingMode.IMP,        cycles: 7, handler: this.BRK },
            { opcode: 0x01, name: "ORA", addrMode: AddressingMode.INDX_IND_X, cycles: 6, handler: this.ORA },
            { opcode: 0x02, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x03, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x04, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x05, name: "ORA", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.ORA },
            { opcode: 0x06, name: "ASL", addrMode: AddressingMode.ZP,         cycles: 5, handler: this.ASL },
            { opcode: 0x07, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x08, name: "PHP", addrMode: AddressingMode.IMP,        cycles: 3, handler: this.PHP },
            { opcode: 0x09, name: "ORA", addrMode: AddressingMode.IMM,        cycles: 2, handler: this.ORA },
            { opcode: 0x0a, name: "ASL", addrMode: AddressingMode.ACC,        cycles: 2, handler: this.ASL },
            { opcode: 0x0b, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x0c, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x0d, name: "ORA", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.ORA },
            { opcode: 0x0e, name: "ASL", addrMode: AddressingMode.ABS,        cycles: 6, handler: this.ASL },
            { opcode: 0x0f, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $10 - $1F
            { opcode: 0x10, name: "BPL", addrMode: AddressingMode.REL,        cycles: 2, handler: this.BPL }, // 2+
            { opcode: 0x11, name: "ORA", addrMode: AddressingMode.IND_INDX_Y, cycles: 5, handler: this.ORA }, // 5+
            { opcode: 0x12, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x13, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x14, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x15, name: "ORA", addrMode: AddressingMode.ZPI_X,      cycles: 4, handler: this.ORA },
            { opcode: 0x16, name: "ASL", addrMode: AddressingMode.ZPI_X,      cycles: 6, handler: this.ASL },
            { opcode: 0x17, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x18, name: "CLC", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.CLC },
            { opcode: 0x19, name: "ORA", addrMode: AddressingMode.ABSI_Y,     cycles: 4, handler: this.ORA }, // 4+
            { opcode: 0x1a, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x1b, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x1c, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x1d, name: "ORA", addrMode: AddressingMode.ABSI_X,     cycles: 4, handler: this.ORA }, // 4+
            { opcode: 0x1e, name: "ASL", addrMode: AddressingMode.ABSI_X,     cycles: 6, handler: this.ASL }, // 6+
            { opcode: 0x1f, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $20 - $2F
            { opcode: 0x20, name: "JSR", addrMode: AddressingMode.ABS,        cycles: 6, handler: this.JSR },
            { opcode: 0x21, name: "AND", addrMode: AddressingMode.INDX_IND_X, cycles: 6, handler: this.AND },
            { opcode: 0x22, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x23, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x24, name: "BIT", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.BIT },
            { opcode: 0x25, name: "AND", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.AND },
            { opcode: 0x26, name: "ROL", addrMode: AddressingMode.ZP,         cycles: 5, handler: this.ROL },
            { opcode: 0x27, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x28, name: "PLP", addrMode: AddressingMode.IMP,        cycles: 4, handler: this.PLP },
            { opcode: 0x29, name: "AND", addrMode: AddressingMode.IMM,        cycles: 2, handler: this.AND },
            { opcode: 0x2a, name: "ROL", addrMode: AddressingMode.ACC,        cycles: 2, handler: this.ROL },
            { opcode: 0x2b, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x2c, name: "BIT", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.BIT },
            { opcode: 0x2d, name: "AND", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.AND },
            { opcode: 0x2e, name: "ROL", addrMode: AddressingMode.ABS,        cycles: 6, handler: this.ROL },
            { opcode: 0x2f, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $30 - $3F
            { opcode: 0x30, name: "BMI", addrMode: AddressingMode.REL,        cycles: 2, handler: this.BMI }, // 2+
            { opcode: 0x31, name: "AND", addrMode: AddressingMode.IND_INDX_Y, cycles: 5, handler: this.AND }, // 5+
            { opcode: 0x32, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x33, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x34, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x35, name: "AND", addrMode: AddressingMode.ZPI_X,      cycles: 4, handler: this.AND },
            { opcode: 0x36, name: "ROL", addrMode: AddressingMode.ZPI_X,      cycles: 6, handler: this.ROL },
            { opcode: 0x37, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x38, name: "SEC", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.SEC },
            { opcode: 0x39, name: "AND", addrMode: AddressingMode.ABSI_Y,     cycles: 4, handler: this.AND }, // 4+
            { opcode: 0x3a, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x3b, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x3c, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x3d, name: "AND", addrMode: AddressingMode.ABSI_X,     cycles: 4, handler: this.AND }, // 4+
            { opcode: 0x3e, name: "ROL", addrMode: AddressingMode.ABSI_X,     cycles: 6, handler: this.ROL }, // 6+
            { opcode: 0x3f, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $40 - $4F
            { opcode: 0x40, name: "RTI", addrMode: AddressingMode.IMP,        cycles: 6, handler: this.RTI },
            { opcode: 0x41, name: "EOR", addrMode: AddressingMode.INDX_IND_X, cycles: 6, handler: this.EOR },
            { opcode: 0x42, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x43, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x44, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x45, name: "EOR", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.EOR },
            { opcode: 0x46, name: "LSR", addrMode: AddressingMode.ZP,         cycles: 5, handler: this.LSR },
            { opcode: 0x47, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x48, name: "PHA", addrMode: AddressingMode.IMP,        cycles: 3, handler: this.PHA },
            { opcode: 0x49, name: "EOR", addrMode: AddressingMode.IMM,        cycles: 2, handler: this.EOR },
            { opcode: 0x4a, name: "LSR", addrMode: AddressingMode.ACC,        cycles: 2, handler: this.LSR },
            { opcode: 0x4b, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x4c, name: "JMP", addrMode: AddressingMode.ABS,        cycles: 3, handler: this.JMP },
            { opcode: 0x4d, name: "EOR", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.EOR },
            { opcode: 0x4e, name: "LSR", addrMode: AddressingMode.ABS,        cycles: 6, handler: this.LSR },
            { opcode: 0x4f, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $50 - $5F
            { opcode: 0x50, name: "BVC", addrMode: AddressingMode.REL,        cycles: 2, handler: this.BVC }, // 2+
            { opcode: 0x51, name: "EOR", addrMode: AddressingMode.IND_INDX_Y, cycles: 5, handler: this.EOR }, // 5+
            { opcode: 0x52, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x53, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x54, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x55, name: "EOR", addrMode: AddressingMode.ZPI_X,      cycles: 4, handler: this.EOR },
            { opcode: 0x56, name: "LSR", addrMode: AddressingMode.ZPI_X,      cycles: 6, handler: this.LSR },
            { opcode: 0x57, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x58, name: "CLI", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.CLI },
            { opcode: 0x59, name: "EOR", addrMode: AddressingMode.ABSI_Y,     cycles: 4, handler: this.EOR }, // 4+
            { opcode: 0x5a, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x5b, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x5c, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x5d, name: "EOR", addrMode: AddressingMode.ABSI_X,     cycles: 4, handler: this.EOR }, // 4+
            { opcode: 0x5e, name: "LSR", addrMode: AddressingMode.ABSI_X,     cycles: 6, handler: this.LSR }, // 6+
            { opcode: 0x5f, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $60 - $6F
            { opcode: 0x60, name: "RTS", addrMode: AddressingMode.IMP,        cycles: 6, handler: this.RTS },
            { opcode: 0x61, name: "ADC", addrMode: AddressingMode.INDX_IND_X, cycles: 6, handler: this.ADC },
            { opcode: 0x62, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x63, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x64, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x65, name: "ADC", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.ADC },
            { opcode: 0x66, name: "ROR", addrMode: AddressingMode.ZP,         cycles: 5, handler: this.ROR },
            { opcode: 0x67, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x68, name: "PLA", addrMode: AddressingMode.IMP,        cycles: 4, handler: this.PLA },
            { opcode: 0x69, name: "ADC", addrMode: AddressingMode.IMM,        cycles: 2, handler: this.ADC },
            { opcode: 0x6a, name: "ROR", addrMode: AddressingMode.ACC,        cycles: 2, handler: this.ROR },
            { opcode: 0x6b, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x6c, name: "JMP", addrMode: AddressingMode.IND,        cycles: 6, handler: this.JMP },
            { opcode: 0x6d, name: "ADC", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.ADC },
            { opcode: 0x6e, name: "ROR", addrMode: AddressingMode.ABSI_X,     cycles: 6, handler: this.ROR },
            { opcode: 0x6f, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $70 - $7F
            { opcode: 0x70, name: "BVS", addrMode: AddressingMode.REL,        cycles: 2, handler: this.BVS }, // 2+
            { opcode: 0x71, name: "ADC", addrMode: AddressingMode.IND_INDX_Y, cycles: 5, handler: this.ADC }, // 5+
            { opcode: 0x72, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x73, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x74, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x75, name: "ADC", addrMode: AddressingMode.ZPI_X,      cycles: 4, handler: this.ADC },
            { opcode: 0x76, name: "ROR", addrMode: AddressingMode.ZPI_X,      cycles: 6, handler: this.ROR },
            { opcode: 0x77, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x78, name: "SEI", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.SEI },
            { opcode: 0x79, name: "ADC", addrMode: AddressingMode.ABSI_Y,     cycles: 4, handler: this.ADC }, // 4+
            { opcode: 0x7a, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x7b, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x7c, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x7d, name: "ADC", addrMode: AddressingMode.ABSI_X,     cycles: 4, handler: this.ADC }, // 4+
            { opcode: 0x7e, name: "ROR", addrMode: AddressingMode.ABS,        cycles: 6, handler: this.ROR }, // 6+
            { opcode: 0x7f, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $80 - $8F
            { opcode: 0x80, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x81, name: "STA", addrMode: AddressingMode.INDX_IND_X, cycles: 6, handler: this.STA },
            { opcode: 0x82, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x83, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x84, name: "STY", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.STY },
            { opcode: 0x85, name: "STA", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.STA },
            { opcode: 0x86, name: "STX", addrMode: AddressingMode.ZP,         cycles: 5, handler: this.STX },
            { opcode: 0x87, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x88, name: "DEY", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.DEY },
            { opcode: 0x89, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x8a, name: "TXA", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.TXA },
            { opcode: 0x8b, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x8c, name: "STY", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.STY },
            { opcode: 0x8d, name: "STA", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.STA },
            { opcode: 0x8e, name: "STX", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.STX },
            { opcode: 0x8f, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $90 - $9F
            { opcode: 0x90, name: "BCC", addrMode: AddressingMode.REL,        cycles: 2, handler: this.BCC }, // 2+
            { opcode: 0x91, name: "STA", addrMode: AddressingMode.IND_INDX_Y, cycles: 6, handler: this.STA },
            { opcode: 0x92, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x93, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x94, name: "STY", addrMode: AddressingMode.ZPI_X,      cycles: 4, handler: this.STY },
            { opcode: 0x95, name: "STA", addrMode: AddressingMode.ZPI_X,      cycles: 4, handler: this.STA },
            { opcode: 0x96, name: "STX", addrMode: AddressingMode.ZPI_Y,      cycles: 4, handler: this.STX },
            { opcode: 0x97, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x98, name: "TYA", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.TYA },
            { opcode: 0x99, name: "STA", addrMode: AddressingMode.ABSI_Y,     cycles: 5, handler: this.STA },
            { opcode: 0x9a, name: "TXS", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.TXS },
            { opcode: 0x9b, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x9c, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x9d, name: "STA", addrMode: AddressingMode.ABSI_Y,     cycles: 5, handler: this.STA },
            { opcode: 0x9e, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0x9f, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $A0 - $AF
            { opcode: 0xa0, name: "LDY", addrMode: AddressingMode.IMM,        cycles: 2, handler: this.LDY },
            { opcode: 0xa1, name: "LDA", addrMode: AddressingMode.INDX_IND_X, cycles: 6, handler: this.LDA },
            { opcode: 0xa2, name: "LDX", addrMode: AddressingMode.IMM,        cycles: 2, handler: this.LDX },
            { opcode: 0xa3, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xa4, name: "LDY", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.LDY },
            { opcode: 0xa5, name: "LDA", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.LDA },
            { opcode: 0xa6, name: "LDX", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.LDX },
            { opcode: 0xa7, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xa8, name: "TAY", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.TAY },
            { opcode: 0xa9, name: "LDA", addrMode: AddressingMode.IMM,        cycles: 2, handler: this.LDA },
            { opcode: 0xaa, name: "TAX", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.TAX },
            { opcode: 0xab, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xac, name: "LDY", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.LDY },
            { opcode: 0xad, name: "LDA", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.LDA },
            { opcode: 0xae, name: "LDX", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.LDX },
            { opcode: 0xaf, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $B0 - $BF
            { opcode: 0xb0, name: "BCS", addrMode: AddressingMode.REL,        cycles: 2, handler: this.BCS }, // 2+
            { opcode: 0xb1, name: "LDA", addrMode: AddressingMode.IND_INDX_Y, cycles: 5, handler: this.LDA }, // 5+
            { opcode: 0xb2, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xb3, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xb4, name: "LDY", addrMode: AddressingMode.ZPI_X,      cycles: 5, handler: this.LDY },
            { opcode: 0xb5, name: "LDA", addrMode: AddressingMode.ZPI_X,      cycles: 4, handler: this.LDA },
            { opcode: 0xb6, name: "LDX", addrMode: AddressingMode.ZPI_Y,      cycles: 4, handler: this.LDX },
            { opcode: 0xb7, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xb8, name: "CLV", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.CLV },
            { opcode: 0xb9, name: "LDA", addrMode: AddressingMode.ABSI_Y,     cycles: 4, handler: this.LDA }, // 4+
            { opcode: 0xba, name: "TSX", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.TSX },
            { opcode: 0xbb, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xbc, name: "LDY", addrMode: AddressingMode.ABSI_X,     cycles: 4, handler: this.LDY }, // 4+
            { opcode: 0xbd, name: "LDA", addrMode: AddressingMode.ABSI_X,     cycles: 4, handler: this.LDA }, // 4+
            { opcode: 0xbe, name: "LDX", addrMode: AddressingMode.ABSI_Y,     cycles: 4, handler: this.LDX }, // 4+
            { opcode: 0xbf, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $C0 - $CF
            { opcode: 0xc0, name: "CPY", addrMode: AddressingMode.IMM,        cycles: 2, handler: this.CPY },
            { opcode: 0xc1, name: "CMP", addrMode: AddressingMode.INDX_IND_X, cycles: 6, handler: this.CMP },
            { opcode: 0xc2, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xc3, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xc4, name: "CPY", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.CPY },
            { opcode: 0xc5, name: "CMP", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.CMP },
            { opcode: 0xc6, name: "DEC", addrMode: AddressingMode.ZP,         cycles: 5, handler: this.DEC },
            { opcode: 0xc7, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xc8, name: "INY", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.INY },
            { opcode: 0xc9, name: "CMP", addrMode: AddressingMode.IMM,        cycles: 2, handler: this.CMP },
            { opcode: 0xca, name: "DEX", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.DEX },
            { opcode: 0xcb, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xcc, name: "CPY", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.CPY },
            { opcode: 0xcd, name: "CMP", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.CMP },
            { opcode: 0xce, name: "DEC", addrMode: AddressingMode.ABS,        cycles: 6, handler: this.DEC },
            { opcode: 0xcf, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $D0 - $DF
            { opcode: 0xd0, name: "BNE", addrMode: AddressingMode.REL,        cycles: 2, handler: this.BNE }, // 2+
            { opcode: 0xd1, name: "CMP", addrMode: AddressingMode.IND_INDX_Y, cycles: 5, handler: this.CMP }, // 5+
            { opcode: 0xd2, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xd3, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xd4, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xd5, name: "CMP", addrMode: AddressingMode.ZPI_X,      cycles: 5, handler: this.CMP },
            { opcode: 0xd6, name: "DEC", addrMode: AddressingMode.ZPI_X,      cycles: 6, handler: this.DEC },
            { opcode: 0xd7, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xd8, name: "CLD", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.CLD },
            { opcode: 0xd9, name: "CMP", addrMode: AddressingMode.ABSI_Y,     cycles: 4, handler: this.CMP }, // 4+
            { opcode: 0xda, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xdb, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xdc, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xdd, name: "CMP", addrMode: AddressingMode.ABSI_X,     cycles: 4, handler: this.CMP }, // 4+
            { opcode: 0xde, name: "DEC", addrMode: AddressingMode.ABSI_X,     cycles: 7, handler: this.DEC },
            { opcode: 0xdf, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $E0 - $EF
            { opcode: 0xe0, name: "CPX", addrMode: AddressingMode.IMM,        cycles: 2, handler: this.CPX },
            { opcode: 0xe1, name: "SBC", addrMode: AddressingMode.INDX_IND_X, cycles: 6, handler: this.SBC },
            { opcode: 0xe2, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xe3, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xe4, name: "CPX", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.CPX },
            { opcode: 0xe5, name: "SBC", addrMode: AddressingMode.ZP,         cycles: 3, handler: this.SBC },
            { opcode: 0xe6, name: "INC", addrMode: AddressingMode.ZP,         cycles: 2, handler: this.INC },
            { opcode: 0xe7, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xe8, name: "INX", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.INX },
            { opcode: 0xe9, name: "SBC", addrMode: AddressingMode.IMM,        cycles: 2, handler: this.SBC },
            { opcode: 0xea, name: "NOP", addrMode: AddressingMode.IMP,        cycles: 2, handler: this.NOP },
            { opcode: 0xeb, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xec, name: "CPX", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.CPX },
            { opcode: 0xed, name: "SBC", addrMode: AddressingMode.ABS,        cycles: 4, handler: this.SBC },
            { opcode: 0xee, name: "INC", addrMode: AddressingMode.ABS,        cycles: 6, handler: this.INC },
            { opcode: 0xef, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            // $F0 - $FF
            { opcode: 0xf0, name: "BEQ", addrMode: AddressingMode.REL,        cycles: 2, handler: this.BEQ }, // 2+
            { opcode: 0xf1, name: "SBC", addrMode: AddressingMode.IND_INDX_Y, cycles: 5, handler: this.SBC }, // 5+
            { opcode: 0xf2, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xf3, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xf4, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xf5, name: "SBC", addrMode: AddressingMode.ZPI_X,      cycles: 5, handler: this.SBC },
            { opcode: 0xf6, name: "INC", addrMode: AddressingMode.ZPI_X,      cycles: 4, handler: this.INC },
            { opcode: 0xf7, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xf8, name: "SED", addrMode: AddressingMode.IMP,        cycles: 6, handler: this.SED },
            { opcode: 0xf9, name: "SBC", addrMode: AddressingMode.ABSI_Y,     cycles: 4, handler: this.SBC }, // 4+
            { opcode: 0xfa, name: "SBC", addrMode: AddressingMode.ABSI_X,     cycles: 4, handler: this.SBC }, // 4+
            { opcode: 0xfb, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xfc, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xfd, name: "INC", addrMode: AddressingMode.ABSI_X,     cycles: 7, handler: this.INC },
            { opcode: 0xfe, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
            { opcode: 0xff, name: "NOP", addrMode: null,                      cycles: 0, handler: this.NOP },
        ];
    }

    get getPC(): number {
        return this.PC.getValue;
    }

    get getSP(): number {
        return this.SP.getValue;
    }
    
    get getACC(): number {
        return this.ACC.getValue;
    }
    
    get getIRX(): number {
        return this.IRX.getValue;
    }
    
    get getIRY(): number {
        return this.IRY.getValue;
    }

    get getPS(): Register<Uint8Array> {
        return this.PS;
    }

    get curOperation(): string {
        return this.operations[this.bus.read(this.PC.getValue)].name;
    }

    get clockCount(): number {
        return this.internalClock;
    }
    
    public connectBus(bus: Bus): void {
        this.bus = bus;
    }

    private execAddrModeFunc(mode: AddressingMode | null): number {
        let cycles: number = 0;
        switch (mode) {
            case AddressingMode.IMP:
                this.fetched = this.ACC.getValue;
                cycles = 0;
                break;
            case AddressingMode.ACC:
                this.fetched = this.ACC.getValue;
                cycles = 0;
                break;
            case AddressingMode.IMM:
                // get address first, increment PC second, don't forget that
                this.absAddress = this.PC.getValue;
                this.PC.incr();
                cycles = 0;
                break;
            case AddressingMode.ZP: {
                this.absAddress = this.bus.read(this.PC.getValue);
                this.PC.incr();
                this.absAddress &= 0x00FF;
                break;
            }
            case AddressingMode.ABS: {
                const low = this.bus.read(this.PC.getValue);
                this.PC.incr();
                const high = this.bus.read(this.PC.getValue);
                this.PC.incr();
                this.absAddress = (high << 8) | low;
                cycles = 0;
                break;
            }
            case AddressingMode.REL:
                this.relAddress = this.bus.read(this.PC.getValue);
                this.PC.incr();

                if (this.relAddress & 0x80) {
                    this.relAddress |= 0xFF00;
                }
                // if (this.relAddress < 0x80) {
                //     //
                // } else {
                //     this.relAddress -= 0x0100;
                // }
                cycles = 0;
                break;
            case AddressingMode.IND: {
                const low = this.bus.read(this.PC.getValue);
                this.PC.incr();
                const high = this.bus.read(this.PC.getValue);
                this.PC.incr();

                const pointerAddress = (high << 8) | low;

                // so apparently this thing is bugged? Thanks 6502
                if (low === 0x00FF) {
                    this.absAddress = ((this.bus.read(pointerAddress & 0xFF00) << 8) | this.bus.read(pointerAddress + 0)); 
                } else {
                    this.absAddress = ((this.bus.read(pointerAddress + 1) << 8) | this.bus.read(pointerAddress + 0)); 
                }
                break;
            }
            case AddressingMode.ZPI_X: {
                this.absAddress = this.bus.read(this.PC.getValue) + this.IRX.getValue;
                this.PC.incr();
                this.absAddress &= 0x00FF;
                break;
            }
            case AddressingMode.ZPI_Y: {
                this.absAddress = this.bus.read(this.PC.getValue) + this.IRY.getValue;
                this.PC.incr();
                this.absAddress &= 0x00FF;
                break;
            }
            case AddressingMode.ABSI_X: {
                const low = this.bus.read(this.PC.getValue);
                this.PC.incr();
                const high = this.bus.read(this.PC.getValue);
                this.PC.incr();

                this.absAddress = (high << 8) | low;
                this.absAddress += this.IRX.getValue;

                if ((this.absAddress & 0xFF00) !== (high << 8)) {
                    cycles = 1;
                } else {
                    cycles = 0;
                }
                break;
            }
            case AddressingMode.ABSI_Y: {
                const low = this.bus.read(this.PC.getValue);
                this.PC.incr();
                const high = this.bus.read(this.PC.getValue);
                this.PC.incr();

                this.absAddress = (high << 8) | low;
                this.absAddress += this.IRY.getValue;

                if ((this.absAddress & 0xFF00) !== (high << 8)) {
                    cycles = 1;
                } else {
                    cycles = 0;
                }
                break;
            }
            case AddressingMode.INDX_IND_X: {
                const LL = this.bus.read(this.PC.getValue);
                this.PC.incr();

                const low  = this.bus.read((LL + this.IRX.getValue) & 0x00FF);
                const high = this.bus.read((LL + this.IRX.getValue + 1) & 0x00FF);

                this.absAddress = (high << 8) | low;

                cycles = 0;
                break;
            }
            case AddressingMode.IND_INDX_Y: {
                const LL = this.bus.read(this.PC.getValue);
                this.PC.incr();

                const low  = this.bus.read(LL     & 0x00FF);
                const high = this.bus.read(LL + 1 & 0x00FF);

                this.absAddress = (high << 8) | low;
                this.absAddress += this.IRY.getValue;

                if ((this.absAddress & 0xFF00) != (high << 8)) {
                    cycles = 1;
                } else {
                    cycles = 0;
                }
                break;
            }
        }

        return cycles;
    }
    
    public testOpcode(opcode: number): string {
        const op = this.operations[opcode];
        let res = "";
        if (op.addrMode !== null) {
            res = 
                "opcode:   "   + op.opcode.toString(16) + 
                "\nname:     " + op.name + 
                "\naddrMode: " + AddressingMode[op.addrMode] + 
                "\ncycles:   " + op.cycles + 
                "\nhandler:  " + op.handler.name;
        } else {
            res = 
                "opcode:   "   + op.opcode.toString(16) + 
                "\nname:     " + op.name + 
                "\naddrMode: " + null + 
                "\ncycles:   " + op.cycles + 
                "\nhandler:  " + op.handler.name;
        }
        return res;
    }

    /** unused */
    private writeToMemory(address: number, val: number): void {
        this.bus.write(address, val);
    }

    private writeToStack(val: number): void {
        this.bus.write(0x0100 + this.SP.getValue, val);
        this.SP.decr();
    }

    private readFromStack(): number {
        this.SP.incr();
        return this.bus.read(0x0100 + this.SP.getValue);
    }

    private loadFromMemory(): number {
        if (this.operations[this.opcode].addrMode === AddressingMode.IMP) return 0x00;

        return this.bus.read(this.absAddress);
    }

    public clock(): void {
        // console.log(this.cycles);
        if (this.cycles === 0) {
            this.opcode = this.fetchNextOpcode();
            const operation = this.operations[this.opcode];

            this.PS.setBit(5);

            this.cycles = operation.cycles;

            // perform addressing mode functions if needed
            const addrModeCycles = this.execAddrModeFunc(operation.addrMode);
            // execute the operation
            const operationCycles = operation.handler();

            this.cycles += (addrModeCycles + operationCycles);
        }

        this.cycles--;
        this.internalClock++;
    }

    public singleStep(): void {
        do {
            this.clock();
        } while ((this.cycles !== 0));
    }

    private fetchNextOpcode() {
        const opcode = this.bus.read(this.PC.getValue);
        this.PC.incr();
        return opcode;
    }
    
    /**
     * Non-maskable interrupt
     * The same as IRQ, but cannot be disabled
     * NMI low: FFFA high: FFFB
     */
    public NMI(): void {
        this.writeToStack((this.PC.getValue >> 8) & 0x00FF);
        this.writeToStack(this.PC.getValue & 0x00FF);

        this.PS.clearBit(StatusFlag.B);
        // this.SP.clearBit(StatusFlag.U);
        this.PS.setBit(StatusFlag.INT_D);

        this.writeToStack(this.PS.getValue);

        // these values are fixed
        this.absAddress = 0xFFFA;
        const low  = this.bus.read(this.absAddress);
        const high = this.bus.read(this.absAddress + 1); // 0xFFFB

        this.PC.setReg((high << 8) | low);

        this.cycles = 8;
    }

    /**
     * Interrupt request
     * 1. The processor completes the current instruction and updates registers or memory as required before responding to the interrupt.
     * 2. The most significant byte (MSB) of the program counter (PC) is pushed onto the stack.
     * 3. The least significant byte (LSB) of the program counter is pushed onto the stack.
     * 4. The status register (SR) is pushed onto the stack.
     * 5. The interrupt disable flag is set in the status register.
     * 6. PC is loaded from the relevant vector (IRQ/BRK low: FFFE high: FFFF)
     */
    public IRQ(): void {
        if (!this.PS.getBit(StatusFlag.INT_D)) {
            this.writeToStack((this.PC.getValue >> 8) & 0x00FF);
            this.writeToStack(this.PC.getValue & 0x00FF);

            this.PS.clearBit(StatusFlag.B);
            // this.SP.clearBit(StatusFlag.U);
            this.PS.setBit(StatusFlag.INT_D);

            this.writeToStack(this.PS.getValue);

            // these values are fixed
            this.absAddress = 0xFFFE;
            const low  = this.bus.read(this.absAddress);
            const high = this.bus.read(this.absAddress + 1); // 0xFFFF

            this.PC.setReg((high << 8) | low);

            this.cycles = 7;
        }
    }

    // ! If Reset doesn't work correctly, this is why
    public reset(): void {
        this.absAddress = 0xFFFC;
        const low  = this.bus.read(this.absAddress + 0);
        const high = this.bus.read(this.absAddress + 1); // 0xFFFD
        this.PC.setReg((high << 8) | low);
        console.log("reset PC: " + toHex(this.PC.getValue, 4));

        this.ACC.setReg(0x00);
        this.IRX.setReg(0x00);
        this.IRY.setReg(0x00);

        this.SP.setReg(0xFD);
        this.PS.setReg(0x00);

        // this.PS.setBit(StatusFlag.INT_D);
        this.absAddress = 0x0000;
        this.relAddress = 0x0000;
        this.fetched    = 0x00;

        this.cycles = 8;
    }

    /**
     * Reset
     * 1. A, X, Y are not affected
     * 2. S is decremented by 3 (but nothing is written to the stack)
     * 3. The I (IRQ disable) flag is set to true (status ORed with $04)
     * 4. The internal memory is unchanged
     * 5. APU mode in $4017 is unchanged
     * 6. APU is silenced ($4015 = 0)
     * 7. APU triangle phase is reset to 0 (i.e. outputs a value of 15, the first step of its waveform)
     * 8. APU DPCM output ANDed with 1 (upper 6 bits cleared)
     * 9. 2A03G: APU Frame Counter reset. (but 2A03letterless: APU frame counter retains old value)
     * 10. RESET DOES NOT PUSH TO STACK
     * 
     * low: FFFC high: FFFD 
     */
    // public reset(): void {
    //     this.absAddress = 0xFFFC;
    //     const low  = this.bus.read(this.absAddress);
    //     const high = this.bus.read(this.absAddress + 1); // 0xFFFD
    //     this.PC.setRegister((high << 8) | low);

    //     this.SP.sub(3);

    //     this.PS.setBit(StatusFlag.INT_D);

    //     this.cycles = 8;
    // }

    // Operation implementations

    /**
     * Add with carry
     */
    private ADC(): number {
        this.fetched = this.loadFromMemory();
        const temp = this.ACC.getValue + this.fetched + this.PS.getBit(StatusFlag.C);

        this.PS.storeBit(StatusFlag.C, +(temp > 255));
        this.PS.storeBit(StatusFlag.N, +Boolean(temp & 0x80));
        this.PS.storeBit(StatusFlag.Z, +((temp & 0x00FF) === 0));
        this.PS.storeBit(StatusFlag.V, (~(this.ACC.getValue ^ this.fetched) & (this.ACC.getValue ^ temp) & 0x0080));

        this.ACC.setReg(temp & 0x00FF);

        return 1;
    }

    /**
     * AND with Accumulator
     */
    private AND(): number {
        this.fetched = this.loadFromMemory();
        const temp = this.ACC.getValue & this.fetched;
        this.ACC.setReg(temp);

        this.PS.storeBit(StatusFlag.Z, +(this.ACC.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.ACC.getValue & 0x80));
        return 1;
    }

    /**
     * Arithmetic shift left
     */
    private ASL(): number {
        this.fetched = this.loadFromMemory();
        const temp = this.fetched << 1;

        this.PS.storeBit(StatusFlag.C, +((temp & 0xFF00) > 0));
        this.PS.storeBit(StatusFlag.N, +Boolean(temp & 0x80));
        this.PS.storeBit(StatusFlag.Z, +((temp & 0x00FF) === 0));

        if (this.operations[this.opcode].addrMode === AddressingMode.IMM) {
            this.ACC.setReg(temp);
        } else {
            this.bus.write(this.absAddress, temp & 0x00FF);
        }

        return 0;
    }

    /**
     * Branch on carry clear
     */
    private BCC(): number {
        if (!this.PS.getBit(StatusFlag.C)) {
            this.cycles++;
            this.absAddress = this.PC.getValue + this.relAddress;

            if ((this.absAddress & 0xFF00) !== (this.PC.getValue & 0xFF00)) {
                this.cycles++;
            }

            this.PC.setReg(this.absAddress);
        }
        return 0;
    }

    /**
     * Branch on carry set
     */
    private BCS(): number {
        if (this.PS.getBit(StatusFlag.C)) {
            this.cycles++;
            this.absAddress = this.PC.getValue + this.relAddress;

            if ((this.absAddress & 0xFF00) !== (this.PC.getValue & 0xFF00)) {
                this.cycles++;
            }

            this.PC.setReg(this.absAddress);
        }
        return 0;
    }

    /**
     * Branch on equal
     */
    private BEQ(): number {
        if (this.PS.getBit(StatusFlag.Z)) {
            this.cycles++;
            this.absAddress = this.PC.getValue + this.relAddress;

            if ((this.absAddress & 0xFF00) !== (this.PC.getValue & 0xFF00)) {
                this.cycles++;
            }

            this.PC.setReg(this.absAddress);
        }
        return 0;
    }

    /**
     * Bit test
     */
    private BIT(): number {
        this.fetched = this.loadFromMemory();
        const newN = (this.fetched & (1 << StatusFlag.N));
        const newV = (this.fetched & (1 << StatusFlag.V));
        this.PS.storeBit(StatusFlag.N, newN);
        this.PS.storeBit(StatusFlag.V, newV);

        const temp = this.ACC.getValue & this.fetched;

        const newZ = (temp & 0x00FF) === 0x00;

        this.PS.storeBit(StatusFlag.Z, +newZ);

        return 0;
    }

    /**
     * Branch on minus (negative set)
     */
    private BMI(): number {
        if (this.PS.getBit(StatusFlag.N)) {
            this.cycles++;
            const temp: Uint16Array = new Uint16Array(1);
            temp[0] = this.PC.getValue + this.relAddress;
            this.absAddress = temp[0];

            if ((this.absAddress & 0xFF00) !== (this.PC.getValue & 0xFF00)) {
                this.cycles++;
            }

            this.PC.setReg(this.absAddress);
        }

        return 0;
    }

    /**
     * Branch on not equal (zero clear)
     */
    private BNE(): number {
        if (!this.PS.getBit(StatusFlag.Z)) {
            this.cycles++;
            const temp: Uint16Array = new Uint16Array(1);
            temp[0] = this.PC.getValue + this.relAddress;
            this.absAddress = temp[0];

            if ((this.absAddress & 0xFF00) !== (this.PC.getValue & 0xFF00)) {
                this.cycles++;
            }

            this.PC.setReg(this.absAddress);
        }
        return 0;
    }

    /**
     * Branch on plus (negative clear)
     */
    private BPL(): number {
        if (!this.PS.getBit(StatusFlag.N)) {
            this.cycles++;
            const temp: Uint16Array = new Uint16Array(1);
            temp[0] = this.PC.getValue + this.relAddress;
            this.absAddress = temp[0];

            if ((this.absAddress & 0xFF00) !== (this.PC.getValue & 0xFF00)) {
                this.cycles++;
            }

            this.PC.setReg(this.absAddress);
        }
        return 0;
    }

    /**
     * Break / interrupt
     */
    private BRK(): number {
        // console.warn("Invoked BRK, probably end of RAM");
        this.PC.incr();

        this.PS.setBit(StatusFlag.INT_D);
        this.writeToStack((this.PC.getValue >> 8) & 0x00FF);
        this.writeToStack(this.PC.getValue & 0x00FF);

        this.PS.setBit(StatusFlag.B);
        this.writeToStack(this.PS.getValue);
        this.PS.clearBit(StatusFlag.B);

        const low  = this.bus.read(0xFFFE);
        const high = this.bus.read(0xFFFF);
        
        this.PC.setReg(low | (high << 8));
        return 0;
    }

    /**
     * Branch on overflow clear
     */
    private BVC(): number {
        if (!this.PS.getBit(StatusFlag.V)) {
            this.cycles++;
            const temp: Uint16Array = new Uint16Array(1);
            temp[0] = this.PC.getValue + this.relAddress;
            this.absAddress = temp[0];

            if ((this.absAddress & 0xFF00) !== (this.PC.getValue & 0xFF00)) {
                this.cycles++;
            }

            this.PC.setReg(this.absAddress);
        }

        return 0;
    }

    /**
     * Branch on overflow set
     */
    private BVS(): number {
        // V has come to
        if (this.PS.getBit(StatusFlag.V)) {
            this.cycles++;
            const temp: Uint16Array = new Uint16Array(1);
            temp[0] = this.PC.getValue + this.relAddress;
            this.absAddress = temp[0];

            if ((this.absAddress & 0xFF00) !== (this.PC.getValue & 0xFF00)) {
                this.cycles++;
            }

            this.PC.setReg(this.absAddress);
        }
        return 0;
    }

    /**
     * Carry clear
     */
    private CLC(): number {
        this.PS.clearBit(StatusFlag.C);
        return 0;
    }

    /**
     * Clear decimal
     */
    private CLD(): number {
        this.PS.clearBit(StatusFlag.D);
        return 0;
    }

    /**
     * Clear interrupt disable
     */
    private CLI(): number {
        this.PS.clearBit(StatusFlag.INT_D);
        return 0;
    }

    /**
     * Clear overflow
     */
    private CLV(): number {
        this.PS.clearBit(StatusFlag.V);
        return 0;
    }

    /**
     * Compare (with accumulator)
     */
    private CMP(): number {
        this.fetched = this.loadFromMemory();

        const temp: Uint16Array = new Uint16Array(1);
        temp[0] = this.ACC.getValue - this.fetched;
        // const temp = ;

        this.PS.storeBit(StatusFlag.N, +Boolean(temp[0] & 0x0080));
        this.PS.storeBit(StatusFlag.C, +(temp[0] > this.fetched));
        this.PS.storeBit(StatusFlag.Z, +((temp[0] & 0x00FF) === 0x0000));

        return 1;
    }

    /**
     * Compare with X
     */
    private CPX(): number {
        this.fetched = this.loadFromMemory();

        const temp: Uint16Array = new Uint16Array(1);
        temp[0] = this.IRX.getValue - this.fetched;

        this.PS.storeBit(StatusFlag.N, +Boolean(temp[0] & 0x0080));
        this.PS.storeBit(StatusFlag.C, +(temp[0] > this.fetched));
        this.PS.storeBit(StatusFlag.Z, +((temp[0] & 0x00FF) === 0x0000));
        return 0;
    }

    /**
     * Compare with Y
     */
    private CPY(): number {
        this.fetched = this.loadFromMemory();

        const temp: Uint16Array = new Uint16Array(1);
        temp[0] = this.IRY.getValue - this.fetched;

        this.PS.storeBit(StatusFlag.N, +Boolean(temp[0] & 0x0080));
        this.PS.storeBit(StatusFlag.C, +(temp[0] > this.fetched));
        this.PS.storeBit(StatusFlag.Z, +((temp[0] & 0x00FF) === 0x0000));
        return 0;
    }

    /**
     * Decrement
     */
    private DEC(): number {
        this.fetched = this.loadFromMemory();
        const temp = this.fetched - 1;
        this.writeToMemory(this.absAddress, temp & 0x00FF);
        this.PS.storeBit(StatusFlag.Z, +(temp === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(temp & 0x80));
        return 0;
    }

    /**
     * Decrement X
     */
    private DEX(): number {
        this.IRX.decr();
        this.PS.storeBit(StatusFlag.Z, +(this.IRX.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.IRX.getValue & 0x80));
        return 0;
    }

    /**
     * Decrement Y
     */
    private DEY(): number {
        this.IRY.decr();
        this.PS.storeBit(StatusFlag.Z, +(this.IRY.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.IRY.getValue & 0x80));
        return 0;
    }

    /**
     * Exclusive OR (with accumulator)
     */
    private EOR(): number {
        this.fetched = this.loadFromMemory();
        const temp = this.ACC.getValue ^ this.fetched;
        this.ACC.setReg(temp);

        this.PS.storeBit(StatusFlag.Z, +(this.ACC.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.ACC.getValue & 0x80));

        return 0;
    }

    /**
     * Increment
     */
    private INC(): number {
        this.fetched = this.loadFromMemory();
        const temp = this.fetched + 1;
        this.bus.write(this.absAddress, temp);

        this.PS.storeBit(StatusFlag.N, +(temp & 0x0080));
        this.PS.storeBit(StatusFlag.Z, +Boolean((temp & 0x00FF) === 0x0000));

        return 0;
    }

    /**
     * Increment X
     */
    private INX(): number {
        this.IRX.incr();
        this.PS.storeBit(StatusFlag.Z, +(this.IRX.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.IRX.getValue & 0x80));
        return 0;
    }

    /**
     * Increment Y
     */
    private INY(): number {
        this.IRY.incr();
        this.PS.storeBit(StatusFlag.Z, +(this.IRY.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.IRY.getValue & 0x80));
        return 0;
    }

    /**
     * Jump
     */
    private JMP(): number {
        this.PC.setReg(this.absAddress);
        return 0;
    }

    /**
     * Jump subroutine
     */
    private JSR(): number {
        this.PC.decr();
        this.writeToStack((this.PC.getValue >> 8) & 0x00FF);
        this.writeToStack(this.PC.getValue & 0x00FF);

        this.PC.setReg(this.absAddress);
        return 0;
    }

    /**
     * Load accumulator
     */
    private LDA(): number {
        this.fetched = this.loadFromMemory();
        // console.log(this.fetched, this.absAddress);

        this.ACC.setReg(this.fetched);
        this.PS.storeBit(StatusFlag.Z, +(this.ACC.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.ACC.getValue & 0x80));
        return 1;
    }

    /**
     * Load X
     */
    private LDX(): number {
        this.fetched = this.loadFromMemory();
        this.IRX.setReg(this.fetched);
        this.PS.storeBit(StatusFlag.Z, +(this.IRX.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.IRX.getValue & 0x80));
        return 1;
    }

    /**
     * Load Y
     */
    private LDY(): number {
        this.fetched = this.loadFromMemory();
        this.IRY.setReg(this.fetched);
        this.PS.storeBit(StatusFlag.Z, +(this.IRY.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.IRY.getValue & 0x80));
        return 1;
    }

    /**
     * Logical shift right
     */
    private LSR(): number {
        this.fetched = this.loadFromMemory();
        this.PS.storeBit(StatusFlag.C, this.fetched & 0x0001);
        const temp = this.fetched >> 1;

        this.PS.storeBit(StatusFlag.N, +Boolean(temp & 0x0080));
        this.PS.storeBit(StatusFlag.Z, +((temp & 0x00FF) === 0x0000));

        if (this.operations[this.opcode].addrMode === AddressingMode.IMM) {
            this.ACC.setReg(temp);
        } else {
            this.bus.write(this.absAddress, temp & 0x00FF);
        }

        return 0;
    }

    /**
     * No operation
     */
    private NOP(): number {
        switch (this.opcode) {
            case 0x1C:
            case 0x3C:
            case 0x5C:
            case 0x7C:
            case 0xDC:
            case 0xFC:
                return 1;
            }
            return 0;
    }

    /**
     * OR with accumulator
     */
    private ORA(): number {
        this.fetched = this.loadFromMemory();
        const temp = this.ACC.getValue | this.fetched;
        this.ACC.setReg(temp);

        this.PS.storeBit(StatusFlag.Z, +(this.ACC.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.ACC.getValue & 0x80));
        return 0;
    }

    /**
     * Push accumulator to stack
     */
    private PHA(): number {
        this.writeToMemory(0x0100 + this.SP.getValue, this.ACC.getValue);
        this.SP.decr();
        return 0;
    }

    /**
     * Push processor status to stack
     */
    private PHP(): number {
        this.writeToMemory(0x0100 + this.SP.getValue, this.PS.getValue);
        this.SP.setBit(StatusFlag.B);
        this.SP.setBit(5);
        this.SP.decr();
        return 0;
    }

    /**
     * Pull accumulator from stack
     */
    private PLA(): number {
        this.SP.incr();
        this.ACC.setReg(this.bus.read(0x0100 + this.SP.getValue));
        this.PS.storeBit(StatusFlag.Z, +(this.ACC.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.ACC.getValue & 0x80));
        return 0;
    }

    /**
     * Pull processor status from stack
     */
    private PLP(): number {
        this.SP.incr();
        this.PS.setReg(this.bus.read(0x0100 + this.SP.getValue));
        this.SP.setBit(5);
        return 0;
    }

    /**
     * Rotate left
     */
    private ROL(): number {
        this.fetched = this.loadFromMemory();
        
        const temp = this.fetched << 1 | this.PS.getBit(StatusFlag.C);

        this.PS.storeBit(StatusFlag.C, this.fetched & 0x0001);
        this.PS.storeBit(StatusFlag.N, +Boolean(temp & 0x0080));
        this.PS.storeBit(StatusFlag.Z, +((temp & 0x00FF) === 0x0000));

        if (this.operations[this.opcode].addrMode === AddressingMode.IMM) {
            this.ACC.setReg(temp & 0x00FF);
        } else {
            this.bus.write(this.absAddress, temp & 0x00FF);
        }

        return 0;
    }

    /**
     * Rotate right
     */
    private ROR(): number {
        this.fetched = this.loadFromMemory();
        
        // const temp = this.fetched << 1 | this.PS.getBit(StatusFlag.C);
        const temp = (this.PS.getBit(StatusFlag.C) << 7) | (this.fetched >> 1);

        this.PS.storeBit(StatusFlag.C, this.fetched & 0x01);
        this.PS.storeBit(StatusFlag.N, +Boolean(temp & 0x0080));
        this.PS.storeBit(StatusFlag.Z, +((temp & 0x00FF) === 0x00));

        if (this.operations[this.opcode].addrMode === AddressingMode.IMM) {
            this.ACC.setReg(temp & 0x00FF);
        } else {
            this.bus.write(this.absAddress, temp & 0x00FF);
        }

        return 0;
    }

    /**
     * Return from interrupt
     */
    private RTI(): number {
        this.PS.setReg(this.readFromStack());
        this.PS.clearBit(StatusFlag.B);

        const low  = this.readFromStack();
        const high = this.readFromStack();

        this.PC.setReg((high << 8) | low);
        return 0;
    }

    /**
     * Return from subroutine
     */
    private RTS(): number {
        const low  = this.readFromStack();
        const high = this.readFromStack();

        this.PC.setReg((high << 8) | low);
        this.PC.incr();
        return 0;
    }

    /**
     * Subtract with carry
     */
    private SBC(): number {
        this.fetched = this.loadFromMemory();

        const val = this.fetched ^ 0x00FF;

        const temp = this.ACC.getValue + val + this.PS.getBit(StatusFlag.C);

        this.PS.storeBit(StatusFlag.C, +(temp > 255));
        this.PS.storeBit(StatusFlag.N, +Boolean(temp & 0x80));
        this.PS.storeBit(StatusFlag.Z, +((temp & 0x00FF) === 0));
        this.PS.storeBit(StatusFlag.V, ((this.ACC.getValue ^ this.fetched) & (this.ACC.getValue ^ temp) & 0x0080));

        this.ACC.setReg(temp & 0x00FF);
        return 1;
    }

    /**
     * Set carry
     */
    private SEC(): number {
        this.PS.setBit(StatusFlag.C);
        return 0;
    }

    /**
     * Set decimal
     */
    private SED(): number {
        this.PS.setBit(StatusFlag.D);
        return 0;
    }

    /**
     * Set interrupt disable
     */
    private SEI(): number {
        this.PS.setBit(StatusFlag.INT_D);
        return 0;
    }

    /**
     * Store accumulator
     */
    private STA(): number {
        this.bus.write(this.absAddress, this.ACC.getValue);
        return 0;
    }

    /**
     * Store X
     */
    private STX(): number {
        this.bus.write(this.absAddress, this.IRX.getValue);
        return 0;
    }
    
    /**
     * Store Y
     */
    private STY(): number {
        this.bus.write(this.absAddress, this.IRY.getValue);
        return 0;
    }

    /**
     * Transfer accumulator to X
     */
    private TAX(): number {
        this.IRX.setReg(this.ACC.getValue);
        this.PS.storeBit(StatusFlag.Z, +(this.IRX.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.IRX.getValue & 0x80)); // check if 8th bit is 1
        return 0;
    }

    /**
     * Transfer accumulator to Y
     */
    private TAY(): number {
        this.IRY.setReg(this.ACC.getValue);
        this.PS.storeBit(StatusFlag.Z, +(this.IRY.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.IRY.getValue & 0x80));
        return 0;
    }
    
    /**
     * Transfer stack pointer to X
     */
    private TSX(): number {
        this.IRX.setReg(this.SP.getValue);
        this.PS.storeBit(StatusFlag.Z, +(this.IRX.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.IRX.getValue & 0x80));
        return 0;
    }

    /**
     * Transfer X to accumulator
     */
    private TXA(): number {
        this.ACC.setReg(this.IRX.getValue);
        this.PS.storeBit(StatusFlag.Z, +(this.ACC.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.ACC.getValue & 0x80));
        return 0;
    }

    /**
     * Transfer X to stack pointer
     */
    private TXS(): number {
        this.SP.setReg(this.IRX.getValue);
        return 0;
    }

    /**
     * Transfer Y to accumulator
     */
    private TYA(): number {
        this.ACC.setReg(this.IRY.getValue);
        this.PS.storeBit(StatusFlag.Z, +(this.ACC.getValue === 0x00));
        this.PS.storeBit(StatusFlag.N, +Boolean(this.ACC.getValue & 0x80));
        return 0;
    }

    public static parseMemory(cpu: CPU, startAddr: number, endAddr: number): Map<number, string> {
        const ramParsed: Map<number, string> = new Map<number, string>();
        let address = startAddr;
        let 
            val = 0x00,
            low = 0x00,
            high = 0x00;

        let line = 0;

        while (address <= endAddr) {
            line = address;

            let instr = toHex(address, 4) + ": ";

            const opcode = cpu.bus.debugRead(address);
            address++;
            const op = cpu.operations[opcode];
            if (op == undefined) {
                console.log(op, opcode);
            }
            instr += op.name + " ";

            switch(op.addrMode) {
                case AddressingMode.IMP:
                    instr += " (IMP)";
                    break;
                case AddressingMode.IMM:
                    val = cpu.bus.debugRead(address);
                    address++;
                    instr += toHex(val, 2) + " (IMM)";
                    break;
                case AddressingMode.ZP:
                    low = cpu.bus.debugRead(address);
                    high = 0x00;
                    address++;
                    instr += toHex(low, 2) + " (ZP)";
                    break;
                case AddressingMode.ZPI_X:
                    low = cpu.bus.debugRead(address);
                    high = 0x00;
                    address++;
                    instr += toHex(low, 2) + " (ZPI X)";
                    break;
                case AddressingMode.ZPI_Y:
                    low = cpu.bus.debugRead(address);
                    high = 0x00;
                    address++;
                    instr += toHex(low, 2) + " (ZPI Y)";
                    break;
                case AddressingMode.INDX_IND_X:
                    low = cpu.bus.debugRead(address);
                    high = 0x00;
                    address++;
                    instr += toHex(low, 2) + " (INDX IND X)";
                    break;
                case AddressingMode.IND_INDX_Y:
                    low = cpu.bus.debugRead(address);
                    high = 0x00;
                    address++;
                    instr += toHex(low, 2) + " (IND INDX Y)";
                    break;
                case AddressingMode.ABS:
                    low = cpu.bus.debugRead(address);
                    address++;
                    high = cpu.bus.debugRead(address);
                    address++;
                    instr += toHex((high << 8) | low, 4) + " (ABS)";
                    break;
                case AddressingMode.ABSI_X:
                    low = cpu.bus.debugRead(address);
                    address++;
                    high = cpu.bus.debugRead(address);
                    address++;
                    instr += toHex((high << 8) | low, 4) + " X (ABS)";
                    break;
                case AddressingMode.ABSI_Y:
                    low = cpu.bus.debugRead(address);
                    address++;
                    high = cpu.bus.debugRead(address);
                    address++;
                    instr += toHex((high << 8) | low, 4) + " Y (ABS)";
                    break;
                case AddressingMode.IND:
                    low = cpu.bus.debugRead(address);
                    address++;
                    high = cpu.bus.debugRead(address);
                    address++;
                    instr += toHex((high << 8) | low, 4) + " (IND)";
                    break;
                case AddressingMode.REL:
                    val = cpu.bus.debugRead(address);
                    address++;
                    instr += `${toHex(val, 2)} [${toHex(address + val, 4)}] (REL)`;
                    break;
                }
            if (instr.includes("undefined")) {
                console.log("Text undef", instr, op, opcode);
            }
            ramParsed.set(line, instr);
        }

        return ramParsed;
    }
}