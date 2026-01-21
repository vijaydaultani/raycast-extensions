import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  showToast,
  Toast,
  closeMainWindow,
  popToRoot,
  showHUD,
  open,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { execSync } from "child_process";
import { homedir } from "os";
import { AudioDevice, getInputDevices, getDefaultInputDevice, TransportType } from "./audio-device";
import { checkSuperwhisperInstallation, SUPERWHISPER_BUNDLE_ID, SUPERWHISPER_SETAPP_BUNDLE_ID } from "./utils";

const SUPERWHISPER_PLIST = `${homedir()}/Library/Preferences/com.superduper.superwhisper.plist`;
const SUPERWHISPER_SETAPP_PLIST = `${homedir()}/Library/Preferences/com.superduper.superwhisper-setapp.plist`;

function getSuperwhisperPlistPath(): string | null {
  try {
    execSync(`defaults read com.superduper.superwhisper`, { encoding: "utf8" });
    return SUPERWHISPER_PLIST;
  } catch {
    try {
      execSync(`defaults read com.superduper.superwhisper-setapp`, { encoding: "utf8" });
      return SUPERWHISPER_SETAPP_PLIST;
    } catch {
      return null;
    }
  }
}

function getCurrentSuperwhisperDevice(): { deviceId: string | null; useDefault: boolean } {
  try {
    const plistPath = getSuperwhisperPlistPath();
    if (!plistPath) {
      return { deviceId: null, useDefault: true };
    }

    const domain = plistPath.includes("setapp") ? "com.superduper.superwhisper-setapp" : "com.superduper.superwhisper";

    const useDefaultStr = execSync(`defaults read ${domain} useDefaultAudioDevice 2>/dev/null || echo "1"`, {
      encoding: "utf8",
    }).trim();
    const useDefault = useDefaultStr === "1";

    if (useDefault) {
      return { deviceId: null, useDefault: true };
    }

    const deviceId = execSync(`defaults read ${domain} selectedDeviceID 2>/dev/null || echo ""`, {
      encoding: "utf8",
    }).trim();

    return { deviceId: deviceId || null, useDefault: false };
  } catch {
    return { deviceId: null, useDefault: true };
  }
}

function setSuperwhisperDevice(device: AudioDevice | null) {
  const plistPath = getSuperwhisperPlistPath();
  if (!plistPath) {
    throw new Error("Superwhisper preferences not found");
  }

  const domain = plistPath.includes("setapp") ? "com.superduper.superwhisper-setapp" : "com.superduper.superwhisper";

  if (device === null) {
    // Use system default
    execSync(`defaults write ${domain} useDefaultAudioDevice -bool true`);
  } else {
    // Use specific device - uid is used directly (some devices like Bluetooth already have :input suffix)
    execSync(`defaults write ${domain} useDefaultAudioDevice -bool false`);
    execSync(`defaults write ${domain} selectedDeviceID -string "${device.uid}"`);
  }

}

async function restartSuperwhisper() {
  // Quit superwhisper if running
  try {
    execSync(`osascript -e 'tell application "superwhisper" to quit' 2>/dev/null || true`);
  } catch {
    // App might not be running
  }

  // Wait a moment for the app to quit
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Relaunch superwhisper
  try {
    await open("superwhisper://", SUPERWHISPER_BUNDLE_ID);
  } catch {
    // Try setapp bundle if regular one fails
    try {
      await open("superwhisper://", SUPERWHISPER_SETAPP_BUNDLE_ID);
    } catch {
      // If both fail, just try opening the app by name
      execSync(`open -a superwhisper 2>/dev/null || true`);
    }
  }
}

function useInputDevices() {
  return usePromise(async () => {
    const isInstalled = await checkSuperwhisperInstallation();
    if (!isInstalled) {
      throw new Error("Superwhisper is not installed");
    }

    const devices = await getInputDevices();
    const systemDefault = await getDefaultInputDevice();
    const superwhisperConfig = getCurrentSuperwhisperDevice();

    return {
      devices,
      systemDefault,
      superwhisperConfig,
    };
  }, []);
}

