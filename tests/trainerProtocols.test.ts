import { describe, it, expect, vi, afterEach } from "vitest";
import { parseCyclingPower, cadenceFromCrank } from "@/integrations/trainer/cps";
import {
  buildFecTargetPower,
  buildFecFrame,
  parseFecFrame,
  fecChecksum,
  FEC_SERVICE,
  FEC_NOTIFY,
  FEC_WRITE,
} from "@/integrations/trainer/fec";
import { buildWahooSetErg, buildWahooUnlock } from "@/integrations/trainer/wahooLegacy";
import { parseSupportedPowerRange, FTMS_SERVICE, FTMS_CONTROL_POINT } from "@/integrations/trainer/ftms";
import { CPS_SERVICE, CPS_MEASUREMENT } from "@/integrations/trainer/cps";
import { KickrTrainer } from "@/integrations/trainer/kickrClient";

describe("Cycling Power", () => {
  it("parst Leistung und Kurbeldaten", () => {
    // flags: crank revolution data (bit 5) = 0x0020; Leistung 250 W; revs 10; time 2048
    const b = new Uint8Array([0x20, 0x00, 250, 0, 10, 0, 0x00, 0x08]);
    expect(parseCyclingPower(b)).toEqual({
      instantaneousPowerW: 250,
      crankRevolutions: 10,
      lastCrankEventTime: 2048,
    });
  });
  it("Trittfrequenz rollover-sicher", () => {
    // 2 Umdrehungen in 1 s (1024 ticks) = 120 rpm; Zähler laufen über
    expect(cadenceFromCrank({ revs: 0xffff, time: 0xfc00 }, { revs: 1, time: 0 })).toBe(
      Math.round((2 / (1024 / 1024)) * 60),
    );
    expect(cadenceFromCrank(null, { revs: 1, time: 1 })).toBeNull();
    expect(cadenceFromCrank({ revs: 5, time: 100 }, { revs: 5, time: 100 })).toBeNull();
  });
});

