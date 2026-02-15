import Colors from '@/constants/colors';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface GeoData {
  latitude: number;
  longitude: number;
  address?: string;
}

const ORG_CONTACTS = [
  { name: 'Municipal Waste Department', phone: '+91-1234567890', type: 'Waste Management' },
  { name: 'Green Earth Foundation', phone: '+91-9876543210', type: 'Tree Plantation' },
  { name: 'Pollution Control Board', phone: '+91-1122334455', type: 'Pollution' },
  { name: 'Water Authority', phone: '+91-5566778899', type: 'Water Issues' },
];

export default function VerifyScreen() {
  const insets = useSafeAreaInsets();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<GeoData | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState<string[]>([]);
  const [verificationResult, setVerificationResult] = useState<string>('');

  async function pickImage() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: locStatus } = await Location.requestForegroundPermissionsAsync();

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setVerified(false);
      setVerificationResult('');

      if (locStatus === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const geocode = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          const addr = geocode[0]
            ? `${geocode[0].street || ''}, ${geocode[0].city || ''}, ${geocode[0].region || ''}`
            : '';
          setGeoData({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            address: addr,
          });
        } catch {
          setGeoData(null); 
        }
      }
    }
  }

  async function takePhoto() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { status: camStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: locStatus } = await Location.requestForegroundPermissionsAsync();

    if (camStatus !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setVerified(false);
      setVerificationResult('');

      if (locStatus === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const geocode = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          const addr = geocode[0]
            ? `${geocode[0].street || ''}, ${geocode[0].city || ''}, ${geocode[0].region || ''}`
            : '';
          setGeoData({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            address: addr,
          });
        } catch {
          setGeoData(null);
        }
      }
    }
  }

  async function verifyImage() {
    if (!imageUri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setVerifying(true);

    try {
      const filename = imageUri.split('/').pop() || 'photo.jpg';
      const formData = new FormData();

      // --- CRITICAL FIX FOR EXPO WEB ---
      if (Platform.OS === 'web') {
        // Fetch the local blob URL created by Expo ImagePicker and convert to an actual File
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('file', blob, filename);
      } else {
        // Standard React Native approach for iOS/Android
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        formData.append('file', {
          uri: imageUri,
          name: filename,
          type: type,
        } as any);
      }

      if (geoData) {
        formData.append('latitude', geoData.latitude.toString());
        formData.append('longitude', geoData.longitude.toString());
      }

      // Since you are testing in Edge on the same computer:
      const BACKEND_URL = 'http://localhost:8000/verify-action'; 
      
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        body: formData,
        // ABSOLUTELY NO HEADERS HERE! Let the browser handle the boundaries.
      });

      const data = await response.json();

    if (data.status === 'verified') {
        setVerified(true);
        // Save the labels from the AI response
        setDetectedObjects(data.labels_detected || []); 
        
        setVerificationResult(`Verified! (AI Confidence: ${(data.confidence * 100).toFixed(1)}%). Photo matches the required environmental action.`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setVerified(false);
        alert(`Verification Failed: ${data.reason}`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to connect to the AI server. Check your terminal logs.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setVerifying(false);
    }
  }
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primary]}
          style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); router.back(); }}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="close" size={22} color={Colors.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Upload & Verify</Text>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {!imageUri ? (
            <View style={styles.uploadSection}>
              <View style={styles.uploadIconWrap}>
                <Ionicons name="cloud-upload" size={48} color={Colors.primary} />
              </View>
              <Text style={styles.uploadTitle}>Upload Issue Photo</Text>
              <Text style={styles.uploadSub}>Take a photo or choose from gallery with geolocation data</Text>

              <View style={styles.uploadBtnRow}>
                <Pressable
                  style={({ pressed }) => [styles.uploadBtn, pressed && { transform: [{ scale: 0.97 }] }]}
                  onPress={takePhoto}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryLight]}
                    style={styles.uploadBtnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="camera" size={22} color={Colors.white} />
                    <Text style={styles.uploadBtnText}>Camera</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.uploadBtn, pressed && { transform: [{ scale: 0.97 }] }]}
                  onPress={pickImage}
                >
                  <View style={styles.uploadBtnOutline}>
                    <Ionicons name="images" size={22} color={Colors.primary} />
                    <Text style={styles.uploadBtnTextOutline}>Gallery</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.imagePreview}>
                <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
                <Pressable
                  style={styles.changeImageBtn}
                  onPress={() => { setImageUri(null); setVerified(false); setGeoData(null); }}
                >
                  <Ionicons name="refresh" size={18} color={Colors.white} />
                </Pressable>
              </View>

              {geoData && (
                <View style={styles.geoCard}>
                  <Ionicons name="location" size={20} color={Colors.primary} />
                  <View style={styles.geoInfo}>
                    <Text style={styles.geoTitle}>Geolocation Data</Text>
                    <Text style={styles.geoCoords}>
                      {geoData.latitude.toFixed(4)}, {geoData.longitude.toFixed(4)}
                    </Text>
                    {!!geoData.address && (
                      <Text style={styles.geoAddr}>{geoData.address}</Text>
                    )}
                  </View>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                </View>
              )}

              {!verified && (
                <Pressable
                  style={({ pressed }) => [styles.verifyBtn, pressed && { transform: [{ scale: 0.97 }] }]}
                  onPress={verifyImage}
                  disabled={verifying}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryLight]}
                    style={styles.verifyBtnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {verifying ? (
                      <>
                        <ActivityIndicator color={Colors.white} size="small" />
                        <Text style={styles.verifyBtnText}>Verifying...</Text>
                      </>
                    ) : (
                      <>
                        <Feather name="shield" size={20} color={Colors.white} />
                        <Text style={styles.verifyBtnText}>Verify Image</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              )}

              {verified && (
                <>
                  <View style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                      <Text style={styles.resultTitle}>Verified</Text>
                    </View>
                    <Text style={styles.resultText}>{verificationResult}</Text>
                    {detectedObjects.length > 0 && (
  <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
    {detectedObjects.map((obj, index) => (
      <View key={index} style={{ backgroundColor: '#C8E6C9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
        <Text style={{ fontSize: 12, color: '#2E7D32', fontFamily: 'Poppins_600SemiBold' }}>
          # {obj.replace('_', ' ')}
        </Text>
      </View>
    ))}
  </View>
)}
                  </View>

                  <Text style={styles.sectionTitle}>Contact Organizations</Text>
                  <Text style={styles.sectionSub}>Reach out to the relevant authority for your reported issue</Text>

                  {ORG_CONTACTS.map((org, i) => (
                    <Pressable
                      key={i}
                      style={({ pressed }) => [styles.orgCard, pressed && { transform: [{ scale: 0.98 }] }]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        Linking.openURL(`tel:${org.phone}`);
                      }}
                    >
                      <View style={styles.orgIcon}>
                        <MaterialCommunityIcons
                          name={
                            org.type === 'Waste Management' ? 'recycle' :
                            org.type === 'Tree Plantation' ? 'tree' :
                            org.type === 'Pollution' ? 'factory' : 'water'
                          }
                          size={22}
                          color={Colors.primary}
                        />
                      </View>
                      <View style={styles.orgInfo}>
                        <Text style={styles.orgName}>{org.name}</Text>
                        <Text style={styles.orgType}>{org.type}</Text>
                      </View>
                      <Ionicons name="call" size={20} color={Colors.primary} />
                    </Pressable>
                  ))}

                  <Pressable
                    style={({ pressed }) => [styles.reportBtn, pressed && { opacity: 0.9 }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.replace('/report');
                    }}
                  >
                    <Ionicons name="create" size={20} color={Colors.white} />
                    <Text style={styles.reportBtnText}>File Detailed Report</Text>
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.white,
  },
  body: { padding: 20 },
  uploadSection: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: Colors.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
    paddingHorizontal: 24,
  },
  uploadIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
    marginBottom: 4,
  },
  uploadSub: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  uploadBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  uploadBtn: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  uploadBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  uploadBtnText: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.white,
  },
  uploadBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 14,
  },
  uploadBtnTextOutline: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.primary,
  },
  imagePreview: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: 16,
  },
  changeImageBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  geoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 12,
  },
  geoInfo: { flex: 1 },
  geoTitle: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.text,
  },
  geoCoords: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textMuted,
  },
  geoAddr: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  verifyBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
  verifyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  verifyBtnText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.white,
  },
  resultCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: Colors.success,
  },
  resultText: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textMuted,
    marginBottom: 14,
  },
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  orgIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orgInfo: { flex: 1 },
  orgName: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.text,
  },
  orgType: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textMuted,
    marginTop: 2,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.chartBlue,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 10,
  },
  reportBtnText: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.white,
  },
});
