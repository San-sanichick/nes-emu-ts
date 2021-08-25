export default abstract class Mapper {
    protected PRGROMsize: number = 0;
    protected CHRROMsize: number = 0;

    constructor(PRGROMsize: number, CHRROMSize: number) {
        this.PRGROMsize = PRGROMsize;
        this.CHRROMsize = CHRROMSize;
    }

    public abstract cpuMapRead(address: number): number | null;
    public abstract cpuMapWrite(address: number): number | null;

    public abstract ppuMapRead(address: number): number | null;
    public abstract ppuMapWrite(address: number): number | null;
}