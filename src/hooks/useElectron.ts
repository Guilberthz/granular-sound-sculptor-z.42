import { useEffect, useState } from "react";

export interface ElectronOptions {
  onMenuOpenFile: () => void;
  onMenuExportWav: () => void;
}

export function useElectron({ onMenuOpenFile, onMenuExportWav }: ElectronOptions) {
  const [appVersion, setAppVersion] = useState("1.0.0");

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onMenuOpenFile(onMenuOpenFile);
    window.electronAPI.onMenuExportWav(onMenuExportWav);
    return () => {};
  }, [onMenuOpenFile, onMenuExportWav]);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getVersion().then(setAppVersion).catch(() => {});
  }, []);

  return { appVersion };
}