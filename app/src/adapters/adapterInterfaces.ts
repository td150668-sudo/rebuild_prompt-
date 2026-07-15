export interface IAdapterOptions {
  port?: number;
  pollingInterval?: number;
  baseUrl?: string;
  path?: string;
  proxyExePath?: string;
  proxyExeArgs?: string[];
}

export interface IProxySettings {
  proxyPath: string | null;
  proxyPort: number;
  proxyArgs: string[] | null;
}

export interface ITarget {
  id: string;
  type?: string;
  title?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
  adapterType?: string;
  metadata?: any;
}

export interface IDevice {
  deviceId: string;
  deviceName?: string;
  deviceOSVersion?: string;
  url?: string;
  version?: string;
}
