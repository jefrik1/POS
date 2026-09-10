import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
/**
 * GET /api/users
 * Mengembalikan user aktif beserta peran dan cabang.
 * - Mode DB: JOIN users → roles → outlets
 * - Mode mock: mapping dari mockUsers + mockOutlets
 */
export declare const getUsers: (req: AuthRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=userController.d.ts.map