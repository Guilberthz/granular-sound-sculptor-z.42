import { describe, it, expect } from "vitest";
import { formatTime, makeDistortionCurve, audioBufferToWavBlob } from "./utils";

describe("formatTime", () => {
  it("renders zero", () => {
    expect(formatTime(0)).toBe("00:00");
  });

  it("pads minutes and seconds", () => {
    expect(formatTime(65.9)).toBe("01:05");
    expect(formatTime(0.9)).toBe("00:00");
  });

  it("handles minutes beyond a single integer", () => {
    expect(formatTime(300)).toBe("05:00");
  });
});

describe("makeDistortionCurve", () => {
  it("produces a symmetric-ish curve of the expected size", () => {
    const curve = makeDistortionCurve(50);
    expect(curve).toBeInstanceOf(Float32Array);
    expect(curve!.length).toBe(44100);
    expect(curve![0]).toBeCloseTo(-1, 4);
    expect(curve![curve!.length - 1]).toBeCloseTo(1, 4);
  });

  it("returns null for negligible drive", () => {
    expect(makeDistortionCurve(0)).toBeNull();
  });
});

describe("audioBufferToWavBlob", () => {
  it("produces a WAV blob with a RIFF header", async () => {
    const ch = (n: number) => {
      const f = new Float32Array(2);
      f[0] = 0.5;
      f[1] = -0.5;
      void n;
      return f;
    };
    const buffer = {
      numberOfChannels: 2,
      sampleRate: 44100,
      getChannelData: () => ch(0),
    } as unknown as AudioBuffer;

    const blob = audioBufferToWavBlob(buffer);
    expect(blob.type).toBe("audio/wav");
    const view = new DataView(await blob.arrayBuffer());
    const chunk = (off: number) =>
      String.fromCharCode(view.getUint8(off), view.getUint8(off + 1), view.getUint8(off + 2), view.getUint8(off + 3));
    expect(chunk(0)).toBe("RIFF");
    expect(chunk(8)).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(2); // channels
    expect(view.getUint32(24, true)).toBe(44100); // sample rate
  });
});