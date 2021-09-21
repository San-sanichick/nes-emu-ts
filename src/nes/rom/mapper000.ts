import Mapper from "./mapper";
import { isInRange } from "../../utils/utils";

export default class Mapper000 extends Mapper {

    constructor(PRGROMsize: number, CHRROMSize: number) {
        super(PRGROMsize, CHRROMSize)
    }

    public cpuMapRead(address: number): number | null {
        if (isInRange(address, 0x8000, 0xFFFF)) {
            return address & (this.PRGROMsize > 1 ? 0x7FFF : 0x3FFF);
        } else {
            return null;
        }
    }

    public cpuMapWrite(address: number): number | null {
        if (isInRange(address, 0x8000, 0xFFFF)) {
            return address & (this.PRGROMsize > 1 ? 0x7FFF : 0x3FFF);
        } else {
            return null;
        }
    }

    public ppuMapRead(address: number): number | null {
        if (isInRange(address, 0x0000, 0x1FFF)) {
            return address;
        } else {
            return null;
        }
    }
    public ppuMapWrite(address: number): number | null {
        if (isInRange(address, 0x0000, 0x1FFF)) {
            if (this.CHRROMsize === 0) {
                return address;
            }
        } else {
            return null;
        }
    }
}