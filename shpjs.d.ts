declare module 'shpjs' {
  export default function shp(
    input: string | ArrayBuffer | Buffer
  ): Promise<any>;

  export function parseShp(
    shp: ArrayBuffer,
    prj?: string
  ): Promise<any>;

  export function parseDbf(
    dbf: ArrayBuffer
  ): Promise<any>;

  export function combine(
    result: any[]
  ): any;
}
