const storeConf = {
    volatile: false,
}
let INDEX = 1;

const setIndex = (val: number) => {
    INDEX = val;
}

const getAssetSize = (size: number[]) => {
    if (!size) return size;
    const x = size[0];
    const y = size[1];

    const winX = window.innerWidth;
    const winY = window.innerHeight;

    const winRatio = winY/winX;
    const ratio = y/x;

    if (ratio > winRatio) {
        return [(winY/ratio) * 0.8, winY * 0.8];
    }
    return size;
}

export {
    storeConf,
    INDEX,
    setIndex,
    getAssetSize,
}