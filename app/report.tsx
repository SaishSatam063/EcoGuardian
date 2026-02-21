import Colors from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORIES = [
  { id: 'waste', label: 'Waste Segregation', icon: 'trash-outline' as const },
  { id: 'tree', label: 'Tree Plantation', icon: 'leaf-outline' as const },
  { id: 'water', label: 'Water Pollution', icon: 'water-outline' as const },
  { id: 'air', label: 'Air Pollution', icon: 'cloud-outline' as const },
  { id: 'energy', label: 'Energy Conservation', icon: 'flash-outline' as const },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' as const },
];

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  
  // State
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [imageUri, setImageUri] = useState<string | null>(null); // New state for Evidence
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fetchingLoc, setFetchingLoc] = useState(false);

  // Take photo for evidence
  async function pickImage() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera permissions to verify this report!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      exif: true, // Crucial for backend metadata verification
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  async function fetchLocation() {
    setFetchingLoc(true);
    Haptics.selectionAsync();
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setFetchingLoc(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geocode = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (geocode[0]) {
        const parts = [geocode[0].street, geocode[0].city, geocode[0].region].filter(Boolean);
        setLocation(parts.join(', '));
      }
    } catch {} finally {
      setFetchingLoc(false);
    }
  }

  async function handleSubmit() {
    // Require imageUri along with other fields
    if (!category || !title.trim() || !description.trim() || !imageUri) return;

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      // 1. Prepare data for Python Backend
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        name: 'evidence.jpg',
        type: 'image/jpeg',
      } as any);
      
      // Match the fields expected by FastAPI
      formData.append('device_timestamp', new Date().toISOString()); 
      // If you have actual lat/lon from Location, append them here too

      // 2. Send to backend AI for Verification
      // REPLACE <YOUR_LAPTOP_IP> WITH YOUR ACTUAL IPv4 ADDRESS (e.g., 192.168.1.5)
      const response = await fetch('http://192.168.137.116:8000/verify-action', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await response.json();

      if (result.status === 'verified') {
        // AI VERIFICATION SUCCESS!
        const cashbackAmounts: Record<string, number> = {
          waste: 50, tree: 100, water: 75, air: 60, energy: 45, other: 30,
        };
        const cashback = cashbackAmounts[category] || 50;

        const report = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          category: CATEGORIES.find((c) => c.id === category)?.label || category,
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          severity,
          status: 'verified' as const,
          cashback,
          date: new Date().toISOString(),
          ai_labels: result.labels_detected, // Store what the AI saw
        };

        // Save to local storage for UI history
        const stored = await AsyncStorage.getItem('ecotrack_reports');
        const reports = stored ? JSON.parse(stored) : [];
        reports.unshift(report);
        await AsyncStorage.setItem('ecotrack_reports', JSON.stringify(reports));

        if (user) {
          await updateUser({
            totalReports: (user.totalReports || 0) + 1,
            totalCashback: (user.totalCashback || 0) + cashback,
          });
        }
        
        setSubmitted(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // AI REJECTED THE IMAGE (e.g., No environmental elements, duplicate, etc.)
        alert(`Verification Failed: ${result.reason}`);
      }

    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to connect to the verification server. Check your backend IP!");
    } finally {
      setSubmitting(false);
    }
  }

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={[styles.successContainer, { paddingTop: insets.top + webTopInset + 60 }]}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Report Verified!</Text>
          <Text style={styles.successText}>
            Our AI has verified your evidence. You will receive your cashback rewards and certificate shortly!
          </Text>

          <View style={styles.rewardPreview}>
            <MaterialCommunityIcons name="gift" size={24} color={Colors.gold} />
            <View style={styles.rewardPreviewInfo}>
              <Text style={styles.rewardPreviewTitle}>Reward Secured</Text>
              <Text style={styles.rewardPreviewAmount}>Certificate + Cashback Points</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.9 }]}
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight]}
              style={styles.doneBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="arrow-back" size={20} color={Colors.white} />
              <Text style={styles.doneBtnText}>Back to Dashboard</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={['#2980B9', '#3498DB']}
            style={[styles.header, { paddingTop: insets.top + webTopInset + 12 }]}
          >
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); router.back(); }}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="close" size={22} color={Colors.white} />
              </Pressable>
              <Text style={styles.headerTitle}>Report Issue</Text>
              <View style={{ width: 44 }} />
            </View>
          </LinearGradient>

          <View style={styles.body}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    category === cat.id && styles.categoryChipActive,
                  ]}
                  onPress={() => { setCategory(cat.id); Haptics.selectionAsync(); }}
                >
                  <Ionicons
                    name={cat.icon}
                    size={18}
                    color={category === cat.id ? Colors.white : Colors.primary}
                  />
                  <Text style={[
                    styles.categoryText,
                    category === cat.id && styles.categoryTextActive,
                  ]}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Issue Title</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Brief title of the issue"
              placeholderTextColor={Colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="Describe the environmental issue in detail..."
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            {/* --- NEW EVIDENCE UPLOAD SECTION --- */}
            <Text style={styles.sectionTitle}>Upload Evidence (Required)</Text>
            <Pressable 
              style={styles.imageUploadBtn} 
              onPress={pickImage}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="camera" size={36} color={Colors.primary} />
                  <Text style={styles.uploadText}>Tap to capture live photo</Text>
                  <Text style={styles.uploadSubtext}>Must be a real-time capture for AI verification</Text>
                </View>
              )}
            </Pressable>

            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.locationRow}>
              <TextInput
                style={[styles.textInput, { flex: 1, marginBottom: 0 }]} // Removed bottom margin to align with row
                placeholder="Enter location"
                placeholderTextColor={Colors.textMuted}
                value={location}
                onChangeText={setLocation}
              />
              <Pressable
                style={({ pressed }) => [styles.locBtn, pressed && { opacity: 0.8 }]}
                onPress={fetchLocation}
                disabled={fetchingLoc}
              >
                {fetchingLoc ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Ionicons name="navigate" size={20} color={Colors.white} />
                )}
              </Pressable>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Severity</Text>
            <View style={styles.severityRow}>
              {(['low', 'medium', 'high'] as const).map((s) => (
                <Pressable
                  key={s}
                  style={[
                    styles.severityBtn,
                    severity === s && {
                      backgroundColor: s === 'low' ? Colors.success : s === 'medium' ? Colors.warning : Colors.error,
                      borderColor: s === 'low' ? Colors.success : s === 'medium' ? Colors.warning : Colors.error,
                    },
                  ]}
                  onPress={() => { setSeverity(s); Haptics.selectionAsync(); }}
                >
                  <Text style={[
                    styles.severityText,
                    severity === s && styles.severityTextActive,
                  ]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                // Disable if image is missing
                (!category || !title.trim() || !description.trim() || !imageUri) && styles.submitBtnDisabled,
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
              onPress={handleSubmit}
              disabled={submitting || !category || !title.trim() || !description.trim() || !imageUri}
            >
              <LinearGradient
                colors={(!category || !title.trim() || !description.trim() || !imageUri)
                  ? ['#ccc', '#bbb']
                  : [Colors.primary, Colors.primaryLight]}
                style={styles.submitBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color={Colors.white} />
                    <Text style={styles.submitBtnText}>Submit & Verify</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.text,
    marginBottom: 10,
    marginTop: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryText: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: Colors.primary,
  },
  categoryTextActive: {
    color: Colors.white,
  },
  textInput: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  /* --- NEW STYLES FOR IMAGE UPLOAD --- */
  imageUploadBtn: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    alignItems: 'center',
  },
  uploadText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.primary,
  },
  uploadSubtext: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textMuted,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  /* ----------------------------------- */
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  locBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  severityRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  severityBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.white,
  },
  severityText: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    color: Colors.textSecondary,
  },
  severityTextActive: {
    color: Colors.white,
  },
  submitBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.white,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
    marginBottom: 12,
  },
  successText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  rewardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    gap: 14,
    width: '100%',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  rewardPreviewInfo: { flex: 1 },
  rewardPreviewTitle: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: Colors.textMuted,
  },
  rewardPreviewAmount: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
  },
  doneBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
  },
  doneBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  doneBtnText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.white,
  },
});