function getTransportTypeLabel(transportType: TransportType): string {
  const labels: Record<TransportType, string> = {
    [TransportType.Avb]: "AVB",
    [TransportType.Aggregate]: "Aggregate",
    [TransportType.Airplay]: "AirPlay",
    [TransportType.Autoaggregate]: "Auto Aggregate",
    [TransportType.Bluetooth]: "Bluetooth",
    [TransportType.BluetoothLowEnergy]: "Bluetooth LE",
    [TransportType["Built-In"]]: "Built-In",
    [TransportType.DisplayPort]: "DisplayPort",
    [TransportType.Firewire]: "FireWire",
    [TransportType.HDMI]: "HDMI",
    [TransportType.PCI]: "PCI",
    [TransportType.Thunderbolt]: "Thunderbolt",
    [TransportType.Usb]: "USB",
    [TransportType.Virtual]: "Virtual",
    [TransportType.Unknown]: "Unknown",
  };
  return labels[transportType] || "Unknown";
}

function getDeviceIcon(device: AudioDevice, isSelected: boolean) {
  let source = Icon.Microphone;

  if (device.transportType === TransportType.Bluetooth || device.transportType === TransportType.BluetoothLowEnergy) {
    source = Icon.Headphones;
  } else if (device.transportType === TransportType.Usb) {
    source = Icon.Plug;
  } else if (device.transportType === TransportType["Built-In"]) {
    source = Icon.Microphone;
  }

  return {
    source,
    tintColor: isSelected ? Color.Green : Color.SecondaryText,
  };
}

export default function Command() {
  const { data, isLoading, error, revalidate } = useInputDevices();

  const isDeviceSelected = (device: AudioDevice): boolean => {
    if (!data) return false;
    const { superwhisperConfig } = data;

    if (superwhisperConfig.useDefault) {
      return false;
    }

    // Check if this device's uid matches
    return superwhisperConfig.deviceId === device.uid;
  };

  const isSystemDefaultSelected = (): boolean => {
    if (!data) return true;
    return data.superwhisperConfig.useDefault;
  };

  const handleSelectDevice = async (device: AudioDevice) => {
    try {
      setSuperwhisperDevice(device);
      await showToast({
        style: Toast.Style.Animated,
        title: "Restarting Superwhisper...",
      });
      await restartSuperwhisper();
      revalidate();
      await closeMainWindow({ clearRootSearch: true });
      await popToRoot({ clearSearchBar: true });
      await showHUD(`Superwhisper input set to "${device.name}"`);
    } catch (e) {
      console.error(e);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to set input device",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  const handleUseSystemDefault = async () => {
    try {
      setSuperwhisperDevice(null);
      await showToast({
        style: Toast.Style.Animated,
        title: "Restarting Superwhisper...",
      });
      await restartSuperwhisper();
      revalidate();
      await closeMainWindow({ clearRootSearch: true });
      await popToRoot({ clearSearchBar: true });
      await showHUD("Superwhisper set to use system default input");
    } catch (e) {
      console.error(e);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to set system default",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  if (error) {
    return (
      <List>
        <List.EmptyView
          title="Failed to load input devices"
          description={error.message}
          icon={{ source: Icon.Warning, tintColor: Color.Red }}
          actions={
            <ActionPanel>
              {error.message.includes("not installed") ? (
                <Action.OpenInBrowser url="https://superwhisper.com" title="Install From superwhisper.com" />
              ) : (
                <Action title="Retry" onAction={revalidate} />
              )}
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List isLoading={isLoading}>
      <List.Section title="Options">
        <List.Item
          icon={{
            source: Icon.Globe,
            tintColor: isSystemDefaultSelected() ? Color.Green : Color.SecondaryText,
          }}
          title="Use System Default"
          subtitle={data?.systemDefault ? `Currently: ${data.systemDefault.name}` : undefined}
          accessories={[
            {
              icon: isSystemDefaultSelected() ? Icon.Checkmark : undefined,
            },
          ]}
          actions={
            <ActionPanel>
              <Action title="Use System Default" onAction={handleUseSystemDefault} icon={Icon.Globe} />
            </ActionPanel>
          }
        />
      </List.Section>

      <List.Section title="Available Input Devices">
        {data?.devices.map((device) => {
          const isSelected = isDeviceSelected(device);
          return (
            <List.Item
              key={device.uid}
              icon={getDeviceIcon(device, isSelected)}
              title={device.name}
              subtitle={getTransportTypeLabel(device.transportType)}
              accessories={[
                {
                  icon: isSelected ? Icon.Checkmark : undefined,
                },
              ]}
              actions={
                <ActionPanel>
                  <Action
                    title={`Select ${device.name}`}
                    onAction={() => handleSelectDevice(device)}
                    icon={Icon.Microphone}
                  />
                  <Action.CopyToClipboard title="Copy Device Name" content={device.name} />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
