export const defaultFileNameFunction = ({ url, md5 }: any) => {
    return md5(url);
};
