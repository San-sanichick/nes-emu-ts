export class Pixel {
    public R: number;
    public G: number;
    public B: number;

    constructor(R: number, G: number, B: number) {
        this.R = R;
        this.G = G;
        this.B = B;
    }
}

export default class Display {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private readonly width: number = 256;
    private readonly height: number = 240;

    private frameBuffer: Uint8ClampedArray;
    private imageData: ImageData;
    
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d");

        this.imageData = this.ctx.createImageData(this.width, this.height);
        this.frameBuffer = this.imageData.data;
        
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    public drawPixel(x: number, y: number, color: Pixel): void {
        const index = y * this.width + x;
        this.frameBuffer[index]     = color.R;
        this.frameBuffer[index + 1] = color.G;
        this.frameBuffer[index + 2] = color.B;
        this.frameBuffer[index + 3] = 255;
    }

    public update(): void {
        this.ctx.putImageData(this.imageData, 0, 0);
    }
}