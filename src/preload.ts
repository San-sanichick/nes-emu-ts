// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
import Pad from "./pad";

// const romData = readFileSync("./roms/Super Mario Bros. (World).nes");
// const romData = readFileSync("./roms/nestest.nes");

// const rom = new ROM(romData);
// console.log(rom.getRomHeader)

window.addEventListener("DOMContentLoaded", () => {
    const padInfo = document.querySelector(".pad-info") as HTMLParagraphElement;
    const pad = new Pad();

    function update() {
        // this is possibly the stupidest thing I've ever seen
        // why in the bloody fuck would I need to get
        // a new instance of the SAME. FUCKING. OBJECT.
        // EVERY. TIME. I. WANT. TO. GET. INFO. OUT. OF. IT.
        pad.updateButtonState(navigator.getGamepads()[0]);
        
        const text = `up: ${pad.getButtonsState.up}\r
        down: ${pad.getButtonsState.down}\r
        left: ${pad.getButtonsState.left}\r
        right: ${pad.getButtonsState.right}\r
        A: ${pad.getButtonsState.A}\r
        B: ${pad.getButtonsState.B}
        `;

        padInfo.textContent = text;

        requestAnimationFrame(update);
    }

    window.addEventListener("gamepadconnected", () => {
        pad.connectPad(navigator.getGamepads()[0]);
        update();
    })
});