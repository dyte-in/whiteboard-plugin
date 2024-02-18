import './settings.css';
import Icon from '../icon/Icon';
import { MainContext } from '../../context';
import { useContext, useEffect, useState } from 'react';
import { TDExportBackground, TDExportType, TldrawApp } from '@tldraw/tldraw';
import { fetchUrl, getFormData } from '../../utils/helpers';


const SaveButton = () => {
    const [loading, setLoading] = useState<boolean>(false);
    const [uploaded, setUploaded] = useState<boolean>(false);
    const { app, plugin, meetingId, setError, autoScale, setAutoScale, config } = useContext(MainContext);

    const handleExportError = () => {
        plugin?.room?.emitEvent(
            'board-saved',
            { url: undefined, message: 'Cannot save an empty board.', status: 400 },
        );
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
            const image =  await app.getImage(TDExportType.JPG);
            if (!image && ignoreErrors) {
                handleExportError();
                setLoading(false);
                return;
            }
            if (!image) {
                setLoading(false);
                setError("Can't capture an empty board.")
                return;
            }
            const {formData } = getFormData(image, `whiteboard-${meetingId}`);
            await fetchUrl(formData, plugin.authToken);
            plugin?.room?.emitEvent('board-saved', {
                url: `${import.meta.env.VITE_API_BASE}/whiteboard/${meetingId}`,
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
