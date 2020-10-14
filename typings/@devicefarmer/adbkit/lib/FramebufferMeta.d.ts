export interface FramebufferMeta {
    version: number;
    format: string;
    width: number;
    height: number;
    bpp: number;
    size: number;
    red_offset: number;
    red_length: number;
    blue_offset: number;
    blue_length: number;
    green_offset: number;
    green_length: number;
    alpha_offset: number;
    alpha_length: number;
}
