import React, { useEffect } from 'react'
import { TDExportType, TldrawApp } from '@tldraw/tldraw'
import DytePlugin from '@dytesdk/plugin-sdk'


interface Props {
    app: TldrawApp | undefined,
    plugin: DytePlugin | undefined,
    pageHistory: Set<string>,
}

const summary = ({ app, plugin, pageHistory }: Props) => {
    useEffect(() => {
        if (!app || !plugin) return;

        plugin.room.on('get-summary', async () => {
            let image: string | undefined;
            try {
                const preview = await app.getImage(TDExportType.JPG, {
                    transparentBackground: true,
                });
                if (preview) {
                    image = URL.createObjectURL(preview);
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
            (app as TldrawApp).updateDocument(document);
        })

    }, [app, plugin])
}

export default summary