import path from "path";
import { execa } from "execa";
import { environment } from "@raycast/api";
import fs from "fs";

export enum TransportType {
  Avb = "avb",
  Aggregate = "aggregate",
  Airplay = "airplay",
  Autoaggregate = "autoaggregate",
  Bluetooth = "bluetooth",
  BluetoothLowEnergy = "bluetoothle",
  "Built-In" = "builtin",
  DisplayPort = "displayport",
  Firewire = "firewire",
  HDMI = "hdmi",
  PCI = "pci",
  Thunderbolt = "thunderbolt",
  Usb = "usb",
  Virtual = "virtual",
  Unknown = "unknown",
}

export type AudioDevice = {
  name: string;
  isInput: boolean;
  isOutput: boolean;
  id: string;
  uid: string;
  transportType: TransportType;
};

const binaryAsset = path.join(environment.assetsPath, "audio-devices");
const binary = path.join(environment.supportPath, "audio-devices");

async function ensureBinary() {
  if (!fs.existsSync(binary)) {
    await execa("cp", [binaryAsset, binary]);
    await execa("chmod", ["+x", binary]);
  }
}

function throwIfStderr({ stderr }: { stderr: string }) {
  if (stderr) {
    throw new Error(stderr);
  }
}

function parseStdout({ stdout, stderr }: { stderr: string; stdout: string }) {
  throwIfStderr({ stderr });
  return JSON.parse(stdout);
}

export async function getInputDevices(): Promise<AudioDevice[]> {
  await ensureBinary();
  return parseStdout(await execa(binary, ["list", "--input", "--json"]));
}

export async function getDefaultInputDevice(): Promise<AudioDevice> {
  await ensureBinary();
  return parseStdout(await execa(binary, ["input", "get", "--json"]));
}
