# NES emulator

This is just a little project, where I try to figure out
how NES hardware worked, just because I can. Or cannot. It depends.

This codebase is half written by me just reading the NESDEV wiki and other sources, 
half adapting a C++ project mentioned down below. This codebase also uses TypeScript,
which might seem like a great idea, until you realise that doesn't really improve on JavaScript's
inability to handle 8-bit and 16-bit variables in an elegant way.

**TODO**
- [x] Parsing iNES-style ROM
- [x] 6502 CPU
- [x] Mapper 000
- [x] Memory mapping
- [ ] Controller input
- [ ] PPU
- [ ] APU
- [x] Debug display
- [ ] Show debug info in separate windows


**Further ideas**
- Rewrite this emulator using AssemblyScript
- Rewrite this emulator NOT using a bloody browser

For more info on NES, I highly suggest to read the [NESDEV wiki](https://wiki.nesdev.com/w/index.php?title=Nesdev_Wiki), and
also check out this [video series](https://youtube.com/playlist?list=PLrOv9FMX8xJHqMvSGB_9G9nZZ_4IgteYf).

