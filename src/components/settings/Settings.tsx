import './settings.css';
import Icon from '../icon/Icon';
import { MainContext } from '../../context';
import { useContext, useEffect, useState } from 'react';
import { TDExportBackground, TDExportType, TldrawApp } from '@tldraw/tldraw';
import { fetchUrl, getFormData } from '../../utils/helpers';
import DytePlugin from '@dytesdk/plugin-sdk';


const SaveButton = () => {
    const [loading, setLoading] = useState<boolean>(false);
    const [uploaded, setUploaded] = useState<boolean>(false);
    const { app, plugin, meetingId, setError, autoScale, setAutoScale } = useContext(MainContext);

    const handleExport = async () => {
        if (uploaded || loading) return;
        setLoading(true);
        try {
            app.setSetting('exportBackground', TDExportBackground.Light);
            const image =  await app.getImage(TDExportType.JPG);
            if (!image) {
                setLoading(false);
                setError("Can't capture an empty board.")
                return;
            }
            const {formData } = getFormData(image, `whiteboard-${meetingId}`);
            await fetchUrl(formData, plugin.authToken);
            setUploaded(true);
            plugin.room.emitEvent('board-saved', {
                url: `https://files.plugins.dyte.in/whiteboard/${meetingId}`
            })
            setTimeout(() => {
                setUploaded(false);
            }, 2000)
        } catch (e) {
            setError('Error while saving board.')
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
        if (!plugin) return;
        plugin.room.on('save-board', async () => {
            await handleExport();
            plugin.room.emitEvent('board-saved', {
                url: `${import.meta.env.VITE_API_BASE}/whiteboard/${meetingId}`,
            });
        })
    }, [plugin])

    const toggleAutoScale = () => {
        setAutoScale((a: boolean) => !a);
    }

    return (
        <div className='settings-container'>
            <Icon
            onClick={toggleAutoScale}
            className={`settings-icon ${autoScale ? 'active' : ''}`}
            icon='scale' />
            <Icon
            onClick={handleExport}
            className={`settings-icon ${getExportColor()}`}
            icon={getExportIcon()} />
        </div>
    )
}

export default SaveButton;
