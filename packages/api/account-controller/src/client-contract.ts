/** 功能：声明账户 Remote 的源类型合同。作用：由 Typert 生成器产出 Host/Client 共用的方法类型与描述。关联文件：client-contract.generated.ts。 */
export type AccountControllerRemoteContract = {
  "auth/me": {
    input: Record<string, never>;
    output: {
      user: {
        id: string;
        uid: number;
        username: string;
        email: string | null;
        role: "super_admin" | "admin" | "member";
        createdAt: string;
      };
    };
  };
};
