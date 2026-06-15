import { describe, it, expect } from "vitest";
import {
  buildSetTargetPower,
  buildRequestControl,
  buildStartOrResume,
  buildStopOrPause,
  parseControlResponse,
  parseIndoorBikeData,
} from "@/integrations/trainer/ftms";

describe("FTMS Befehle", () => {
  it("kodiert Set Target Power als [0x05, lo, hi] little-endian", () => {
    expect(Array.from(buildSetTargetPower(250))).toEqual([0x05, 250, 0]);
    expect(Array.from(buildSetTargetPower(300))).toEqual([0x05, 0x2c, 0x01]); // 300 = 0x012C
  });

  it("rundet und begrenzt Watt auf >= 0", () => {
    expect(Array.from(buildSetTargetPower(199.6))).toEqual([0x05, 200, 0]);
    expect(Array.from(buildSetTargetPower(-50))).toEqual([0x05, 0, 0]);
  });

  it("baut Request Control / Start / Stop / Pause", () => {
    expect(Array.from(buildRequestControl())).toEqual([0x00]);
    expect(Array.from(buildStartOrResume())).toEqual([0x07]);
    expect(Array.from(buildStopOrPause(false))).toEqual([0x08, 0x01]);
    expect(Array.from(buildStopOrPause(true))).toEqual([0x08, 0x02]);
  });

  it("parst eine erfolgreiche Control-Antwort", () => {
    const res = parseControlResponse(new Uint8Array([0x80, 0x05, 0x01]));
    expect(res.isResponse).toBe(true);
    expect(res.requestOpCode).toBe(0x05);
    expect(res.success).toBe(true);
  });

  it("erkennt eine fehlgeschlagene Control-Antwort", () => {
    const res = parseControlResponse(new Uint8Array([0x80, 0x05, 0x04]));
    expect(res.success).toBe(false);
  });
});

describe("Indoor Bike Data Parsing", () => {
  function packet(flags: number, bytes: number[]): DataView {
    const buf = new Uint8Array(2 + bytes.length);
    buf[0] = flags & 0xff;
    buf[1] = (flags >> 8) & 0xff;
    buf.set(bytes, 2);
    return new DataView(buf.buffer);
  }

  it("liest Instantaneous Speed (More-Data-Bit = 0)", () => {
    // flags=0 -> speed present. 30.00 km/h = 3000 = 0x0BB8
    const data = parseIndoorBikeData(packet(0x0000, [0xb8, 0x0b]));
    expect(data.instantaneousSpeedKmh).toBeCloseTo(30);
  });

  it("liest Cadence und Power anhand der Flags", () => {
    // Bit0=1 (keine Speed), Bit2 cadence, Bit6 power
    const flags = (1 << 0) | (1 << 2) | (1 << 6);
    // cadence 90 rpm -> 180 (1/2 rpm) = 0x00B4 ; power 250 W = 0x00FA
    const data = parseIndoorBikeData(
      packet(flags, [0xb4, 0x00, 0xfa, 0x00]),
    );
    expect(data.instantaneousSpeedKmh).toBeUndefined();
    expect(data.instantaneousCadenceRpm).toBe(90);
    expect(data.instantaneousPowerW).toBe(250);
  });

  it("liest Power und Heart Rate zusammen", () => {
    // Bit0=1, Bit6 power, Bit9 heart rate
    const flags = (1 << 0) | (1 << 6) | (1 << 9);
    const data = parseIndoorBikeData(packet(flags, [0x2c, 0x01, 0x91])); // 300 W, 145 bpm
    expect(data.instantaneousPowerW).toBe(300);
    expect(data.heartRateBpm).toBe(145);
  });
});
