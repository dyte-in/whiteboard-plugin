import { TldrawApp } from "@tldraw/tldraw";
import axios from "axios";

const throttle = (cb: any, delay: number) => {
    console.log(delay);
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
    const rangeSize = 100;
    const parts = [
        Math.floor(Math.random()*256),
        Math.floor(Math.random()*rangeSize),
        Math.floor(Math.random()*rangeSize) + 256-rangeSize 
    ].sort((a, b) => Math.random() < 0.5);
    return '#' + parts.map( p => p.toString(16).padStart(2, "0") ).join('');
}

export { randomColor, throttle, getFormData, fetchUrl };
