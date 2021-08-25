export default class Pad {
    private gamepad: Gamepad | null;

    private up: boolean;
    private down: boolean;
    private left: boolean;
    private right: boolean;

    private buttonA: boolean;
    private buttonB: boolean;

    constructor() {
        this.gamepad = null;
    }

    public connectPad(gamepad: Gamepad): void {
        this.gamepad = gamepad;
    }

    public get getButtonsState(): { up: boolean, down: boolean, left: boolean, right: boolean, A: boolean, B: boolean } {
        return { 
            up: this.up, 
            down: this.down, 
            left: this.left, 
            right: this.right, 
            A: this.buttonA, 
            B: this.buttonB 
        };
    }

    public updateButtonState(gamepad: Gamepad): void {
        this.gamepad = gamepad;
        if (this.gamepad) {
            this.buttonA = this.gamepad.buttons[1].pressed;
            this.buttonB = this.gamepad.buttons[0].pressed;

            this.down    = this.gamepad.buttons[13].pressed;
            this.up      = this.gamepad.buttons[12].pressed;
            this.left    = this.gamepad.buttons[14].pressed;
            this.right   = this.gamepad.buttons[15].pressed;
        }
    }
}