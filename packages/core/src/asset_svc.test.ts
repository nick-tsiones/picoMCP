import { describe, expect, it } from "vite-plus/test";
import { getSfx, setSfx, parseSfxLine, serializeSfxLine, listSfx, type Sfx } from "./index.js";

describe("sfx serialization", () => {
  it("round-trip: setSfx with known notes → getSfx → verify notes match", () => {
    const sfxArr: unknown[] = [];
    const sfx: Sfx = {
      speed: 8,
      loopStart: 1,
      loopEnd: 2,
      notes: [
        { pitch: 36, instr: 7, vol: 3, fx: 0 },
        { pitch: 24, instr: 3, vol: 5, fx: 1 },
        { pitch: 12, instr: 0, vol: 7, fx: 2 },
      ],
    };

    setSfx(sfxArr, 0, sfx);
    const result = getSfx(sfxArr, 0);

    expect(result.speed).toBe(8);
    expect(result.loopStart).toBe(1);
    expect(result.loopEnd).toBe(2);
    expect(result.notes.length).toBeGreaterThanOrEqual(3);
    expect(result.notes[0]).toEqual({ pitch: 36, instr: 7, vol: 3, fx: 0 });
    expect(result.notes[1]).toEqual({ pitch: 24, instr: 3, vol: 5, fx: 1 });
    expect(result.notes[2]).toEqual({ pitch: 12, instr: 0, vol: 7, fx: 2 });
  });

  it("serialization format: output is exactly 168 chars and matches expected hex pattern", () => {
    const sfx: Sfx = {
      speed: 8,
      loopStart: 1,
      loopEnd: 2,
      notes: [{ pitch: 36, instr: 7, vol: 3, fx: 0 }],
    };

    const line = serializeSfxLine(sfx);

    expect(line.length).toBe(168);

    // Header: editor mode(00) + speed(08) + loopStart(01) + loopEnd(02)
    expect(line.slice(0, 8)).toBe("00080102");

    // First note: pitch=36=0x24, instr=7, vol=3, fx=0 → "24730"
    expect(line.slice(8, 13)).toBe("24730");

    // Remaining 31 notes should be zeros
    const rest = line.slice(13);
    expect(rest).toBe("0".repeat(31 * 5));
  });

  it("serializeSfxLine always produces exactly 168 chars", () => {
    const sfx: Sfx = {
      speed: 255,
      loopStart: 31,
      loopEnd: 31,
      notes: [],
    };

    const line = serializeSfxLine(sfx);
    expect(line.length).toBe(168);
  });

  it("parse round-trip: parseSfxLine(serializeSfxLine(sfx)) → verify identical sfx data", () => {
    const sfx: Sfx = {
      speed: 16,
      loopStart: 4,
      loopEnd: 12,
      notes: [
        { pitch: 51, instr: 2, vol: 6, fx: 0 },
        { pitch: 0, instr: 1, vol: 0, fx: 0 },
        { pitch: 63, instr: 15, vol: 7, fx: 7 },
      ],
    };

    const serialized = serializeSfxLine(sfx);
    const parsed = parseSfxLine(serialized);

    expect(parsed.speed).toBe(sfx.speed);
    expect(parsed.loopStart).toBe(sfx.loopStart);
    expect(parsed.loopEnd).toBe(sfx.loopEnd);
    expect(parsed.notes.length).toBeGreaterThanOrEqual(3);
    expect(parsed.notes[0]).toEqual(sfx.notes[0]);
    expect(parsed.notes[1]).toEqual(sfx.notes[1]);
    expect(parsed.notes[2]).toEqual(sfx.notes[2]);
  });

  it("all 8 waveforms (0-7) survive a round-trip", () => {
    const sfxArr: unknown[] = [];

    for (let w = 0; w < 8; w++) {
      const sfx: Sfx = {
        speed: 8,
        loopStart: 0,
        loopEnd: 0,
        notes: [{ pitch: 40, instr: w, vol: 4, fx: 1 }],
      };
      setSfx(sfxArr, w, sfx);
    }

    for (let w = 0; w < 8; w++) {
      const result = getSfx(sfxArr, w);
      expect(result.notes[0]?.instr).toBe(w);
    }
  });

  it("allows instr values 8-15 (custom instruments) in round-trip", () => {
    const sfxArr: unknown[] = [];

    for (let inst = 8; inst <= 15; inst++) {
      const sfx: Sfx = {
        speed: 8,
        loopStart: 0,
        loopEnd: 0,
        notes: [{ pitch: 40, instr: inst, vol: 4, fx: 1 }],
      };
      setSfx(sfxArr, inst, sfx);
    }

    for (let inst = 8; inst <= 15; inst++) {
      const result = getSfx(sfxArr, inst);
      expect(result.notes[0]?.instr).toBe(inst);
    }
  });

  it("getSfx returns empty sfx for null/empty entries", () => {
    const sfxArr: unknown[] = [null, "", undefined];
    expect(getSfx(sfxArr, 0)).toEqual({ notes: [], speed: 0, loopStart: 0, loopEnd: 0 });
    expect(getSfx(sfxArr, 1)).toEqual({ notes: [], speed: 0, loopStart: 0, loopEnd: 0 });
    expect(getSfx(sfxArr, 2)).toEqual({ notes: [], speed: 0, loopStart: 0, loopEnd: 0 });
  });

  it("getSfx throws for out-of-range index", () => {
    expect(() => getSfx([], 64)).toThrow("SFX index must be 0-63");
  });

  it("listSfx counts non-zero notes correctly", () => {
    const sfxArr: unknown[] = [];
    setSfx(sfxArr, 0, {
      speed: 0,
      loopStart: 0,
      loopEnd: 0,
      notes: [
        { pitch: 1, instr: 0, vol: 0, fx: 0 },
        { pitch: 2, instr: 0, vol: 0, fx: 0 },
        { pitch: 3, instr: 0, vol: 0, fx: 0 },
      ],
    });
    setSfx(sfxArr, 1, { speed: 0, loopStart: 0, loopEnd: 0, notes: [] });

    const list = listSfx(sfxArr);
    expect(list[0]?.noteCount).toBe(3);
    expect(list[1]?.noteCount).toBe(0);
  });

  it("pitch 0-63 range survives round-trip", () => {
    const sfxArr: unknown[] = [];

    for (let p = 0; p <= 63; p++) {
      setSfx(sfxArr, p, {
        speed: 0,
        loopStart: 0,
        loopEnd: 0,
        notes: [{ pitch: p, instr: 5, vol: 3, fx: 0 }],
      });
    }

    for (let p = 0; p <= 63; p++) {
      const result = getSfx(sfxArr, p);
      expect(result.notes[0]?.pitch).toBe(p);
    }
  });

  it("volume 0-7 range survives round-trip", () => {
    const sfxArr: unknown[] = [];

    for (let v = 0; v <= 7; v++) {
      setSfx(sfxArr, v, {
        speed: 0,
        loopStart: 0,
        loopEnd: 0,
        notes: [{ pitch: 40, instr: 0, vol: v, fx: 0 }],
      });
    }

    for (let v = 0; v <= 7; v++) {
      const result = getSfx(sfxArr, v);
      expect(result.notes[0]?.vol).toBe(v);
    }
  });

  it("effect 0-7 range survives round-trip", () => {
    const sfxArr: unknown[] = [];

    for (let f = 0; f <= 7; f++) {
      setSfx(sfxArr, f, {
        speed: 0,
        loopStart: 0,
        loopEnd: 0,
        notes: [{ pitch: 40, instr: 0, vol: 0, fx: f }],
      });
    }

    for (let f = 0; f <= 7; f++) {
      const result = getSfx(sfxArr, f);
      expect(result.notes[0]?.fx).toBe(f);
    }
  });

  it("sfx index range 0-63 is enforced", () => {
    const sfxArr: unknown[] = [];
    const sfx: Sfx = { speed: 0, loopStart: 0, loopEnd: 0, notes: [] };
    expect(() => setSfx(sfxArr, -1, sfx)).toThrow();
    expect(() => setSfx(sfxArr, 64, sfx)).toThrow();
    expect(() => getSfx(sfxArr, -1)).toThrow();
    expect(() => getSfx(sfxArr, 64)).toThrow();
  });
});
