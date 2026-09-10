declare const mockUsers: {
    admin: {
        id: number;
        username: string;
        email: string;
        role: string;
        outletId: null;
    };
    manager: {
        id: number;
        username: string;
        email: string;
        role: string;
        outletId: number;
    };
    cashier: {
        id: number;
        username: string;
        email: string;
        role: string;
        outletId: number;
    };
};
declare const mockTokens: {};
declare function generateToken(user: any): string;
//# sourceMappingURL=mock-api.d.ts.map