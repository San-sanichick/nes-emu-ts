// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
import { readFileSync } from "original-fs";
import Bus from "./bus";
import Register from "./pus/register";
// import Pad from "./pad";
import ROM from "./rom/rom";
import Display from "./utils/display";
import { fastRounding } from "./utils/utils";

window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.querySelector("#canvas") as HTMLCanvasElement;
    const fpsDisplay = document.querySelector(".fps") as HTMLParagraphElement;

    const runBtn        = document.querySelector(".run-btn") as HTMLButtonElement;
    const pauseBtn      = document.querySelector(".pause-btn") as HTMLButtonElement;
    const singleStepBtn = document.querySelector(".single-step-btn") as HTMLButtonElement;
    
    const display = new Display(canvas);
    const bus     = new Bus();
    const rom     = new ROM(readFileSync("./roms/dk.nes"));
    bus.connectRom(rom);
    bus.connectDisplay(display);
    let run: boolean = false;

    bus.reset();

    // let reqID: number = 0;

    const update = (): void => {
        const t = performance.now();
        // complete the frame
        do {
            bus.clock();
        } while (!bus.ppu.frameComplete);

        const tComplete = performance.now() - t;
        fpsDisplay.textContent = `${(1000 / fastRounding(tComplete)).toFixed(0)} fps`;

        bus.ppu.frameComplete = false;
        if (run) {
            requestAnimationFrame(update);
        }
    }

    runBtn.addEventListener("click", () => {
        run = true;
        singleStepBtn.disabled = true;
        update();
    });

    pauseBtn.addEventListener("click", () => {
        run = false;
        singleStepBtn.disabled = false;
        // cancelAnimationFrame(reqID);
    });

    singleStepBtn.addEventListener("click", () => {
        update();
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