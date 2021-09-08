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

export class Sprite {
    private imgData: ImageData;

    constructor (w: number, h: number) {
        this.imgData = new ImageData(w, h);
    }

    public setPixel(x: number, y: number, color: Pixel): void {
        // if (x > this.imgData.width) return;
        // if (y > this.imgData.height) return;

        // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
        const index = y * (this.imgData.width * 4) + x * 4;
        this.imgData.data[index + 0] = color.R;
        this.imgData.data[index + 1] = color.G;
        this.imgData.data[index + 2] = color.B;
        this.imgData.data[index + 3] = 255;
    }

    public getPixel(x: number, y: number): Pixel {
        const index = y * (this.imgData.width * 4) + x * 4;
        return new Pixel(
            this.imgData.data[index + 0],
            this.imgData.data[index + 1],
            this.imgData.data[index + 2],
        );
    }

    public getSprite(): ImageData {
        return this.imgData;
    }
}

export default class Display {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private width: number = 256;
    private height: number = 240;
    private scale: number = 1;

    // private frameBuffer: Uint32Array;
    private imageData: ImageData;
    
    constructor(canvas: HTMLCanvasElement, scale: number) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d", { alpha: false });

        this.imageData = this.ctx.createImageData(this.width, this.height);
        this.scale = scale;
        this.width *= this.scale;
        this.height *= this.scale;
        // this.frameBuffer = new Uint32Array(this.imageData.data.buffer);
        
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
    }

    public drawPixel(x: number, y: number, color: Pixel): void {
        // if (x > this.width - 1 || y > this.height - 1) return;
        const index = y * (this.width * 4) + x * 4;
        this.imageData.data[index + 0] = color.R;
        this.imageData.data[index + 1] = color.G;
        this.imageData.data[index + 2] = color.B;
        this.imageData.data[index + 3] = 255;
    }

    public update(): void {
        this.ctx.clearRect(0, 0, this.width, this.height);
        // const frame = Display.resizeImageData(this.imageData, 1);
        this.ctx.putImageData(this.imageData, 0, 0);
    }

    public updateFrom(spr: Sprite): void {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.putImageData(spr.getSprite(), 0, 0);
    }

    public static resizeImageData(imageData: ImageData, scale: number): ImageData{
        const canvas = document.createElement("canvas") as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");

        const scaled = ctx.createImageData(imageData.width * scale, imageData.height * scale);
        const subLine = ctx.createImageData(scale, 1).data
        for (let row = 0; row < imageData.height; row++) {
            for (let col = 0; col < imageData.width; col++) {
                const sourcePixel = imageData.data.subarray(
                    (row * imageData.width + col) * 4,
                    (row * imageData.width + col) * 4 + 4
                );
                for (let x = 0; x < scale; x++) subLine.set(sourcePixel, x*4)
                for (let y = 0; y < scale; y++) {
                    const destRow = row * scale + y;
                    const destCol = col * scale;
                    scaled.data.set(subLine, (destRow * scaled.width + destCol) * 4)
                }
            }
        }

        return scaled;
    } 
}