import jwt from "jsonwebtoken";
export declare const hashPassword: (password: string) => Promise<string>;
export declare const comparePassword: (password: string, hash: string) => Promise<boolean>;
export declare const generateAccessToken: (payload: {
    userId: number;
    role: string;
    outletId?: number;
}) => string;
export declare const generateRefreshToken: (userId: number) => string;
export declare const hashRefreshToken: (token: string) => string;
export declare const verifyAccessToken: (token: string) => string | jwt.JwtPayload | null;
export declare const verifyRefreshToken: (token: string) => string | jwt.JwtPayload | null;
//# sourceMappingURL=auth.d.ts.map