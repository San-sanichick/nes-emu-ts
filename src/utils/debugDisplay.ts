import Register from "../pus/register";
import CPU from "../pus/cpu";
import { toHex } from "./utils";
import PPU from "../pus/ppu";
import { Sprite } from "./display";
import Bus from "../bus";

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

            this.ctx.fillText("Flags: ", this.cpuOffsetX, this.cpuOffsetY * 2);
            for (let i = 0; i < 8; i++) {
                this.ctx.fillStyle = psArr[i].val ? "red" : "black";

                this.ctx.fillText(psArr[i].f, this.cpuOffsetX + 40 + 10 * i, this.cpuOffsetY * 2);
            }
        }

        drawPS(PS);
    }

    public drawPPURegisters(ppu: PPU): void {
        const ctrl    = ppu.debugRead(0x2000 & 0x0007);
        const status  = ppu.debugRead(0x2002 & 0x0007);
        const scroll  = ppu.debugRead(0x2005 & 0x0007);
        const addr    = ppu.debugRead(0x2006 & 0x0007);
        const ppudata = ppu.debugRead(0x2007 & 0x0007);

        this.ctx.fillStyle = "black";
        this.ctx.fillText(`PPUSTATUS: ${toHex(status, 2)}`,  this.ppuOffsetX,       this.ppuOffsetY);
        this.ctx.fillText(`PPUSCROLL: ${toHex(scroll, 2)}`,  this.ppuOffsetX,       this.ppuOffsetY + 10);
        this.ctx.fillText(`PPUCTRL:   ${toHex(ctrl, 2)}`,    this.ppuOffsetX + 120, this.ppuOffsetY);
        this.ctx.fillText(`PPUDATA:   ${toHex(ppudata, 2)}`, this.ppuOffsetX + 120, this.ppuOffsetY + 10);
        this.ctx.fillText(`PPUADDR:   ${toHex(addr, 2)}`,    this.ppuOffsetX + 240, this.ppuOffsetY);

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
            this.ctx.fillText(item, this.ramOffsetX, this.ramOffsetY + j * 10);
        }
    }

    public drawControllerInput(bus: Bus): void {
        const controller = bus.controller;
        const controllerState = bus.getControllerState;
        const actualRead = bus.debugRead(0x4016);

        this.ctx.fillStyle = "black";
        this.ctx.fillText(`controller 1: ${toHex(controller[0], 2)}`, 5, 90);
        this.ctx.fillText(`controller state: ${toHex(controllerState[0], 2)}`, 105, 90);
        this.ctx.fillText(`actual input: ${toHex(actualRead, 2)}`, 250, 90)
    }

    public drawSprite(spr: Sprite, x: number, y: number): void {
        this.ctx.putImageData(spr.getSprite(), x, y);
    }
}