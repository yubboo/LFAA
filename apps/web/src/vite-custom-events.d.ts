import "vite/types/customEvent";

declare module "vite/types/customEvent" {
  interface CustomEventMap {
    "lfaa:terminal:create": { clientId: string; cols: number; rows: number };
    "lfaa:terminal:input": { clientId: string; data: string };
    "lfaa:terminal:resize": { clientId: string; cols: number; rows: number };
    "lfaa:terminal:dispose": { clientId: string };
    "lfaa:terminal:data": { clientId: string; data: string };
    "lfaa:terminal:ready": { clientId: string; shell: string };
    "lfaa:terminal:exit": { clientId: string; exitCode: number };
    "lfaa:terminal:error": { clientId: string; message: string };
  }
}
