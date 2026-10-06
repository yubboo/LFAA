/** 此文件由 lfaa-typert-generate 自动生成；请修改源合同并重新生成，不要手工编辑。 */

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

export const accountControllerRemoteMethods = {
  "auth/me": {
    "endpoint": "auth/me",
    "namespace": "auth",
    "method": "me"
  }
} as const;

export const accountControllerRemoteSchemas = {
  "auth/me": {
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {},
      "required": [],
      "additionalProperties": false
    },
    "output": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "user": {
          "type": "object",
          "properties": {
            "createdAt": {
              "type": "string"
            },
            "email": {
              "anyOf": [
                {
                  "type": "null"
                },
                {
                  "type": "string"
                }
              ]
            },
            "id": {
              "type": "string"
            },
            "role": {
              "anyOf": [
                {
                  "type": "string",
                  "const": "super_admin"
                },
                {
                  "type": "string",
                  "const": "admin"
                },
                {
                  "type": "string",
                  "const": "member"
                }
              ]
            },
            "uid": {
              "type": "number"
            },
            "username": {
              "type": "string"
            }
          },
          "required": [
            "createdAt",
            "email",
            "id",
            "role",
            "uid",
            "username"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "user"
      ],
      "additionalProperties": false
    }
  }
} as const;

