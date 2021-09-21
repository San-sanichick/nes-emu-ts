// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
import { readFileSync } from "original-fs";
import Bus from "./nes/bus";
import Pad from "./nes/pad";
import CPU from "./nes/pus/cpu";
// import Pad from "./pad";
import ROM from "./nes/rom/rom";
import DebugDisplay from "./utils/debugDisplay";
import Display from "./utils/display";
import { fastRounding } from "./utils/utils";

window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
    const fpsDisplay = document.querySelector(".fps") as HTMLParagraphElement;
    const debugCanvas = document.querySelector("#debug-display") as HTMLCanvasElement;
    const debugDisplay = new DebugDisplay(debugCanvas, 400, 500);

    const runBtn         = document.querySelector(".run-btn") as HTMLButtonElement;
    const pauseBtn       = document.querySelector(".pause-btn") as HTMLButtonElement;
    const singleStepBtn  = document.querySelector(".single-step-btn") as HTMLButtonElement;
    const singleCycleBtn = document.querySelector(".single-cycle-btn") as HTMLButtonElement;
    const resetBtn       = document.querySelector(".reset-btn") as HTMLButtonElement;
    
    const display = new Display(canvas, 1);
    const bus     = new Bus();
    const rom     = new ROM(readFileSync("./roms/nestest.nes"));
    const pad     = new Pad();
    bus.connectRom(rom);
    bus.connectDisplay(display);
    let run: boolean = false;
    const asm = CPU.parseMemory(bus.getCPU, 0x0000, 0xFFFF);
    bus.reset();
    
    const drawDebug = () => {
        debugDisplay.drawRam(asm, bus.getCPU.getPC, 10);
        debugDisplay.drawCpuRegisters(bus.getCPU);
        debugDisplay.drawPPURegisters(bus.ppu);
        debugDisplay.drawControllerInput(bus);
        debugDisplay.drawSprite(bus.ppu.getPatternTable(0, 0), 0, 320);
        debugDisplay.drawSprite(bus.ppu.getPatternTable(1, 0), 130, 320);
    }

    drawDebug();

    let 
        fpsInterval = 0,
        startTime   = 0,
        now         = 0,
        then        = 0,
        elapsed     = 0,
        frameCount  = 0;

    const startUpdate = (fps: number): void => {
        fpsInterval = 1000 / fps;
        then = performance.now();
        startTime = then;
        update();
    }

    const update = (): void => {
        if (run) {
            requestAnimationFrame(update);
        }

        now = performance.now();
        elapsed = now - then;

        if (elapsed > fpsInterval) {
            then = now - (elapsed % fpsInterval);

            pad.updateButtonState(navigator.getGamepads()[0]);
            bus.controller[0] = 0x00;
            bus.controller[0] |= pad.getButtonsState.A      ? 0x80 : 0x00;
            bus.controller[0] |= pad.getButtonsState.B      ? 0x40 : 0x00;
            bus.controller[0] |= pad.getButtonsState.select ? 0x20 : 0x00;
            bus.controller[0] |= pad.getButtonsState.start  ? 0x10 : 0x00;
            bus.controller[0] |= pad.getButtonsState.up     ? 0x08 : 0x00;
            bus.controller[0] |= pad.getButtonsState.down   ? 0x04 : 0x00;
            bus.controller[0] |= pad.getButtonsState.left   ? 0x02 : 0x00;
            bus.controller[0] |= pad.getButtonsState.right  ? 0x01 : 0x00;

            // complete the frame
            do {
                bus.clock();
            } while (!bus.ppu.frameComplete);
            bus.ppu.frameComplete = false;

            const sinceStart = now - startTime;
            const currentFPS = fastRounding(1000 / (sinceStart / ++frameCount) * 100) / 100;
            fpsDisplay.textContent = `${currentFPS} fps`;
            
            drawDebug();
        }
    }

    singleCycleBtn.addEventListener("click", () => {
        do {
            bus.clock();
        } while (!bus.getCPU.stepComplete);
        // bus.ppu.frameComplete = false;

        drawDebug();
    });

    runBtn.addEventListener("click", () => {
        run = true;
        singleStepBtn.disabled = true;
        startUpdate(60);
    });

    pauseBtn.addEventListener("click", () => {
        run = false;
        singleStepBtn.disabled = false;
        // cancelAnimationFrame(reqID);
    });

    singleStepBtn.addEventListener("click", () => {
        update();
    });

    resetBtn.addEventListener("click", () => {
        bus.reset();
        drawDebug();
    });

    // const padInfo = document.querySelector(".pad-info") as HTMLParagraphElement;
    // const pad = new Pad();

    // function update() {
    //     // this is possibly the stupidest thing I've ever seen
    //     // why in the bloody fuck would I need to get
    //     // a new instance of the SAME. FUCKING. OBJECT.
    //     // EVERY. TIME. I. WANT. TO. GET. INFO. OUT. OF. IT.
    //     pad.updateButtonState(navigator.getGamepads()[0]);
        
    //     const text = `up: ${pad.getButtonsState.up}\r
    //     down: ${pad.getButtonsState.down}\r
    //     left: ${pad.getButtonsState.left}\r
    //     right: ${pad.getButtonsState.right}\r
    //     A: ${pad.getButtonsState.A}\r
    //     B: ${pad.getButtonsState.B}
    //     `;

    //     padInfo.textContent = text;

    //     requestAnimationFrame(update);
    // }

    // window.addEventListener("gamepadconnected", () => {
    //     pad.connectPad(navigator.getGamepads()[0]);
    //     update();
    // })
});