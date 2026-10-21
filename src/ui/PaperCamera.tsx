import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/Theme';
import type { UploadFile } from '../domain/materialFiles';

export function PaperCamera({ onClose, onPhoto, onUnavailable }: {
  onClose: () => void;
  onPhoto: (file: UploadFile & { width?: number; height?: number }) => void;
  onUnavailable: () => void;
}) {
  const { colors } = useTheme();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);
  return <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#111', justifyContent: 'flex-end' }}>
    {permission?.granted ? <CameraView ref={camera} facing="back" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onCameraReady={() => setReady(true)} /> : null}
    <Pressable accessibilityLabel="Close camera" onPress={onClose} style={{ position: 'absolute', top: 24, left: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><X color="#fff" size={22} /></Pressable>
    <View style={{ alignItems: 'center', gap: 16, padding: 24 }}>
      <Text style={{ color: '#fff', textAlign: 'center' }}>{error || (permission && !permission.granted ? 'Allow camera access, or use your phone’s camera below. You can also choose an existing photo.' : 'Keep the whole page in view.')}</Text>
      {permission?.granted ? <Pressable accessibilityLabel="Take photo" disabled={!ready || capturing} onPress={() => {
        setCapturing(true); setError('');
        void camera.current?.takePictureAsync({ quality: 0.94 }).then(photo => {
          if (!photo?.uri) { setError('Could not take this photo. Please try again.'); return; }
          onPhoto({ uri: photo.uri, name: `page_${Date.now()}.jpg`, mime: 'image/jpeg', width: photo.width, height: photo.height });
        }).catch(() => setError('Could not take this photo. Please try again.')).finally(() => setCapturing(false));
      }} style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: ready && !capturing ? 1 : 0.4 }}>
        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: colors.accent }} />
      </Pressable> : <Pressable accessibilityRole="button" onPress={onUnavailable} style={{ minHeight: 48, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.button, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.onButton, fontFamily: 'Manrope_700Bold' }}>Use phone camera</Text></Pressable>}
    </View>
  </View>;
}
