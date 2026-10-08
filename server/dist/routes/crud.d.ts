interface CrudOptions {
    table: string;
    ownerCol?: string;
    adminOnly?: boolean;
    readOnly?: boolean;
    readPermission?: string;
    createPermission?: string;
    updatePermission?: string;
    deletePermission?: string;
    defaultOrder?: string;
    ownerWrite?: boolean;
}
export declare function createCrudRouter(opts: CrudOptions): import("express-serve-static-core").Router;
export {};
