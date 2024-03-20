import React, { useEffect } from 'react'
import { TDExportType, TldrawApp } from '@tldraw/tldraw'
import DytePlugin from '@dytesdk/plugin-sdk'


interface Props {
    app: TldrawApp | undefined,
    plugin: DytePlugin | undefined,
    pageHistory: Set<string>,
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    return new Promise(resolve => {
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
    });
  };

const summary = ({ app, plugin, pageHistory, setLoading }: Props) => {
    useEffect(() => {
        if (!app || !plugin) return;

        plugin.room.on('get-summary', async () => {
            let image: string | undefined;
            try {
                const preview = await app.getImage(TDExportType.JPG, {
                    transparentBackground: true,
                });
                if (preview) {
                    image = await blobToBase64(preview)
                }
            } catch (e) {}
        
            plugin.room.emitEvent('board-summary', {
                document: app.document,
                pageIds: pageHistory,
                preview: image,
            });
        })

        plugin.room.on('load-app', ({payload}) => {
            const document = payload.document;
            setLoading(true);
            (app as TldrawApp).updateDocument(document);
            plugin.emit('load-app-remote', { document });
            setLoading(false);
        })

        plugin.on('load-app-remote', ({ document }) => {
            setLoading(true);
            (app as TldrawApp).updateDocument(document);
            setLoading(false);
        })

        plugin.room.on('set-page', ({ payload }) => {
            const page = payload.pageId;
            (app as TldrawApp).changePage(page);
        })

        plugin.room.on('add-page', ({ payload }) => {
            const pageName = payload.page;
            (app as TldrawApp).createPage(undefined, pageName);
        })
    }, [app, plugin])
}

export default summary