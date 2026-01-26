declare module "@novnc/novnc/core/rfb" {
  export interface RFBOptions {
    credentials?: { password?: string; username?: string; target?: string };
    shared?: boolean;
    repeaterID?: string;
    wsProtocols?: string[];
  }

  export interface RFBCredentials {
    password?: string;
    username?: string;
    target?: string;
  }

  export interface ConnectEvent extends CustomEvent {
    detail: Record<string, never>;
  }

  export interface DisconnectEvent extends CustomEvent {
    detail: {
      clean: boolean;
    };
  }

  export interface SecurityFailureEvent extends CustomEvent {
    detail: {
      status: number;
      reason: string;
    };
  }

  export interface ClipboardEvent extends CustomEvent {
    detail: {
      text: string;
    };
  }

  export interface CapabilitiesEvent extends CustomEvent {
    detail: {
      capabilities: { power: boolean };
    };
  }

  export default class RFB {
    constructor(
      target: HTMLElement,
      urlOrChannel: string | WebSocket,
      options?: RFBOptions
    );

    // Properties
    viewOnly: boolean;
    focusOnClick: boolean;
    clipViewport: boolean;
    dragViewport: boolean;
    scaleViewport: boolean;
    resizeSession: boolean;
    showDotCursor: boolean;
    background: string;
    qualityLevel: number;
    compressionLevel: number;
    capabilities: { power: boolean };

    // Methods
    disconnect(): void;
    sendCredentials(credentials: RFBCredentials): void;
    sendKey(keysym: number, code: string, down?: boolean): void;
    sendCtrlAltDel(): void;
    focus(): void;
    blur(): void;
    machineShutdown(): void;
    machineReboot(): void;
    machineReset(): void;
    clipboardPasteFrom(text: string): void;

    // Event handling
    addEventListener(
      type: "connect",
      listener: (e: ConnectEvent) => void
    ): void;
    addEventListener(
      type: "disconnect",
      listener: (e: DisconnectEvent) => void
    ): void;
    addEventListener(
      type: "securityfailure",
      listener: (e: SecurityFailureEvent) => void
    ): void;
    addEventListener(
      type: "clipboard",
      listener: (e: ClipboardEvent) => void
    ): void;
    addEventListener(
      type: "capabilities",
      listener: (e: CapabilitiesEvent) => void
    ): void;
    addEventListener(type: string, listener: (e: CustomEvent) => void): void;
    removeEventListener(type: string, listener: (e: CustomEvent) => void): void;
  }
}
