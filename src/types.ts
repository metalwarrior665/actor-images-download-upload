export type ImageCheck = {
    type: string;
    minSize: number;
    minWidth: number;
    minHeight: number;
    convertWebpToPng: boolean;
    noInfo?: boolean;
};
