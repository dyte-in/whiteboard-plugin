import './saveButton.css';
import { useContext, useState } from 'react';
import { MainContext } from '../../context';
import { TDExportType } from '@tldraw/tldraw';
import Icon from '../icon/Icon';
import { fetchUrl, getFormData } from '../../utils/helpers';

const SaveButton = () => {
    const [loading, setLoading] = useState<boolean>(false);
    const { app, plugin, meetingId } = useContext(MainContext);

    const handleExport = async () => {
        setLoading(true);
        const image =  await app.getImage(TDExportType.JPG);
        if (!image) {
            setLoading(false);
            return;
        }
        const {formData } = getFormData(image, `meeting-${meetingId}`);
        await fetchUrl(formData, plugin.authToken)
        setLoading(false);
    };

    return (
    <Icon onClick={handleExport} className="save-button" icon={loading ? 'loading': 'save'} />
    )
}

export default SaveButton;
