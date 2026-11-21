import { useState } from 'react';
import { Alert, Linking, Modal, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import { ImageUp, ScanLine, X } from 'lucide-react-native';
import tw from 'twrnc';

export default function BarangayIdScanner({ onScan, onError }) {
  const [open, setOpen] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [readingImage, setReadingImage] = useState(false);
  const validId = (value) => /^\d{4}-\d{4}$/.test(value);

  const start = async () => {
    const current = permission?.granted ? permission : await requestPermission();
    if (!current.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to scan your Barangay ID. You can still enter the number manually.', current.canAskAgain
        ? [{ text: 'OK' }]
        : [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }]);
      return;
    }
    setScanned(false);
    setOpen(true);
  };

  const accept = ({ data }) => {
    const value = data?.trim();
    if (scanned) return;
    if (!validId(value)) {
      setScanned(true);
      onError?.('The scanned barcode did not contain a valid Barangay ID. Keep only the ID barcode inside the frame.');
      setOpen(false);
      return;
    }
    setScanned(true);
    onScan(value);
    setOpen(false);
  };

  const uploadPhoto = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset || !asset.mimeType?.startsWith('image/') || !asset.size || asset.size > 10 * 1024 * 1024) {
      onError?.('Choose a JPG, PNG, or other image file up to 10 MB.');
      return;
    }
    setReadingImage(true);
    try {
      const scans = await scanFromURLAsync(asset.uri, ['code39', 'qr', 'code128', 'pdf417']);
      const value = scans.find((scan) => validId(scan.data?.trim()))?.data?.trim();
      if (!value) throw new Error('BARCODE_NOT_FOUND');
      onScan(value);
      setOpen(false);
    } catch {
      onError?.('We couldn’t read the Barangay ID barcode. Retake the full ID photo in good lighting, keep it straight, and avoid glare.');
    } finally {
      setReadingImage(false);
    }
  };

  return (
    <>
      <Pressable onPress={start} accessibilityRole="button" accessibilityLabel="Scan Barangay ID" style={tw`ml-2 min-h-11 flex-row items-center rounded-lg bg-green-700 px-3`}>
        <ScanLine size={18} color="#FFFFFF" />
        <Text style={tw`ml-1 text-xs font-semibold text-white`}>Scan ID</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={tw`flex-1 bg-black`}>
          <CameraView
            style={tw`flex-1`}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code39', 'code93', 'code128', 'pdf417'] }}
            onBarcodeScanned={scanned ? undefined : accept}
          />
          <View style={tw`absolute left-6 right-6 top-16 flex-row items-center justify-between rounded-xl bg-black/70 p-4`}>
            <Text style={tw`flex-1 text-sm text-white`}>Align the Barangay ID barcode inside the camera.</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}><X size={24} color="#FFFFFF" /></Pressable>
          </View>
          <View pointerEvents="none" style={tw`absolute left-10 right-10 top-1/3 h-48 rounded-2xl border-2 border-white`} />
          <View style={tw`absolute bottom-10 left-6 right-6 flex-row gap-2`}>
            <Pressable onPress={uploadPhoto} disabled={readingImage} accessibilityRole="button" style={tw`min-h-11 flex-1 flex-row items-center justify-center rounded-xl bg-white px-3`}>
              <ImageUp size={18} color="#166534" />
              <Text style={tw`ml-2 text-sm font-semibold text-green-800`}>{readingImage ? 'Reading photo…' : 'Upload ID photo'}</Text>
            </Pressable>
            <Pressable onPress={() => setOpen(false)} style={tw`min-h-11 flex-1 items-center justify-center rounded-xl border border-white px-3`}>
              <Text style={tw`text-sm font-semibold text-white`}>Enter manually</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
