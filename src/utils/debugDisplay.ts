import { toHex } from "./utils";

export default class DebugDisplay {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement, w: number, h: number) {
        this.canvas = canvas;
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx = this.canvas.getContext("2d");
        this.ctx.font = "10px Open Sans";
    }

    public drawRam(ram: Map<number, string>, index: number, range: number): void {
        const
            start = index - range,
            end   = index + range;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = start, j = 1; i < end; i++, j++) {
            const item = ram.get(i);
            if (item === undefined) {
                j--;
                continue;
            }
            this.ctx.fillStyle = "black";
            if (i === index) this.ctx.fillStyle = "red";
            this.ctx.fillText(`${toHex(i, 4)}: ${item}`, 10, j * 10);
        }
    }
}