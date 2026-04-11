type UploadOptions = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  folder?: string;
};

const CLOUD_NAME = 'dg04e9qcs';
const UPLOAD_PRESET = 'velora_unsigned_media';

const getFallbackFileName = (mimeType?: string | null) => {
  if (mimeType?.startsWith('audio/')) {
    return 'upload.m4a';
  }

  if (mimeType?.startsWith('video/')) {
    return 'upload.mp4';
  }

  return 'upload.jpg';
};

export const uploadToCloudinary = async ({
  uri,
  fileName,
  mimeType,
  folder = 'velora',
}: UploadOptions) => {
  const formData = new FormData();

  formData.append('file', {
    uri,
    name: fileName || getFallbackFileName(mimeType),
    type: mimeType || 'application/octet-stream',
  } as any);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok || !data.secure_url) {
    throw new Error(data?.error?.message || 'Cloudinary upload failed');
  }

  return {
    url: data.secure_url as string,
    resourceType: data.resource_type as string,
    publicId: data.public_id as string,
  };
};
