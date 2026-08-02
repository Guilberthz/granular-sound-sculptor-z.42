interface ElectronAPI {
  openAudio: () => Promise<{ name: string; data: number[]; mimeType: string } | null>;
  saveWav: (bufferData: ArrayBuffer) => Promise<boolean>;
  getVersion: () => Promise<string>;
  onMenuOpenFile: (callback: () => void) => void;
  onMenuExportWav: (callback: () => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
