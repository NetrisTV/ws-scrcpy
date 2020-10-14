import Service from './service';
declare class ServiceMap {
    private remotes;
    count: number;
    end(): void;
    insert(remoteId: number, socket: Service): Service;
    get(remoteId: number): Service | null;
    remove(remoteId: number): Service | null;
}
export = ServiceMap;
