export function toBinary(num: number, padding: number): string {
    // return ("00000000" + num.toString(2)).slice(-8);
    return "0b" + num.toString(2).padStart(padding, "0");
}

export function toHex(num: number, padding: number): string {
    return "0x" + num.toString(16).padStart(padding, "0").toUpperCase();
}

export function isInRange(val: number, start: number, end: number): boolean {
    return val >= start && val <= end;
}

export function fastRounding(val: number): number {
    return (val + (val > 0 ? 0.5 : -0.5)) << 0;
}