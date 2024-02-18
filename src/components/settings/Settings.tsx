import './settings.css';
import jsPDF from "jspdf";
import Icon from '../icon/Icon';
import logo from '../../assets/logo.png';
import { MainContext } from '../../context';
import { useContext, useEffect, useState } from 'react';
import { TDExportBackground, TDExportType, TldrawApp } from '@tldraw/tldraw';
import { fetchUrl, getFormData } from '../../utils/helpers';
import { Utils } from '@tldraw/core';


interface ImageDimension {
    width: number;
    height: number;
};

const A4_PAPER_DIMENSIONS = {
width: 210,
height: 297,
};

const A4_PAPER_RATIO = A4_PAPER_DIMENSIONS.width / A4_PAPER_DIMENSIONS.height;

const SaveButton = () => {

    const [uploaded, setUploaded] = useState<boolean>(false);
    const {
        app,
        plugin,
        page,
        meetingId,
        loading,
        setLoading,
        setError,
        autoScale,
        setAutoScale,
        config } = useContext(MainContext);

    const handleExportError = () => {
        plugin?.room?.emitEvent(
            'board-saved',
            { url: undefined, message: 'Cannot save an empty board.', status: 400 },
        );
    }

    const imageDimensionsOnA4 = (dimensions: ImageDimension) => {
        const isLandscapeImage = dimensions.width >= dimensions.height;
      
        // If the image is in landscape, the full width of A4 is used.
        if (isLandscapeImage) {
          return {
            width: A4_PAPER_DIMENSIONS.width,
            height:
              A4_PAPER_DIMENSIONS.width / (dimensions.width / dimensions.height),
          };
        }
      
        // If the image is in portrait and the full height of A4 would skew
        // the image ratio, we scale the image dimensions.
        const imageRatio = dimensions.width / dimensions.height;
        if (imageRatio > A4_PAPER_RATIO) {
          const imageScaleFactor =
            (A4_PAPER_RATIO * dimensions.height) / dimensions.width;
      
          const scaledImageHeight = A4_PAPER_DIMENSIONS.height * imageScaleFactor;
      
          return {
            height: scaledImageHeight,
            width: scaledImageHeight * imageRatio,
          };
        }
      
        // The full height of A4 can be used without skewing the image ratio.
        return {
          width: A4_PAPER_DIMENSIONS.height / (dimensions.height / dimensions.width),
          height: A4_PAPER_DIMENSIONS.height,
        };
    };
    const generatePdfFromImages = (images: any[]) => {
        const doc = new jsPDF();
        doc.deletePage(1);
        images.forEach((image) => {
            const imageDimensions = imageDimensionsOnA4({
                width: image.dimensions.width,
                height: image.dimensions.height,
            });
        
            doc.addPage();
            doc.addImage(
                image.src,
                'jpg',
                (A4_PAPER_DIMENSIONS.width - imageDimensions.width) / 2,
                (A4_PAPER_DIMENSIONS.height - imageDimensions.height) / 2,
                imageDimensions.width,
                imageDimensions.height,
            );
        });
        const pdfDoc = doc.output("blob");
        return pdfDoc;
    };
    const generatePdf = async () => {
        const pages = Object.keys((app as TldrawApp).document.pages);
        const images = [];
        for(let i = 0; i < pages.length; i++) {
            app.changePage(pages[i]);
            try {
                const img =  await (app as TldrawApp).getImage(TDExportType.JPG);
                (app as TldrawApp).selectAll();
                const { selectedIds } = app;
                const shapes = selectedIds.map((id: string) => app.getShape(id));
                const bounds = Utils.getCommonBounds(
                shapes.map((shape: any) => app.getShapeUtil(shape).getBounds(shape))
                );
                if (img) 
                    images.push({
                        src:  URL.createObjectURL(img),
                        dimensions: {
                            width: bounds.maxX - bounds.minX,
                            height: bounds.maxY - bounds.minY,
                        }
                    });
            } catch (e) {}
        }
        const doc = generatePdfFromImages(images);
        const p = app.getPage(page.id);
        if (!p) {
            app.createPage(page.id, page.name);
        } else {
            app.changePage(page.id);
            (app as TldrawApp).selectNone();
        }
        return doc;
    }
    const handleExport = async (ignoreErrors = false) => {
        if (uploaded || loading) return;
        setLoading(true);
        try {
            const isEmpty = app.getAppState().isEmptyCanvas;
            if (isEmpty) {
                setLoading(false);
                return;
            };
            app.setSetting('exportBackground', TDExportBackground.Light);
            let doc: Blob;
            const pages = Object.keys(app.document.pages);
            if (pages.length > 1) {
                doc = await generatePdf();
            } else {
                doc =  await app.getImage(TDExportType.JPG);
            }
            if (!doc && ignoreErrors) {
                handleExportError();
                setLoading(false);
                return;
            }
            if (!doc) {
                setLoading(false);
                setError("Can't capture an empty board.")
                return;
            }
            const {formData } = getFormData(doc, `whiteboard-${meetingId}`);
            const url = await fetchUrl(formData, plugin.authToken);
            plugin?.room?.emitEvent('board-saved', {
                url: `${import.meta.env.VITE_API_BASE}/whiteboard/${meetingId}`,
                fileUrl: url,
                message: 'Board saved successfully.',
                status: 200,
            });
            setUploaded(true);
            setTimeout(() => {
                setUploaded(false);
            }, 2000)
        } catch (e) {
            if (ignoreErrors) handleExportError()
            else {
                setError('Error while saving board.')
            }
            
        }
        setLoading(false);
    };

    const getExportIcon = () => {
        if (loading) return 'loading';
        if (uploaded) return 'checkmark';
        return 'save';
    }
    const getExportColor = () => {
        if (loading) return 'loading';
        if (uploaded) return 'success';
        return '';
    }

    useEffect(() => {
        if (!plugin || !app) return;
        plugin.room.on('save-board', async () => {
            await handleExport(true);
        })
        return () => {
            plugin.room.removeListeners('save-board');
        }
    }, [plugin, app])

    const toggleAutoScale = () => {
        setAutoScale((a: boolean) => !a);
    }

    if (loading) {
        return <div className="loading-page save-loader">
            <img src={logo} />
            <p>Whiteboard</p>
            <span>Saving your work, this may take a few seconds...</span>
        </div>
    }
    return (
        <div className={config.darkMode ? 'settings-container-dark' : 'settings-container'}>
            <Icon
            onClick={toggleAutoScale}
            className={`${config.darkMode ? 'settings-icon-dark' : 'settings-icon'} ${autoScale ? 'active' : ''}`}
            icon='scale' />
            <Icon
            onClick={() => handleExport()}
            className={`${config.darkMode ? 'settings-icon-dark' : 'settings-icon'} ${getExportColor()}`}
            icon={getExportIcon()} />
        </div>
    )
}

export default SaveButton;
