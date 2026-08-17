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
}
export declare function createCrudRouter(opts: CrudOptions): import("express-serve-static-core").Router;
export {};
