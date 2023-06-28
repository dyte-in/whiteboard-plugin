import './saveButton.css';
import Icon from '../icon/Icon';
import { MainContext } from '../../context';
import { useContext, useState } from 'react';
import { TDExportBackground, TDExportType, TldrawApp } from '@tldraw/tldraw';
import { fetchUrl, getFormData } from '../../utils/helpers';


const SaveButton = () => {
    const [loading, setLoading] = useState<boolean>(false);
    const [uploaded, setUploaded] = useState<boolean>(false);
    const { app, plugin, meetingId, setError } = useContext(MainContext);

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
            const {formData } = getFormData(image, `meeting-${meetingId}`);
            await fetchUrl(formData, plugin.authToken);
            setUploaded(true);
            setTimeout(() => {
                setUploaded(false);
            }, 2000)
        } catch (e) {
            setError('Error while saving board.')
        }
        setLoading(false);
    };

    const getIcon = () => {
        if (loading) return 'loading';
        if (uploaded) return 'checkmark';
        return 'save';
    }
    const getColor = () => {
        if (loading) return 'loading';
        if (uploaded) return 'success';
        return '';
    }

    return (
    <Icon
    onClick={handleExport}
    className={`save-button ${getColor()}`}
    icon={getIcon()} />
    )
}

export default SaveButton;
