import { TDAsset, TDShape } from "@tldraw/tldraw";
import axios from "axios";

interface DebounceObj {
    'onPageChange'?: {
        cb: any,
        args: any[],
        timeout: NodeJS.Timeout,
    }
}

let debounceObj: DebounceObj = {};

const debounce = (cb: any, delay: number) => {
    return (...args: any) => {
        // args: 0 - app, 1 - shapes, 2 - bindings, 3 - assets, 4 - bool
        const obj = debounceObj['onPageChange'];
        if (!obj) {
            debounceObj['onPageChange'] = {
                cb,
                args,
                timeout: setTimeout(function() {
                    cb(...args);
                    debounceObj = {}
                }, delay)
            }
        }
        if (obj) {
            obj.cb = cb;
            obj.args = [args[0], {...obj.args[1], ...args[1]}, {...obj.args[2], ...args[2]}, {...obj.args[3], ...args[3]}, args[4]]
            clearTimeout(obj.timeout);
            obj.timeout = setTimeout(function () {
                cb(...obj.args);
                debounceObj = {}
            }, delay)
        }
    }
}

const throttle = (cb: any, delay: number) => {
    let previousCall = new Date().getTime();
    return function(...args: any) {
        const time = new Date().getTime();
        if (time - previousCall >= delay) {
            previousCall = time;
            cb(...args);
        }
    }
}

const getFormData = (file: Blob, fileName: string) => {
    const formData = new FormData();
    formData.append("file", file, fileName);
    return {formData, fileName: fileName };
}

const fetchUrl = async (formData: FormData, authToken: string) => {
    try {
        const result = await axios({
            method: "post",
            url: `${import.meta.env.VITE_API_BASE}/file`,
            data: formData,
            headers: {"Authorization": `Bearer ${authToken}`},
        });
        if(result?.data?.link)
        {
            return `${import.meta.env.VITE_API_BASE}/file/${result.data.link}`;
        }
    } catch (e: any) {
       throw new Error(e.code);
    }
}

const randomColor = () => {
    var color = Math.floor(Math.random()*16777215).toString(16);
    return '#' + color;
}

interface TLBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
    rotation?: number;
}

const defaultViewport = {
    minX: 0,
    maxX: 100,
    minY: 0,
    maxY: 100,
    width: 100,
    height: 100
}

const createShapeObj = (asset: TDAsset, viewPort: TLBounds = defaultViewport) => {
    const point = (asset as any).point ?? [
        viewPort.width/2 - asset.size[0]/2,
        viewPort.height/2 - asset.size[1]/2,
    ];
    const obj = {
        id: asset.id,
        type: 'image',
        name: 'Image',
        parentId: 'page',
        childIndex: 1,
        point: point,
        size: asset.size,
        rotation: 0,
        style: {
            "color": "black",
            "size": "small",
            "isFilled": false,
            "dash": "draw",
            "scale": 1
        },
        assetId: asset.id,
    }
    return obj as TDShape;
}

export { createShapeObj, randomColor, debounce, throttle, getFormData, fetchUrl };
