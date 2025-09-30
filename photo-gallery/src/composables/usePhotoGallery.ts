import { ref, onMounted, watch } from 'vue';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const PHOTO_STORAGE = 'photos';
const photos = ref<UserPhoto[]>([]);

const convertBlobToBase64 = (blob: Blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });

const savePicture = async (photo: Photo, fileName: string): Promise<UserPhoto> => {
  // Fetch the photo, read as a blob, then convert to base64 format
  const response = await fetch(photo.webPath!);
  const blob = await response.blob();
  const base64Data = (await convertBlobToBase64(blob)) as string;

  await Filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Data,
  });

  // Générer l'URL base64 à partir du fichier sauvegardé
  let webviewPath = '';
  if (Capacitor.getPlatform() === 'web') {
    webviewPath = base64Data;
  } else {
    const file = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Data,
    });
    webviewPath = `data:image/jpeg;base64,${file.data}`;
  }

  return {
    filepath: fileName,
    webviewPath,
  };
};

const loadSavedPhotos = async () => {
  const photoList = await Preferences.get({ key: PHOTO_STORAGE });
  const photosInStorage = photoList.value ? JSON.parse(photoList.value) : [];
  const loadedPhotos: UserPhoto[] = [];
  for (const photo of photosInStorage) {
    let webviewPath = '';
    if (Capacitor.getPlatform() === 'web') {
      webviewPath = photo.webviewPath;
    } else {
      const file = await Filesystem.readFile({
        path: photo.filepath,
        directory: Directory.Data,
      });
      webviewPath = `data:image/jpeg;base64,${file.data}`;
    }
    loadedPhotos.push({ filepath: photo.filepath, webviewPath });
  }
  photos.value = loadedPhotos;
};

export const usePhotoGallery = () => {
  onMounted(loadSavedPhotos);

  const takePhoto = async () => {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100,
    });
    const fileName = Date.now() + '.jpeg';
    const savedFileImage = await savePicture(photo, fileName);
    photos.value = [savedFileImage, ...photos.value];
    // Sauvegarder la liste des photos dans Preferences
    await Preferences.set({
      key: PHOTO_STORAGE,
      value: JSON.stringify(photos.value.map(p => ({ filepath: p.filepath, webviewPath: p.webviewPath }))),
    });
  };

  return {
    photos,
    takePhoto,
  };
};

export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
}
