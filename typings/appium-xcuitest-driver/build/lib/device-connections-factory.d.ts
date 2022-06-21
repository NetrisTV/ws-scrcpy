declare class DeviceConnectionsFactory {
    listConnections (udid?: string | null, port?: string | null, strict?: boolean): string[];
    requestConnection(
        udid: string,
        port: number,
        options: { usePortForwarding?: boolean; devicePort?: number },
    ): Promise<void>;
    releaseConnection(udid: string | null, port: number | null): void;
}
declare const DEVICE_CONNECTIONS_FACTORY: DeviceConnectionsFactory;

export { DEVICE_CONNECTIONS_FACTORY, DeviceConnectionsFactory };
export default DEVICE_CONNECTIONS_FACTORY;
