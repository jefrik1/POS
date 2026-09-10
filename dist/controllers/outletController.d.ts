import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
export declare const getOutlets: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createOutlet: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteOutlet: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getDashboardSummary: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=outletController.d.ts.map