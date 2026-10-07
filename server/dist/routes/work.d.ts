declare const router: import("express-serve-static-core").Router;
export declare function syncOverdueMilestones(clientOrPool?: {
    query: (text: string, params?: any[]) => Promise<any>;
}): Promise<number>;
export default router;
