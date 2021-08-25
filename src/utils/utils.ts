export function to8bitBinary(num: number): string {
    return ("00000000" + num.toString(2)).slice(-8);
}

export function isInRange(val: number, start: number, end: number): boolean {
    return val >= start && val <= end;
}