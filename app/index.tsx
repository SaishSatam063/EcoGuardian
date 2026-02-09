import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { login, signup, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated]);

  if (authLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: Colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  async function handleSubmit() {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    if (!isLogin && (!name.trim() || !institution.trim())) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (isLogin) {
        const success = await login(email.trim(), password);
        if (!success) {
          setError('Account not found. Please sign up first.');
        }
      } else {
        const success = await signup(name.trim(), email.trim(), institution.trim(), password);
        if (!success) {
          setError('Something went wrong. Please try again.');
        }
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setIsLogin(!isLogin);
    setError('');
    Haptics.selectionAsync();
  }

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D6B3A', '#1B8A4A', '#2ECC71', '#A8E6CF']}
        style={styles.gradientBg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.decorCircle1} />
      <View style={styles.decorCircle2} />
      <View style={styles.decorCircle3} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + webTopInset + 40, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons name="leaf" size={40} color={Colors.white} />
            </View>
            <Text style={styles.appTitle}>EcoTrack</Text>
            <Text style={styles.appSubtitle}>Track. Verify. Reward.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
            <Text style={styles.formSubtitle}>
              {isLogin ? 'Sign in to continue your eco journey' : 'Join the green movement today'}
            </Text>

            {!isLogin && (
              <>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor={Colors.textMuted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="school-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Institution"
                    placeholderTextColor={Colors.textMuted}
                    value={institution}
                    onChangeText={setInstitution}
                  />
                </View>
              </>
            )}

            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </Pressable>
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <LinearGradient
                colors={[Colors.primary, Colors.primaryLight]}
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Text style={styles.submitText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>
                    <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable onPress={switchMode} style={styles.switchBtn}>
              <Text style={styles.switchText}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <Text style={styles.switchTextBold}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  gradientBg: { ...StyleSheet.absoluteFillObject },
  decorCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -40,
    right: -60,
  },
  decorCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: 120,
    left: -50,
  },
  decorCircle3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: 100,
    right: 20,
  },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  headerSection: { alignItems: 'center', marginBottom: 32 },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 32,
    fontFamily: 'Poppins_700Bold',
    color: Colors.white,
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  formTitle: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: Colors.text,
  },
  eyeBtn: { padding: 4 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    flex: 1,
  },
  submitBtn: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
  submitBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  submitText: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.white,
  },
  switchBtn: { marginTop: 20, alignItems: 'center' },
  switchText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textSecondary,
  },
  switchTextBold: {
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.primary,
  },
});
