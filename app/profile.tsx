import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';

interface Report {
  id: string;
  category: string;
  description: string;
  status: 'pending' | 'verified' | 'solved';
  cashback: number;
  date: string;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      const stored = await AsyncStorage.getItem('ecotrack_reports');
      if (stored) setReports(JSON.parse(stored));
    } catch {}
  }

  const solvedCount = reports.filter((r) => r.status === 'solved').length;
  const totalCashback = reports.reduce((sum, r) => sum + (r.status === 'solved' ? r.cashback : 0), 0);

  async function handleLogout() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
    router.replace('/');
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'U';

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const memberSince = user?.joinedDate
    ? new Date(user.joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + webBottomInset + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primary, Colors.primaryLight]}
          style={[styles.headerGradient, { paddingTop: insets.top + webTopInset + 12 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerDecor1} />
          <View style={styles.headerDecor2} />

          <View style={styles.headerRow}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.back();
              }}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.white} />
            </Pressable>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.avatarSection}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.profileName}>{user?.name || 'Student'}</Text>
            <Text style={styles.profileInst}>{user?.institution || 'Institution'}</Text>
            <Text style={styles.memberSince}>Member since {memberSince}</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#E8F5E9' }]}>
                <MaterialCommunityIcons name="file-document-outline" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.statNumber}>{reports.length}</Text>
              <Text style={styles.statLabel}>Total Reports</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="checkmark-circle" size={22} color={Colors.warning} />
              </View>
              <Text style={styles.statNumber}>{solvedCount}</Text>
              <Text style={styles.statLabel}>Solved</Text>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="cash" size={22} color={Colors.chartBlue} />
              </View>
              <Text style={styles.statNumber}>{totalCashback}</Text>
              <Text style={styles.statLabel}>Cashback</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Rewards</Text>
          <View style={styles.rewardCard}>
            <LinearGradient
              colors={['#F1C40F', '#F39C12']}
              style={styles.rewardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="ribbon" size={32} color={Colors.white} />
              <View style={styles.rewardInfo}>
                <Text style={styles.rewardTitle}>{solvedCount} Certificate{solvedCount !== 1 ? 's' : ''} Earned</Text>
                <Text style={styles.rewardSub}>For verified environmental contributions</Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.voucherCard}>
            <View style={styles.voucherLeft}>
              <Ionicons name="gift" size={28} color={Colors.primary} />
            </View>
            <View style={styles.voucherInfo}>
              <Text style={styles.voucherTitle}>Cashback Balance</Text>
              <Text style={styles.voucherAmount}>{totalCashback} Points</Text>
            </View>
            <View style={styles.voucherBadge}>
              <Text style={styles.voucherBadgeText}>Active</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuCard}>
            <View style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
                <Text style={styles.menuLabel}>Email</Text>
              </View>
              <Text style={styles.menuValue}>{user?.email || 'N/A'}</Text>
            </View>
            <View style={styles.menuDivider} />
            <View style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <Ionicons name="school-outline" size={20} color={Colors.textSecondary} />
                <Text style={styles.menuLabel}>Institution</Text>
              </View>
              <Text style={styles.menuValue}>{user?.institution || 'N/A'}</Text>
            </View>
            <View style={styles.menuDivider} />
            <View style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <Ionicons name="calendar-outline" size={20} color={Colors.textSecondary} />
                <Text style={styles.menuLabel}>Joined</Text>
              </View>
              <Text style={styles.menuValue}>{memberSince}</Text>
            </View>
          </View>

          {reports.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Report History</Text>
              {reports.map((report) => (
                <View key={report.id} style={styles.historyCard}>
                  <View style={[styles.historyDot, {
                    backgroundColor: report.status === 'solved' ? Colors.success : report.status === 'verified' ? Colors.warning : Colors.chartPurple,
                  }]} />
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyCategory}>{report.category}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={[styles.historyStatus, {
                    color: report.status === 'solved' ? Colors.success : report.status === 'verified' ? Colors.warning : Colors.chartPurple,
                  }]}>
                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                  </Text>
                </View>
              ))}
            </>
          )}

          <Pressable
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1 },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerDecor1: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -30,
    right: -40,
  },
  headerDecor2: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: 20,
    left: -20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
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
  avatarSection: { alignItems: 'center' },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: {
    fontSize: 28,
    fontFamily: 'Poppins_700Bold',
    color: Colors.white,
  },
  profileName: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: Colors.white,
  },
  profileInst: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  memberSince: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
    marginBottom: 12,
  },
  rewardCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  rewardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  rewardInfo: { flex: 1 },
  rewardTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: Colors.white,
  },
  rewardSub: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  voucherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  voucherLeft: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  voucherInfo: { flex: 1 },
  voucherTitle: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: Colors.textSecondary,
  },
  voucherAmount: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: Colors.text,
  },
  voucherBadge: {
    backgroundColor: Colors.lightGreen,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  voucherBadgeText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.primary,
  },
  menuCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuLabel: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    color: Colors.text,
  },
  menuValue: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textMuted,
    maxWidth: 180,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginHorizontal: 14,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  historyInfo: { flex: 1 },
  historyCategory: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.text,
  },
  historyDate: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyStatus: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    marginTop: 12,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: Colors.error,
  },
});
