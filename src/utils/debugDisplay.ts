import Register from "../pus/register";
import CPU from "../pus/cpu";
import { toHex } from "./utils";
import PPU from "../pus/ppu";

export default class DebugDisplay {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private readonly ramOffsetX: number = 5;
    private readonly ramOffsetY: number = 100;

    private readonly cpuOffsetX: number = 5;
    private readonly cpuOffsetY: number = 20;  

    private readonly ppuOffsetX: number = 5;
    private readonly ppuOffsetY: number = 60;

    constructor(canvas: HTMLCanvasElement, w: number, h: number) {
        this.canvas = canvas;
        this.canvas.width = w;
        this.canvas.height = h;
        this.canvas.style.width  = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.ctx = this.canvas.getContext("2d");
        this.ctx.font = "12px Open Sans";
    }

    public drawCpuRegisters(cpu: CPU): void {
        const PC  = toHex(cpu.getPC, 4);
        const ACC = toHex(cpu.getACC, 2);
        const X   = toHex(cpu.getIRX, 2);
        const Y   = toHex(cpu.getIRY, 2);
        const PS  = cpu.getPS;
        const SP  = toHex(cpu.getSP, 2);

        this.ctx.fillStyle = "black";
        this.ctx.fillText(`PC: ${PC}`, this.cpuOffsetX * 1, this.cpuOffsetY);
        this.ctx.fillText(`A: ${ACC}`, this.cpuOffsetX + 50 * 2,  this.cpuOffsetY);
        this.ctx.fillText(`X: ${X}`,   this.cpuOffsetX + 50 * 3,  this.cpuOffsetY);
        this.ctx.fillText(`Y: ${Y}`,   this.cpuOffsetX + 50 * 4,  this.cpuOffsetY);
        this.ctx.fillText(`SP: ${SP}`, this.cpuOffsetX + 50 * 5,  this.cpuOffsetY);

        const drawPS = (ps: Register<Uint8Array>): void => {
            const psArr = [
                {f: "C", val: ps.getBit(0)},
                {f: "Z", val: ps.getBit(1)},
                {f: "I", val: ps.getBit(2)},
                {f: "D", val: ps.getBit(3)},
                {f: "B", val: ps.getBit(4)},
                {f: "-", val: 0},
                {f: "V", val: ps.getBit(6)},
                {f: "N", val: ps.getBit(7)},
            ];

            for (let i = 0; i < 8; i++) {
                this.ctx.fillStyle = psArr[i].val ? "red" : "black";

                this.ctx.fillText(psArr[i].f, this.cpuOffsetX + 10 * i, this.cpuOffsetY * 2);
            }
        }

        drawPS(PS);
    }

    public drawPPURegisters(ppu: PPU): void {
        const status = ppu.debugRead(0x2002);
        const ppudata = ppu.debugRead(0x2007);

        this.ctx.fillStyle = "black";
        this.ctx.fillText(`PPUSTATUS: ${toHex(status, 4)}`, this.ppuOffsetX, this.ppuOffsetY);
        this.ctx.fillText(`PPUSCROLL: ${toHex(ppudata, 4)}`, this.ppuOffsetX, this.ppuOffsetY + 10);
    }

    public drawRam(ram: Map<number, string>, index: number, range: number): void {
        const start = index - range;
        let end     = index + range;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = start, j = 1; i < end; i++, j++) {
            const item = ram.get(i);
            if (item === undefined) {
                j--;
                end++;
                continue;
            }
            this.ctx.fillStyle = "black";
            if (i === index) this.ctx.fillStyle = "red";
            this.ctx.fillText(`${toHex(i, 4)}: ${item}`, this.ramOffsetX, this.ramOffsetY + j * 10);
        }
    }
}