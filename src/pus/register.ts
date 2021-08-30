type TypedArray = Uint8Array | Uint16Array;

export default class Register<T extends TypedArray> {
    private data: T;

    constructor(private type: new (val: number) => T) {
        this.data = new type(1);
    }

    get getRegister(): T {
        return this.data;
    }

    get getValue(): number {
        return this.data[0];
    }

    /**
     * Width of register in bits
     */
    public get width(): number {
        return this.data.byteLength * 8;
    }

    public getBit(pos: number): number {
        return (this.data[0] >> pos) & 1;
    }

    // Hello? Microsoft? I hear that this can easily be automated
    // in the compiler
    public getBits(pos: number, width: number): number;
    public getBits(pos: { pos: number, width: number}): number;
    public getBits(pos: number | { pos: number, width: number }, width?: number): number {
        if (typeof pos === "number" && width !== undefined) {
            return (this.data[0] >> pos) & ((1 << width) - 1);
        } else if (typeof pos !== "number" && width === undefined) {
            return (this.data[0] >> pos.pos) & ((1 << pos.width) - 1);
        }
    }

    /**
     * Sets the bit at position to 1
     * @param pos position of the bit to set
     */
    public setBit(pos: number): void {
        const mask = 1 << pos;
        this.data[0] |= mask;
    }

    /**
     * Clears the bit at position (sets to 0)
     * @param pos position of the bit to clear
     */
    public clearBit(pos: number): void {
        const mask = 1 << pos;
        this.data[0] &= ~mask;
    }

    
    public storeBit(pos: number, val: number): void {
        const mask = ~(1 << pos);
        this.data[0] &= mask;
        val <<= pos;
        this.data[0] |= val;
    }

    public storeBits(val: number, pos: number, width: number): void;
    public storeBits(val: number, pos: {pos: number, width: number}): void;
    public storeBits(val: number, pos?: number | {pos: number, width: number}, width?: number): void {
        if (typeof pos === "number" && width !== undefined) {
            const mask = (1 << width) - 1;
            val &= mask;
            this.data[0] &= (~(mask << width) | (val << width));
        } else if (typeof pos !== "number" && width === undefined) {
            const mask = (1 << pos.width) - 1;
            val &= mask;
            this.data[0] &= (~(mask << pos.width) | (val << pos.width));
        }
    }

    public setReg(newVal: number): void {
        this.data[0] = newVal;
    }

    public incr(): void {
        this.data[0]++;
    }

    public decr(): void {
        this.data[0]--;
    }

    public shiftLeft(): void {
        this.data[0] <<= 1;
    }

    public add(val: number): void {
        this.data[0] += val;
    }

    public sub(val: number): void {
        this.data[0] -= val;
    }
}