describe("FE-C", () => {
  it("baut Target-Power-Frame (0,25 W) mit XOR-Checksumme", () => {
    const f = buildFecTargetPower(200);
    expect(f.length).toBe(13);
    expect(Array.from(f.slice(0, 5))).toEqual([0xa4, 9, 0x4f, 5, 0x31]);
    expect(f[10] | (f[11] << 8)).toBe(800);
    expect(f[12]).toBe(fecChecksum(f, 12));
  });
  it("parst Data Page 0x19 und verwirft falsche Checksumme/andere Seiten", () => {
    const f = buildFecFrame([0x19, 1, 90, 0, 0, 0x2c, 0x01, 0x00]); // 0x12c = 300 W
    expect(parseFecFrame(f)).toEqual({ cadenceRpm: 90, powerW: 300 });
    const bad = f.slice();
    bad[12] ^= 0xff;
    expect(parseFecFrame(bad)).toBeNull();
    expect(parseFecFrame(buildFecFrame([0x10, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });
});

describe("Wahoo-Legacy / Power Range", () => {
  it("kodiert Unlock und ERG", () => {
    expect(Array.from(buildWahooUnlock())).toEqual([0x20, 0xee, 0xfc]);
    expect(Array.from(buildWahooSetErg(300))).toEqual([0x42, 0x2c, 0x01]);
  });
  it("parst Supported Power Range", () => {
    expect(parseSupportedPowerRange(new Uint8Array([0, 0, 0xe8, 0x03, 1, 0]))).toEqual({
      minW: 0,
      maxW: 1000,
      stepW: 1,
    });
    expect(parseSupportedPowerRange(new Uint8Array([0, 0]))).toBeNull();
  });
});

// ---- Fake GATT ----
function fakeChar(writes: Uint8Array[] = []) {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  const c = {
    value: undefined as DataView | undefined,
    startNotifications: vi.fn(async () => c),
    stopNotifications: vi.fn(async () => c),
    addEventListener: (t: string, f: (e: unknown) => void) => (listeners[t] ??= []).push(f),
    removeEventListener: vi.fn(),
    writeValueWithResponse: vi.fn(async (v: Uint8Array) => void writes.push(new Uint8Array(v))),
    readValue: vi.fn(async () => new DataView(new Uint8Array([0, 0, 0xe8, 0x03, 1, 0]).buffer)),
  };
  return c;
}

function installBluetooth(services: Record<string | number, Record<string | number, ReturnType<typeof fakeChar>>>) {
  const device = {
    name: "Test Trainer",
    addEventListener: vi.fn(),
    gatt: {
      connected: true,
      connect: async function () {
        return this;
      },
      disconnect: vi.fn(),
      getPrimaryService: async (uuid: string | number) => {
        const chars = services[uuid];
        if (!chars) throw new Error("no service");
        return {
          getCharacteristic: async (cu: string | number) => {
            if (!chars[cu]) throw new Error("no char");
            return chars[cu];
          },
        };
      },
    },
  };
  const requestDevice = vi.fn(async () => device);
  Object.defineProperty(globalThis, "navigator", {
    value: { bluetooth: { requestDevice } },
    configurable: true,
  });
  return requestDevice;
}

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", { value: undefined, configurable: true });
});

describe("KickrTrainer Protokollerkennung", () => {
  it("nutzt FTMS zuerst und sendet ERG-Ziel (geklemmt, serialisiert)", async () => {
    const writes: Uint8Array[] = [];
    const cp = fakeChar(writes);
    const req = installBluetooth({
      [FTMS_SERVICE]: { [FTMS_CONTROL_POINT]: cp, 0x2ad2: fakeChar(), 0x2ad8: fakeChar() },
    });
    const infos: unknown[] = [];
    const t = new KickrTrainer({ onInfo: (i) => infos.push(i) });
    await t.connect();
    expect(infos[0]).toMatchObject({ protocol: "ftms", canControl: true, deviceName: "Test Trainer" });
    // Filter enthält alle Protokolle (OR) und optionalServices
    const arg = req.mock.calls[0] as unknown as [{ filters: unknown[]; optionalServices: unknown[] }];
    expect(arg[0].filters).toHaveLength(4);
    await t.setTargetPower(5000); // > maxW 1000 -> geklemmt
    await t.setTargetPower(5000); // dedupe
    expect(Array.from(writes.at(-1)!)).toEqual([0x05, 0xe8, 0x03]);
    expect(writes.filter((w) => w[0] === 0x05)).toHaveLength(1);
    // Resume sendet Ziel erneut
    await t.pause();
    await t.start();
    await t.setTargetPower(5000);
    expect(writes.filter((w) => w[0] === 0x05)).toHaveLength(2);
  });

  it("fällt auf FE-C zurück, wenn kein FTMS vorhanden ist", async () => {
    const writes: Uint8Array[] = [];
    installBluetooth({
      [FEC_SERVICE]: { [FEC_NOTIFY]: fakeChar(), [FEC_WRITE]: fakeChar(writes) },
    });
    const infos: unknown[] = [];
    const t = new KickrTrainer({ onInfo: (i) => infos.push(i) });
    await t.connect();
    expect(infos[0]).toMatchObject({ protocol: "fec", canControl: true });
    await t.setTargetPower(150);
    expect(writes[0][4]).toBe(0x31);
  });

  it("Cycling Power ohne Steuerung: power-only, setTargetPower ist No-op", async () => {
    installBluetooth({ [CPS_SERVICE]: { [CPS_MEASUREMENT]: fakeChar() } });
    const infos: unknown[] = [];
    const t = new KickrTrainer({ onInfo: (i) => infos.push(i) });
    await t.connect();
    expect(infos[0]).toMatchObject({ protocol: "power-only", canControl: false });
    await expect(t.setTargetPower(200)).resolves.toBeUndefined();
  });

  it("FTMS ohne Control Point degradiert auf Messwerte statt zu scheitern", async () => {
    installBluetooth({ [FTMS_SERVICE]: { 0x2ad2: fakeChar() } });
    const infos: unknown[] = [];
    const t = new KickrTrainer({ onInfo: (i) => infos.push(i) });
    await t.connect();
    expect(infos[0]).toMatchObject({ protocol: "ftms", canControl: false });
  });

  it("wirft verständlichen Fehler ohne unterstütztes Protokoll", async () => {
    installBluetooth({});
    const statuses: string[] = [];
    const t = new KickrTrainer({ onStatus: (s) => statuses.push(s) });
    await expect(t.connect()).rejects.toThrow(/Kein unterstütztes Protokoll/);
    expect(statuses).toContain("error");
  });
});
