import MsgReader from '@kenjiuno/msgreader';

export const extractMsgData = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            try {
                const msgReader = new MsgReader(reader.result);
                const fileData = msgReader.getFileData();

                // Extracting main fields
                const subject = fileData.subject || '';
                const sender = fileData.senderName || fileData.senderEmail || '';
                const body = fileData.body || '';
                const attachments = fileData.attachments ? fileData.attachments.map(att => ({
                    fileName: att.fileName || att.name || 'unknown',
                    contentLength: att.contentLength
                })) : [];

                resolve({
                    subject,
                    sender,
                    body,
                    attachments
                });
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => {
            reject(error);
        };

        reader.readAsArrayBuffer(file);
    });
};
